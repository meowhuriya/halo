# HALO — Health Autonomy for Long-duration Operations

**NASA Space Apps Challenge 2026 · Challenge: "Health monitoring software for astronauts" (Brazilian Space Agency)**

**Live app:** https://halo-meowenor.vercel.app/
**Team:** _TEAM NAME_ · Hyderabad, India

> On a Mars mission the flight surgeon is up to 22 light-minutes away. HALO is an offline-first health co-pilot that lets astronauts measure, understand and act on their own health — and talks the crew through an emergency when Earth cannot answer in time.

> ⚠️ Prototype built for NASA Space Apps. **Not a medical device.** Readings are estimates; all demo-mission data is simulated and labelled as such.

---

## What it does

| Feature | Description |
|---|---|
| **Bridge + Digital Twin** | A glowing human figure with clickable regions (Brain, Eyes, Heart, Lungs, Blood, Bones, Radiation). Each region shows status as colour **+ icon + word** (NOMINAL / WATCH / ALERT / CRITICAL), how spaceflight affects that system, and what to do. |
| **Heart rate from the camera** | **Fingertip mode** (finger over the rear camera): remote photoplethysmography with a Butterworth band-pass, zero-padded FFT and an SNR quality gate. **Face mode** (contactless, MediaPipe face landmarks + POS algorithm) is included as *experimental*. If signal quality is poor, HALO shows *no reading* instead of guessing. |
| **Guided checks** | Blood pressure, SpO₂, temperature, glucose, respiratory rate (built-in tap counter), sleep, mood, PHQ-2/GAD-2 — each with a "how to measure / why it matters in space / what to do" card. |
| **"Unusual for *you*"** | Every value is judged against clinical ranges **and** the astronaut's own baseline (z-score, per-indicator SD floors, 7-day trend). Every flag carries a plain-English reason. No black-box model decides anyone's health. |
| **PVT-B cognition test** | The 3-minute psychomotor vigilance test used in NASA's Cognition battery, timed with `requestAnimationFrame` onsets; detects fatigue before you feel it. |
| **Amsler grid** | Screen-calibrated (bank-card width) vision self-check for SANS; compares each eye with its previous map. |
| **Readiness score** | One number with a visible breakdown: GO / GO WITH CAUTION / HOLD. |
| **Radiation + storm shelter** | Cumulative dose vs the 600 mSv career limit; Solar Particle Event shelter protocol. |
| **Emergency mode** | One red button. "Who needs help?" → decision clock (*earliest answer from Earth = 2 × light delay* vs *time since event*) → voice-guided, captioned protocols: CPR coach with a 110/min metronome and microgravity positions (restraint, Evetts-Russomano, handstand), chest-pain triage with red-flag logic, toxic atmosphere, radiation storm. Ends with an auto-generated **SBAR** handover report. |
| **Ground Link** | Alerts and reports travel to a simulated flight-surgeon console with a real (time-compressed) light delay; replies come back the same way. `/split` shows ship and Earth side by side. |
| **Environments** | ISS, Mars transit, Moon base, Mars base, rover — each changes gravity, light delay, radiation rate, available equipment and the autonomy level. |
| **Offline-first PWA** | All models, fonts and WASM are bundled. No runtime network calls. |

## NASA resources used

- **NASA Human Research Program — the five hazards of spaceflight** (radiation, isolation and confinement, distance from Earth, gravity fields, hostile closed environments) structure the Digital Twin, the Learn library and the environment profiles.
- **NASA Cognition battery / PVT-B** — the reaction-time test is rebuilt after the published PVT-B protocol.
- **NASA career radiation limit (600 mSv, 2022)** and published dose rates (Curiosity RAD, Chang'e-4 LND) drive the radiation panel.
- **SANS** findings from long-duration ISS crews motivate the Amsler screen.
- NASA Open Science Data Repository (Inspiration4) was studied for inspiration; its clinical data is not yet integrated.

## Validation

Camera heart rate vs reference device (counted wrist pulse / pulse oximeter), collected during the hackathon:

| Readings (n) | Mean abs. error | Within ±5 bpm |
|---|---|---|
| _N_ | _X.X bpm_ | _Y %_ |

_Fill in from the app's Validation page before submission. Report face mode and fingertip mode separately._

## Run it locally

```bash
npm install
npm run build && npm run preview   # offline/PWA behaviour only works on the built app
npm run test                       # Vitest: thresholds, baseline, DSP, PVT scoring, emergency logic, demo seed
```
Open the printed URL in **Chrome** (camera, speech and the metronome were tested there). The camera needs `localhost` or HTTPS.

## Architecture

```
src/
  config/      environments, clinical thresholds (exact table in HALO_SPEC.md §6)
  engine/      rules (absolute + personal-baseline status), readiness, scheduler
  sensors/rppg capture → ROI → POS → band-pass → FFT → SNR gate (Web Worker)
  features/    bridge, scan, checks, cognition, vision, emergency, groundlink, learn, validation
  data/        Dexie (IndexedDB) schema + deterministic demo mission
```
Stack: Vite · React 18 · TypeScript · Tailwind · Dexie · MediaPipe Tasks Vision · Web Speech API · Vitest.

## Use of AI

AI coding assistants (Google Antigravity with Gemini and Claude models, and Anthropic's Claude) were used to generate and refactor code, tests and documentation from a human-written specification (`HALO_SPEC.md`). All medical thresholds were specified by the team, every feature was reviewed and tested by the team, and the voice in Emergency mode is the device's own text-to-speech. No AI-generated images or NASA branding are used.

## Honest limits

- Prototype only; not validated for clinical use.
- Face-mode heart rate is experimental and often rejected by the quality gate; fingertip mode is the recommended method.
- The camera does **not** estimate blood pressure, SpO₂, HRV or stress — a 30 fps webcam cannot do these reliably.
- No drug names or doses are hard-coded; emergency steps defer to the onboard medical checklist and flight surgeon.

## Licence

MIT
