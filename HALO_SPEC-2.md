# HALO — Health Autonomy for Long-duration Operations
### Master build spec (NASA Space Apps 2026 · "Health monitoring software for astronauts")

> **Agent instructions:** This file is the single source of truth. Before every task, re-read the section for the phase you are asked to build. Build ONLY that phase. Never invent medical thresholds — use the tables in §6 exactly. After each phase: run `npm run build` and `npm run test`, fix every error, open the app in the browser and verify each acceptance criterion, then report what you verified and what the human should test manually.

---

## 1. The idea in one paragraph

On a Mars mission, the doctor is up to 22 light-minutes away. HALO is an offline-first, camera-and-touch health co-pilot that **becomes more autonomous the farther the crew is from Earth**. It measures heart rate from the face with no hardware (rPPG), runs NASA-style cognitive and vision self-tests, judges every reading against both clinical ranges **and the astronaut's own pre-flight baseline**, shows results on a living digital twin of the body, and — when something goes wrong — switches to a hands-free, voice-guided emergency mode (including microgravity CPR). Everything is queued to a simulated flight-surgeon console on "Earth" with a real light-time delay.

## 2. Non-negotiable principles

1. **Accuracy over flash.** Every number shown has a source: a sensor algorithm with a quality score, a validated test, or manual entry. If signal quality is poor, HALO says "no reading" instead of guessing.
2. **Explainable, deterministic rules.** No black-box AI decides health status. Every flag shows *why* in one plain sentence ("Resting HR 112 is above your baseline of 64 ± 5 and above the 100 bpm normal limit").
3. **Offline-first.** No internet in deep space. App is a PWA; all models, fonts, WASM and data are bundled locally. Zero runtime network calls.
4. **Astronauts are not doctors.** Every measurement has a "How to measure / Why it matters in space / What to do if abnormal" card.
5. **Gamify adherence, never values.** XP is earned for doing checks on time, not for "good" numbers.
6. **Colour is never the only signal.** Status = colour + icon + word (NOMINAL / WATCH / ALERT / CRITICAL).
7. **Glove-friendly.** Min tap target 56 px, primary actions reachable one-handed, high contrast.
8. Persistent footer: "Prototype for NASA Space Apps. Not a medical device."

## 3. Tech stack (do not substitute)

- Vite + React 18 + TypeScript (strict) + Tailwind CSS
- react-router-dom, framer-motion (animation), recharts (charts), lucide-react (icons)
- Dexie (IndexedDB) for all persistence
- vite-plugin-pwa (offline caching of all assets incl. models/WASM). REQUIRED config (v3): `workbox.maximumFileSizeToCacheInBytes: 20 * 1024 * 1024` and `workbox.globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,wasm,task}']` — Workbox skips files over 2 MB by default, which would silently leave the MediaPipe model and WASM out of the offline cache. Offline tests are only valid on `npm run build && npm run preview`, never on the dev server.
- @mediapipe/tasks-vision (FaceLandmarker) — WASM files and `face_landmarker.task` model copied into `/public/mediapipe/` and loaded from there (no CDN)
- Web Speech API `speechSynthesis` for voice output (works offline with local voices). Do NOT depend on speech recognition. Choose a voice where `voice.localService === true` (network voices fail offline). Every spoken line must also appear as an on-screen caption; if no voice exists, captions alone must be enough.
- Vitest for unit tests (rules engine, DSP, PVT scoring)
- Fonts bundled locally: Space Grotesk (UI), JetBrains Mono (numbers)

Folder layout:
```
src/
  app/ (routes, layout, providers)
  design/ (tokens, components: StatusBadge, GlassCard, BigButton, Gauge…)
  data/ (db.ts Dexie schema, seed/demoMission.ts)
  config/ (environments.ts, thresholds.ts, learnLibrary.ts)
  engine/ (rules.ts, baseline.ts, readiness.ts, scheduler.ts, gamification.ts)
  sensors/rppg/ (capture.ts, roi.ts, pos.ts, dsp.ts, quality.ts, worker.ts)
  features/ (bridge, scan, checks, cognition, vision, trends, emergency, groundlink, learn, onboarding, validation)
  ground/ (GroundConsole route)
```

## 4. Visual design

- "Mission control at night": near-black navy background (#05070D), glass panels (white 4–6% fill, 1px white 10% border, backdrop blur), cyan accent (#38E1FF), subtle animated starfield on Bridge only.
- Status colours: NOMINAL #22C55E (check icon), WATCH #F59E0B (eye icon), ALERT #F97316 (triangle), CRITICAL #EF4444 (octagon, pulsing).
- Numbers in JetBrains Mono, tabular. Units always shown.
- Motion: 200–300 ms ease-out; respect `prefers-reduced-motion`.
- Top bar on every screen: crew name · mission day · environment chip · **Light-delay chip** ("Earth: 14 min 06 s one-way") · readiness ring.

## 5. Mission environments (`config/environments.ts`)

Values are approximate published averages; show "approx." in UI with the source note.

| id | Name | Gravity (g) | One-way comm delay | Radiation dose rate (mSv/day, approx.) | Onboard equipment flags |
|---|---|---|---|---|---|
| `iss` | Space station (LEO) | 0 | < 1 s | 0.5 | bpCuff, glucometer, thermometer, pulseOx, ultrasound, oct, aed |
| `transit` | Deep-space transit to Mars | 0 | 3–22 min (slider) | 1.8 (Curiosity RAD cruise) | bpCuff, glucometer, thermometer, pulseOx, ultrasound, aed |
| `moon` | Lunar surface base | 0.166 | 1.3 s | 1.37 (Chang'e-4 LND) | bpCuff, glucometer, thermometer, pulseOx, aed |
| `mars` | Mars surface base | 0.38 | 3–22 min (slider) | 0.64 (Curiosity RAD surface) | bpCuff, glucometer, thermometer, pulseOx, ultrasound, aed |
| `rover` | Pressurized rover sortie | 0.166 or 0.38 | inherits | inherits | thermometer, pulseOx only |

Environment changes: which checks are offered (only show measurements whose equipment exists; camera checks always available), comm delay, radiation accumulation, whether the Gravity Transition Check is offered (moon/mars/landing), and copy in the Learn cards.

**Autonomy level** (shown on Bridge, drives UI):
- delay < 5 s → "Ground-supported": ALERTs auto-notify ground.
- 5 s–5 min → "Delayed support": HALO gives full local guidance first, ground notified.
- > 5 min → "Autonomous": banner "Ground cannot respond in time for emergencies. Follow HALO guidance and your crew medical officer." Emergency flows never wait for ground.

## 6. Thresholds (`config/thresholds.ts`) — use EXACTLY

Status precedence: CRITICAL > ALERT > WATCH > NOMINAL. Absolute CRITICAL always overrides baseline logic.

**No-gap rule (v3):** before classifying, round each value to the table's precision (HR, BP, SpO₂, glucose, respiratory rate → whole number; temperature and sleep → 1 decimal). Camera readings are decimals, so this matters. After rounding, every valid value must land in exactly one band. Add a Vitest "sweep" test per indicator that steps through its whole valid input range and asserts that exactly one status is returned for every step.

| Indicator | Unit | NOMINAL | WATCH | ALERT | CRITICAL |
|---|---|---|---|---|---|
| Resting heart rate | bpm | 50–100 | 40–49 or 101–110 | 111–130 | < 40 or > 130 |
| Blood pressure (sys/dia) | mmHg | sys 90–119 and dia < 80 | sys 120–129 and dia < 80 | sys 130–180 or dia 80–120; or sys < 90 | sys > 180 or dia > 120 |
| SpO₂ | % | ≥ 95 | 93–94 | 91–92 | ≤ 90 |
| Body temperature | °C | 36.1–37.2 | 37.3–37.9 or 35.5–36.0 | 38.0–39.4 or 35.0–35.4 | ≥ 39.5 or < 35.0 |
| Blood glucose | mg/dL | 70–140 (70–180 if marked post-meal) | 141–180 (not post-meal) or 54–69 | 181–250 | < 54 or > 250 |
| Respiratory rate | /min | 12–20 | 21–24 or 10–11 | 25–29 | < 10 or ≥ 30 |
| Sleep (24 h) | h | ≥ 7 | 6–6.9, or a single day < 6 | < 6 for 3+ consecutive days, or a single day < 4 | < 4 for 2+ consecutive days |
| PHQ-2 (weekly) | score 0–6 | 0–2 | — | ≥ 3 (suggest talk to CMO / psych conference) | — (any self-harm thoughts → show support message + immediate private ground contact option) |
| GAD-2 (weekly) | score 0–6 | 0–2 | — | ≥ 3 | — |
| PVT-B | vs baseline | within 10% speed of baseline | 10–20% slower or lapses ≥ baseline + 3 | > 20% slower | — |
| Amsler grid | map | no distortion | — | any new distortion vs previous (→ "request OCT/fundoscopy & flight surgeon review"; SANS context) | sudden large loss of central vision |
| Orthostatic stand test | change | — | — | systolic drop ≥ 20 or diastolic drop ≥ 10 within 3 min, or HR rise ≥ 30 bpm | fainting / near-fainting |
| Cumulative radiation | mSv | < 50% of 600 mSv career limit | 50–79% | 80–99% | ≥ 100% (NASA 2022 career limit 600 mSv) |

**Personal baseline layer (`engine/baseline.ts`):**
- Baseline = readings tagged "pre-flight" if at least 3 exist; otherwise the first 5 readings that are themselves NOMINAL by the absolute table (an abnormal reading must never become part of "normal for you"). Compute mean and SD.
- SD floors are per indicator, in real units (v3 — a percentage floor breaks temperature): HR 3 bpm · systolic 5 mmHg · diastolic 4 mmHg · SpO₂ 1 % · temperature 0.2 °C · glucose 8 mg/dL · respiratory rate 1.5 /min · sleep 0.5 h · PVT mean RT 5 % of baseline mean.
- z = (value − mean)/SD. WATCH "unusual for *you*" if |z| ≥ 3 on the latest reading, OR |z| ≥ 2 on 2 of the last 3 readings. For SpO₂ and sleep only downward deviations count.
- Space-normal note: resting core temperature has been reported to rise gradually by about 1 °C during long-duration flight (Stahn et al., 2017, Scientific Reports). When gravity is 0 g, mission day > 30 and temperature is in the 37.3–37.9 WATCH band, append this sentence to the reasons: "A slightly raised resting temperature is common in long-duration flight — compare with your in-flight trend." Do not change the thresholds.
- 7-day linear trend (least squares). If projected value hits an ALERT boundary within 7 days → WATCH "trending toward…".
- Final status = max(absolute status, baseline status). Always output `{status, reasons: string[]}`.

Unit tests (Vitest) must cover every boundary in the table above.

## 7. Features

### 7.1 Onboarding
Crew profile (name, call sign, age, sex, role, CMO yes/no), environment picker (big cards with gravity/delay/radiation), mission start date → mission day, comm-delay slider where applicable, prompts to record baselines. Option: **"Load demo mission"** (see 7.12).

### 7.2 Bridge (dashboard)
- Left: **Digital Twin** — stylised, layered SVG human (front view) with glowing clickable regions: Brain (cognition, mood, sleep), Eyes (Amsler/SANS), Heart (HR, BP), Lungs (SpO₂, resp rate), Blood (glucose, temperature, immune note), Bones/Muscle (exercise, bone-loss estimate), Skin/whole-body (radiation dose). Each region glows its current status colour; CRITICAL pulses. Click → side sheet: what this system does, how spaceflight affects it (fluid shift, bone loss 1–1.5%/month at hip/spine without countermeasures, SANS, immune dysregulation, radiation), latest readings with sparkline, reasons, recommended actions.
- Right: Readiness ring (§7.9), "Today's checks" orbit ring (tasks as dots on a ring, filled when done), active alerts list, radiation dose bar vs limit, light-delay + autonomy level, ground inbox count.
- Big red **EMERGENCY** button always visible on every screen (bottom-right, 72 px).

### 7.3 Camera Scan — contactless heart rate (rPPG) — accuracy-critical
Pipeline (run DSP in a Web Worker):
1. `getUserMedia` 640×480 @ 30 fps, front camera. Guidance overlay: "Face the light, stay still, 20 s". Pre-checks: face found, mean ROI brightness within 60–200 (0–255), not clipped.
2. MediaPipe FaceLandmarker (VIDEO mode, GPU delegate with CPU fallback). Build skin ROIs from canonical face-mesh landmarks for **forehead** and **both cheeks**. Draw ROI polygons on the preview so the human can verify they sit on skin.
3. Per frame: mean R, G, B over ROI pixels (exclude pixels with any channel < 20 or > 245). Store with `performance.now()` timestamp. Track landmark motion; if inter-frame nose-tip displacement > threshold, mark frame as motion and show "Hold still".
4. Resample to uniform 30 Hz (linear interpolation) — browser frame timing is irregular.
5. **POS algorithm (Wang et al., 2017):** sliding window 1.6 s, step 1 frame. In each window normalise each channel by its window mean; S1 = G − B; S2 = G + B − 2R; h = S1 + (σ(S1)/σ(S2))·S2; subtract mean; overlap-add into output signal.
6. Detrend (subtract 1 s moving average), band-pass 0.7–3.0 Hz (42–180 bpm) with a 4th-order Butterworth implemented as cascaded biquads, applied forward-backward (zero phase).
7. Heart rate: Hann window over last 10 s, zero-pad FFT to ≥ 4096 points, peak in 0.7–3.0 Hz, parabolic interpolation for sub-bin precision → bpm. Update every 1 s after the first 10 s. Final result = median of the per-second estimates from the last 10 s.
8. **Quality / SNR (de Haan & Jeanne):** signal power within ±0.1 Hz of f0 and of 2·f0 vs remaining power in band, in dB. Combine with motion % and brightness into Quality: GOOD / FAIR / POOR. POOR → do not save a value; show what to fix. Thresholds are constants in `quality.ts` to be tuned during validation (start: GOOD ≥ 3 dB, FAIR 0–3 dB, POOR < 0 dB or > 20% motion frames).
9. UI: live filtered waveform, live bpm with ± spread, quality meter, then "Save reading" (source = camera, quality stored). Respiratory rate from the 0.1–0.5 Hz component is allowed only behind an "Experimental" label and is never used for status.
10. Tests: synthesise RGB traces with a known pulse (e.g., 72 bpm) + noise + slow lighting drift → algorithm must return within ±2 bpm. Test 50, 72, 110, 150 bpm.
11. Frame capture (v3): drive capture with `video.requestVideoFrameCallback` (fallback `requestAnimationFrame`) and use the callback metadata timestamp (`captureTime` if present, else `mediaTime`) for each sample. Read pixels from a small canvas created with `{ willReadFrequently: true }`, drawing only the face bounding box.
12. Exposure lock (v3): about 2 s after the stream starts, try `track.applyConstraints({ advanced: [{ exposureMode: 'manual', whiteBalanceMode: 'manual' }] })` inside try/catch. Auto-exposure changes look like a pulse to the algorithm. If unsupported, continue silently.
13. **Fingertip mode (v3):** second, independent method that reuses steps 6–8. User covers the rear camera with a fingertip (turn the torch on where the `torch` constraint is supported). Signal = mean RED channel of the centre region; no face model, no POS. "Finger detected" pre-check: R > 1.5 × G and R > 1.5 × B and R mean between 60 and 250. Offer it automatically after two POOR face scans. Save with source = fingertip. If a face reading and a fingertip reading exist within 5 minutes, show "Face 71 · Finger 72 — two methods agree (Δ 1 bpm)" or, if they differ by > 5 bpm, "Methods disagree — repeat the scan".
14. Out of scope on purpose: do NOT estimate HRV, blood pressure, SpO₂ or stress from the camera. A 30 fps webcam cannot do these reliably; the Learn card says so.

### 7.4 Guided manual checks
One flow per indicator available in the environment: BP, SpO₂ (pulse oximeter), temperature, glucose (fasting / post-meal toggle), resting HR (manual alternative), respiratory rate (built-in 30 s tap-each-breath counter ×2), sleep (hours + quality 1–5), daily mood check-in (mood, energy, stress, loneliness, 1–5 emoji scale + optional note), weekly PHQ-2 and GAD-2 (exact validated wording), exercise log (resistance / aerobic minutes).
Each flow: step-by-step "How to measure" card with simple illustration (e.g., BP: rest 5 min, arm at heart level, cuff on bare upper arm, no talking, take 2 readings 1 min apart and average) → input with unit validation and sane-range rejection (e.g., HR 20–250) → instant result card with status, reasons, and "What to do now" actions.

### 7.5 Cognition — PVT-B (3-minute Psychomotor Vigilance Test, as used in NASA's Cognition battery)
- 3 min duration. Inter-stimulus interval random uniform 1–4 s. Stimulus = millisecond counter appears in a target zone; respond by tap or spacebar.
- Timing: record stimulus onset using the `requestAnimationFrame` timestamp of the frame that first paints it; response via `pointerdown`/`keydown` `event.timeStamp`. Both on `performance.now()` clock.
- Lapse = RT ≥ 355 ms (PVT-B criterion). False start = response < 100 ms or with no stimulus.
- Metrics: mean speed (1/RT), median RT, lapses, false starts, lapses+false starts. Baseline = mean of first 3 sessions. Store a device id with every session and compare only sessions from the same device (touch and display latency differ by tens of milliseconds between devices); say this in the info card. Status per §6. Chart history. Explain: fatigue and sleep debt show up here before you feel them.

### 7.6 Vision — Amsler grid (SANS self-screen)
- Screen calibration once: user resizes an on-screen rectangle to match a bank card's width (85.6 mm) → px per mm stored.
- Render a true 10 cm × 10 cm grid of 5 mm squares with central dot. Instruct: hold at ~30 cm, cover one eye, stare at dot.
- Small screens (v3): if 10 cm does not fit, render the largest 20 × 20 grid that fits and tell the user to hold the screen at **3 × the grid width** (e.g., 6.6 cm grid → 20 cm). This keeps each square at 1° of visual angle, the same as the standard chart. Show the computed distance in cm. User taps cells that look wavy, blurred or missing. Do each eye.
- Save map; compare with previous map per eye; new cells → ALERT per §6. Explain SANS (optic disc swelling, choroidal folds in long-duration crew) and that this does not replace onboard OCT/fundoscopy.

### 7.7 Gravity Transition Check (moon/mars/landing only)
Orthostatic stand test: rest 5 min seated/supine → record HR & BP → stand → record at 1 min and 3 min (camera HR or manual). Evaluate per §6. Safety copy: have a crewmate nearby, sit down immediately if dizzy.

### 7.8 Radiation & bone dashboard
- Cumulative dose = Σ(environment rate × days) unless the user enters a personal dosimeter reading (overrides). Show % of 600 mSv career limit.
- "Solar Particle Event" alert (demo trigger button + scheduled demo event): full-screen shelter protocol — go to storm shelter / most shielded area, stay until all-clear, log time.
- Bone/muscle: show educational estimate band of hip BMD change using 1–1.5%/month published ISS average without countermeasures, labelled "estimate, not a measurement"; show exercise adherence vs daily target and explain resistance exercise is the main countermeasure.

### 7.9 Readiness score (`engine/readiness.ts`)
Start 100. Per indicator: CRITICAL −30, ALERT −15, WATCH −5. Each overdue scheduled check −3. Clamp 0–100. Show the breakdown list ("−15 Sleep < 6 h for 3 days"). Bands: ≥ 80 GO, 60–79 GO WITH CAUTION, < 60 HOLD — consult CMO.

### 7.10 Scheduler, reminders & gamification
- Default routine: daily — morning mood + sleep log, camera HR scan, PVT-B; every 3 days — BP; weekly — PHQ-2/GAD-2, Amsler both eyes, glucose; per environment additions. Stored as editable tasks.
- In-app reminders (toast + Notification API when permitted). Overdue tasks show on the orbit ring.
- Gamification: XP for completing tasks on time, daily streak ("orbits"), badges (e.g., "First Light" first scan, "Iron Body" 7-day exercise streak, "Clear Sight" both-eye Amsler, "Steady Hand" 5 PVTs). Crew page shows each crew member's adherence (not their health values).

### 7.11 EMERGENCY mode (voice-guided, hands-free)
Pressing EMERGENCY → full-screen red. Step 0, one tap (v3): "Who needs help?" — Me / a crewmate (crew picker). All vitals taken in this mode are saved to the PATIENT's record and shown next to the patient's own baseline ("HR 124 — her normal is 58").

**Decision clock (v3), pinned at the top of every emergency screen:** "Earliest possible answer from Earth: 28 min 12 s" (2 × current one-way delay, live) beside a count-up "Time since event". In the CPR protocol add the line "Without CPR, brain injury can begin in about 4–6 minutes." This one panel explains why HALO must act locally.

First question (huge buttons): "Is the person responsive and breathing normally?" Then protocol cards, each step spoken aloud via speechSynthesis with a large "Next" and "Repeat" button and a running timer + timestamped incident log.

Protocols:
1. **Unresponsive / not breathing → CPR coach.** Call crew + CMO, get AED and follow its prompts. Metronome at 110 compressions/min (audio click + visual pulse), 30:2 cycle counter, depth target 5–6 cm. Environment-aware positioning: in microgravity show (a) restrain patient on the medical restraint/back against a fixed surface, (b) **Evetts-Russomano method** (rescuer wraps legs around patient's torso, compresses with arms — developed with Brazilian researcher Thais Russomano), (c) **handstand method** (rescuer's feet braced against the opposite wall). In lunar/Mars gravity: standard ground CPR (note reduced body weight → use more arm force).
2. **Chest pain (conscious)** — the challenge video's scenario. Capture: onset, character (pressure/sharp/tearing), radiation to arm/jaw/back, shortness of breath, sweating, recent EVA or suit pressure change, recent trauma. Take vitals (camera HR + BP + SpO₂ if available). Red-flag logic → "Possible cardiac or lung emergency": keep at rest, oxygen if SpO₂ < 90 or breathing is difficult (per onboard checklist), prepare AED, follow onboard medical checklist and medications per flight-surgeon protocol (do not hard-code drug doses), notify ground. Re-check vitals every 5 min (timer).
3. **Breathing difficulty / smoke or toxic atmosphere** — masks/oxygen first, leave the affected module, SpO₂ and resp-rate monitoring.
4. **Radiation storm (SPE)** — shelter protocol (§7.8).
On exit, HALO auto-generates an incident report in **SBAR** format, the standard clinical handover structure (v3): **S**ituation (who, what, when, mission day, environment) · **B**ackground (patient baseline, last 7 days of flags, recent EVA) · **A**ssessment (vitals timeline with statuses, answers given, protocol steps completed with timestamps) · **R**equest (what the crew needs from the flight surgeon). It is queued to Ground Link with HIGH priority and can be exported as a PDF/print view.

### 7.12 Ground Link & Ground Console (light-delay simulation)
- Outbox: every ALERT/CRITICAL, incident report and daily summary becomes a packet. Packets are persisted in Dexie and delivered after the current one-way delay.
- Transport: `BroadcastChannel('halo-downlink')` between the astronaut app and a second route `/ground` opened in another window/screen. Ground Console = flight-surgeon view: crew list, incoming packets with "sent at / arrives at", countdown bars for packets "in flight", vitals charts, and a reply box. Replies travel back with the same delay and land in the astronaut's inbox.
- **Demo time compression** toggle: 1 minute of light delay = 2 seconds real time (default ON in demo mission).
- Visual: small animated packet dot travelling along an Earth↔ship arc.
- Delivery is timestamp-based (v3): each packet stores `sentAt` and `arrivesAt`; on load and every second, deliver anything whose `arrivesAt` has passed. Never rely on a long `setTimeout` — a refresh must not lose or duplicate packets.
- **Split view (v3):** route `/split` shows Ship (left) and Ground Console (right) side by side in one window (stacked on phones). BroadcastChannel only works inside one browser on one device, so this is the view used for the demo video, for Judge Mode step 6, and for any judge on a single device.

### 7.13 Trends
Per-indicator charts (recharts): line of values, shaded personal-baseline band (mean ± 2 SD), shaded clinical NOMINAL band, coloured points by status, 7/30/90-day ranges. Overlay toggles: sleep vs PVT, stress vs HR.

### 7.14 Learn library
For every indicator and hazard (radiation, isolation & confinement, distance from Earth, gravity fields, hostile closed environment — NASA HRP's five hazards): What it is · Why it changes in space · How to measure it here · Normal range · When to tell the CMO / flight surgeon. Plain language, ≤ 120 words each, searchable.

### 7.15 Demo mission seed (`data/seed/demoMission.ts`)
"Ares Transit — Day 142", 4 crew, environment `transit`, delay 14 min. Generate 142 days of plausible data with a seeded RNG (deterministic). Inject clearly visible stories that the engine must catch: sleep declining to ~5.5 h in days 120–140 with PVT slowing; BP drifting upward last 10 days; one new Amsler distortion in right eye on day 135; a scheduled SPE event. Everything labelled "SIMULATED DATA".
Seed test (v3): a Vitest test loads the demo mission, runs the real engine and asserts the story holds — sleep = ALERT, PVT = ALERT (> 20 % slower than baseline), BP at least WATCH, right-eye Amsler = ALERT, radiation NOMINAL, readiness below 80. If the engine changes, this test tells you the demo broke.

### 7.16 Validation page
Table where the team logs paired readings: HALO camera HR vs reference device (pulse oximeter/smartwatch), lighting condition, skin tone (Fitzpatrick I–VI, optional), motion. Auto-computes MAE, RMSE, % within ±5 bpm, Bland-Altman plot. Export CSV. This is the evidence that HALO works.

### 7.17 Real NASA data — Inspiration4 crew reference (OSDR)
NASA's Open Science Data Repository (OSDR) hosts the first open human spaceflight dataset: the SpaceX Inspiration4 crew (2021, 3-day mission), with blood panels and physiologic measures before, during and after flight.
- The human team downloads the Inspiration4 clinical tables (complete blood count / metabolic panel) from OSDR — they sit in the I4 blood studies (OSD-569, -570, -571, -575; check which one holds the clinical lab tables) — and places the CSVs in `/public/data/osdr/`. The agent writes `scripts/buildOsdrReference.ts` that converts them into `src/data/osdr/i4Reference.json`: per analyte (e.g., glucose, white blood cell count), per timepoint (pre-flight → return), cohort mean and SD and n. Never plot individual crew members; show n on every point.
- Primary use (v3): **"Real astronaut evidence" cards** inside the Digital Twin's Blood/Immune sheet — a small chart per analyte showing how the real crew's values moved from pre-flight to return, with one plain sentence. Most of these lab values cannot be measured by HALO's user, so do not force them onto the user's trend charts.
- Secondary use: glucose is the one analyte the user also measures — on the glucose Trends chart only, a toggle **"Compare with real astronauts (Inspiration4, NASA OSDR)"** overlays the cohort ribbon. Label: "Cohort context, n = 4, 3-day mission, not a diagnosis."
- Learn cards cite the source (dataset name + OSDR) wherever this data is used.
- If the CSVs are missing, the toggle is hidden (no fake data).

### 7.18 Judge Mode — 90-second guided story
A button on the landing screen: **"▶ Watch HALO save a crew (90 s)"**. It loads the demo mission and plays a scripted, narrated tour (speechSynthesis + on-screen captions + an animated spotlight that highlights the element being described; user can Pause / Skip / Exit at any time):
1. (0–10 s) Starfield → "Day 142. Ares crew, 14 light-minutes from Earth. Autonomy level: AUTONOMOUS."
2. (10–25 s) Bridge: readiness ring animates from its mission-day-110 value to today's value; Digital Twin brain region turns ALERT. Caption explains: sleep under 6 h for 3 days + PVT slower than this astronaut's own baseline. **Every number in a caption is read live from the engine's output for the demo data — never hard-coded (v3).**
3. (25–40 s) Eyes region: new right-eye Amsler distortion → "possible SANS — request OCT review".
4. (40–55 s) Ground Link arc: an ALERT packet flies toward Earth with a 14-minute countdown (compressed). "The doctor won't see this for 14 minutes. HALO acts now."
5. (55–80 s) Simulated crewmate chest-pain event → Emergency mode opens, first two spoken steps play, CPR metronome preview with microgravity Evetts-Russomano diagram.
6. (80–90 s) Packet lands on Ground Console; flight-surgeon reply begins its 14-minute journey back. End card: "Try it yourself: scan your face →" (opens Camera Scan).
Judge Mode must work on a phone and a laptop, offline, with no setup. This is the first thing any judge opening the live link sees.

### 7.19 Priority if time runs short
MUST WIN (never cut): Rules engine + personal baseline · Camera HR with quality gate · Fingertip mode · Digital Twin Bridge · Emergency mode (patient picker, decision clock, chest pain + CPR, SBAR report) · Ground Link delay + split view · Demo mission · Judge Mode · Validation page · OSDR evidence cards.
CUT FIRST (in this order): badges → crew adherence page → Gravity Transition Check → bone estimate → GAD-2 → experimental respiration → Earth mode (§7.20).

### 7.20 Stretch — Earth mode (only after every MUST WIN works)
The challenge video asks how this could help remote communities on Earth. Add one more environment, `earth`: "Remote clinic (Earth)", gravity 1 g, radiation tracking hidden, equipment bpCuff / glucometer / thermometer / pulseOx, and the light-delay chip replaced by "Nearest doctor: N hours" (slider 1–12 h; autonomy level follows the same rules). Ground Console title becomes "District hospital". Hide space-only content (SANS context, microgravity CPR, SPE shelter). Same engine, same camera scan, same emergency coach. Keep it to configuration and labels — no new screens.
A smaller app where everything works beats a big app with one broken screen.

## 8. Build phases & acceptance criteria

**Phase 1 — Foundation.** Scaffold, Tailwind tokens, fonts, design components, routing for all pages (placeholders OK), Dexie schema, environments config, onboarding, top bar with light-delay chip, EMERGENCY button placeholder, PWA offline.
✅ App installs as PWA; reload with network disabled works; onboarding persists after refresh.

**Phase 2 — Rules engine + manual checks + Learn.** thresholds.ts, rules.ts, baseline.ts with full Vitest coverage; all §7.4 flows; Learn library.
✅ All boundary tests pass; entering BP 150/95 shows ALERT with a reason; 5 normal HR entries then 85 bpm (baseline 62 ± 3) shows WATCH "unusual for you".

**Phase 3 — Camera rPPG.** §7.3 fully, worker-based, with synthetic-signal tests.
✅ Synthetic tests within ±2 bpm; on a real face in good light the reading is within ±5 bpm of a pulse oximeter; covering the camera or moving shows POOR and saves nothing.

**Phase 4 — PVT-B + Amsler + Gravity Transition Check.**
✅ PVT runs exactly 3 min with correct lapse/false-start counting (unit-tested scoring); Amsler grid measures 10 cm with a ruler after calibration.

**Phase 5 — Bridge, Digital Twin, readiness, radiation/bone, scheduler, gamification.**
✅ Clicking each body region opens its sheet; region colours match latest statuses; readiness breakdown sums correctly.

**Phase 6 — Emergency mode.**
✅ Voice speaks each step offline; metronome holds 110/min (measure 60 s); incident report generated and queued.

**Phase 7 — Ground Link, Ground Console, Trends, Demo mission.**
✅ With two windows open, an ALERT appears on /ground after the compressed delay; reply returns after the same delay; demo mission shows the injected stories flagged on Bridge and Trends.

**Phase 7.5 — Real data + Judge Mode.** §7.17 OSDR conversion script and overlay, §7.18 Judge Mode.
✅ Inspiration4 ribbon appears in Trends with n shown; Judge Mode plays start to finish in under 100 s on a phone with network disabled, and every step's spotlight lands on the right element.

**Phase 8 — Polish & Validation page.** Animations, empty states, loading states, reduced motion, accessibility pass (keyboard, aria labels, contrast), Validation page, README with screenshots and architecture diagram, Lighthouse PWA + performance ≥ 90.
