import { db, type CrewMember, type MissionConfig, type ScheduledTask, type HealthReading, type GroundPacket } from '../db';
import {
  classifySleep,
  classifyBloodPressure,
  classifyPvt,
  classifyAmsler,
  classifyRadiation,
  classifyHeartRate,
  classifySpO2,
  classifyTemperature,
  classifyGlucose,
} from '../../config/thresholds';

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 * Ensures reproducible 142-day telemetry for demo and testing without external math libraries.
 */
function createSeededRng(seed: number) {
  let s = seed;
  return function nextFloat(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedDemoMission(): Promise<void> {
  // Clear previous data for a clean demo state
  await db.transaction(
    'rw',
    [
      db.crewMembers,
      db.missionConfig,
      db.tasks,
      db.healthReadings,
      db.baselines,
      db.groundPackets,
      db.incidentReports,
    ],
    async () => {
      await db.crewMembers.clear();
      await db.missionConfig.clear();
      await db.tasks.clear();
      await db.healthReadings.clear();
      await db.baselines.clear();
      await db.groundPackets.clear();
      await db.incidentReports.clear();

      const now = Date.now();
      const rng = createSeededRng(19690720); // Apollo 11 moon landing seed

      // 1. Seed Crew Members (Ares Transit - 4 crew per §7.15)
      const primaryCrew: CrewMember = {
        name: 'Dr. Alex Vance',
        callSign: 'AEGIS',
        age: 38,
        sex: 'M',
        role: 'Crew Medical Officer / Flight Surgeon',
        isCmo: true,
        isCurrent: true,
        createdAt: now,
      };

      const crewList: Omit<CrewMember, 'id'>[] = [
        primaryCrew,
        {
          name: 'Cdr. Sarah Chen',
          callSign: 'POLARIS',
          age: 44,
          sex: 'F',
          role: 'Mission Commander',
          isCmo: false,
          isCurrent: false,
          createdAt: now,
        },
        {
          name: 'Marcus Bell',
          callSign: 'VULCAN',
          age: 35,
          sex: 'M',
          role: 'Flight Engineer & EVA Specialist',
          isCmo: false,
          isCurrent: false,
          createdAt: now,
        },
        {
          name: 'Dr. Elena Rostova',
          callSign: 'AURORA',
          age: 32,
          sex: 'F',
          role: 'Science Specialist & Astrobiologist',
          isCmo: false,
          isCurrent: false,
          createdAt: now,
        },
      ];

      const crewIds = await db.crewMembers.bulkAdd(crewList, { allKeys: true });
      const currentCrewId = crewIds[0] as number;

      // 2. Mission Config: Ares Transit — Day 142, 14 min delay (846s)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 141); // Exactly Day 142 today
      const startDateStr = startDate.toISOString().split('T')[0];

      const missionConfig: MissionConfig = {
        id: 'current',
        missionName: 'Ares V Mars Transit',
        environmentId: 'transit',
        oneWayDelaySeconds: 846, // 14 min 06 s
        missionStartDate: startDateStr,
        missionDay: 142,
        timeCompression: true, // Default ON for demo mission (§7.12)
        dosimeterDoseMsv: 255.6, // 142 days * 1.8 mSv/day (42.6% of 600 mSv career limit)
        customNotes:
          'SIMULATED DATA: Ares transit cruise phase. Planetary alignment propagation latency: 14 min 06 s.',
        updatedAt: now,
      };

      await db.missionConfig.put(missionConfig);

      // 3. Baselines for current crew member (Alex Vance)
      await db.baselines.bulkAdd([
        { crewMemberId: currentCrewId, indicator: 'heart_rate', mean: 64, sd: 5, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'systolic_bp', mean: 114, sd: 6, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'diastolic_bp', mean: 74, sd: 5, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'spo2', mean: 98, sd: 1, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'temperature', mean: 36.6, sd: 0.2, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'glucose', mean: 92, sd: 8, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'sleep', mean: 7.4, sd: 0.6, sampleCount: 20, updatedAt: now },
        { crewMemberId: currentCrewId, indicator: 'pvt_speed', mean: 4.2, sd: 0.3, sampleCount: 20, updatedAt: now },
      ]);

      // 4. Tasks for Day 142
      const tasks: ScheduledTask[] = [
        {
          crewMemberId: currentCrewId,
          taskType: 'camera_hr',
          title: 'Morning Contactless HR Scan (rPPG)',
          frequency: 'daily',
          dueDay: 142,
          status: 'pending',
          xpAwarded: 50,
        },
        {
          crewMemberId: currentCrewId,
          taskType: 'mood_sleep',
          title: 'Sleep Log & Fatigue Assessment',
          frequency: 'daily',
          dueDay: 142,
          status: 'completed',
          completedAt: now - 3600000 * 2,
          xpAwarded: 25,
        },
        {
          crewMemberId: currentCrewId,
          taskType: 'pvt',
          title: 'Psychomotor Vigilance Test (PVT-B)',
          frequency: 'daily',
          dueDay: 142,
          status: 'pending',
          xpAwarded: 75,
        },
        {
          crewMemberId: currentCrewId,
          taskType: 'bp',
          title: 'Resting Blood Pressure Cuff Check',
          frequency: '3_days',
          dueDay: 142,
          status: 'pending',
          xpAwarded: 35,
        },
        {
          crewMemberId: currentCrewId,
          taskType: 'amsler',
          title: 'Amsler Grid Vision Check (SANS Screening)',
          frequency: 'weekly',
          dueDay: 142,
          status: 'pending',
          xpAwarded: 40,
        },
      ];

      await db.tasks.bulkAdd(tasks);

      // 5. Deterministic 142-day Historical Telemetry Generation (§7.15):
      // Generates plausible daily records for Days 1 to 142 with injected clinical stories:
      // - Story 1: Sleep declining to ~5.5h in days 120-140 with 3+ consecutive days < 6h -> sleep = ALERT
      // - Story 2: PVT slowing > 20% vs baseline in days 120-142 -> PVT = ALERT
      // - Story 3: BP drifting upward last 10 days (days 133-142, 126/78 mmHg) -> at least WATCH
      // - Story 4: One new Amsler distortion in right eye on day 135 -> ALERT
      // - Story 5: Cumulative radiation: 255.6 mSv (42.6% of career limit) -> NOMINAL
      // - Story 6: Scheduled Solar Particle Event (SPE) advisory in mission plan
      const allReadings: HealthReading[] = [];

      for (let day = 1; day <= 142; day++) {
        const dayOffsetMs = (142 - day) * 86400000;
        const dayTimestamp = now - dayOffsetMs;

        // Sleep generation
        let sleepHours: number;
        let consecutiveUnder6 = 0;
        if (day < 120) {
          sleepHours = Math.round((7.2 + (rng() * 0.8 - 0.4)) * 10) / 10;
        } else if (day < 139) {
          // Decline from 6.5h down to 5.6h
          const progress = (day - 120) / 19;
          sleepHours = Math.round((6.5 - progress * 1.0 + (rng() * 0.4 - 0.2)) * 10) / 10;
          consecutiveUnder6 = Math.min(day - 120 + 1, 5);
        } else {
          // Days 140, 141, 142: exactly 5.4 - 5.5 hours, 3+ consecutive days under 6h
          sleepHours = 5.5;
          consecutiveUnder6 = 3;
        }
        const sleepEval = classifySleep(sleepHours, { consecutiveDaysUnder6: consecutiveUnder6 });
        allReadings.push({
          crewMemberId: currentCrewId,
          timestamp: dayTimestamp + 3600000 * 7, // 07:00 morning log
          missionDay: day,
          indicator: 'sleep',
          value: sleepHours,
          unit: 'hours',
          status: sleepEval.status,
          reasons: sleepEval.reasons,
          source: 'manual',
          notes: 'SIMULATED DATA: Astronaut morning sleep duration log.',
        });

        // PVT Response Speed generation
        let pvtSpeed: number;
        if (day < 120) {
          pvtSpeed = Math.round((4.2 + (rng() * 0.3 - 0.15)) * 100) / 100;
        } else {
          // Slowing down to 3.2 (23.8% slower than baseline 4.2 -> ALERT)
          const factor = Math.min(1, (day - 120) / 20);
          pvtSpeed = Math.round((4.2 - factor * 1.0 + (rng() * 0.1 - 0.05)) * 100) / 100;
        }
        if (day === 142) pvtSpeed = 3.2; // explicitly 3.2 on day 142
        const pvtEval = classifyPvt(pvtSpeed, 4.2);
        allReadings.push({
          crewMemberId: currentCrewId,
          timestamp: dayTimestamp + 3600000 * 8, // 08:00
          missionDay: day,
          indicator: 'pvt',
          value: pvtSpeed,
          unit: 'speed (1/s)',
          status: pvtEval.status,
          reasons: pvtEval.reasons,
          source: 'pvt',
          notes: 'SIMULATED DATA: 3-minute PVT-B cognitive reaction assessment.',
        });

        // Heart Rate generation
        let hrBpm: number;
        if (day < 120) {
          hrBpm = Math.round(64 + (rng() * 8 - 4));
        } else {
          // Slight autonomic drift with fatigue (68–74 bpm)
          hrBpm = Math.round(68 + (rng() * 8 - 2));
        }
        const hrEval = classifyHeartRate(hrBpm);
        allReadings.push({
          crewMemberId: currentCrewId,
          timestamp: dayTimestamp + 3600000 * 8.5,
          missionDay: day,
          indicator: 'heart_rate',
          value: hrBpm,
          unit: 'bpm',
          status: hrEval.status,
          reasons: hrEval.reasons,
          source: 'camera',
          quality: 'GOOD',
          notes: 'SIMULATED DATA: Contactless facial rPPG resting heart rate scan.',
        });

        // Blood Pressure (sampled every 3 days + daily in last 10 days)
        if (day % 3 === 0 || day >= 132) {
          let sys: number;
          let dia: number;
          if (day < 132) {
            sys = Math.round(114 + (rng() * 6 - 3));
            dia = Math.round(74 + (rng() * 4 - 2));
          } else {
            // Upward drift in days 133-142 -> 126/78 mmHg (WATCH)
            sys = Math.round(124 + (rng() * 4));
            dia = Math.round(76 + (rng() * 4));
          }
          if (day === 142) {
            sys = 126;
            dia = 78;
          }
          const bpEval = classifyBloodPressure(sys, dia);
          allReadings.push({
            crewMemberId: currentCrewId,
            timestamp: dayTimestamp + 3600000 * 9,
            missionDay: day,
            indicator: 'blood_pressure',
            value: { systolic: sys, diastolic: dia },
            unit: 'mmHg',
            status: bpEval.status,
            reasons: bpEval.reasons,
            source: 'manual',
            notes: 'SIMULATED DATA: Resting brachial blood pressure cuff reading.',
          });
        }

        // SpO2 (sampled every 3 days)
        if (day % 3 === 0 || day === 142) {
          const spo2Val = Math.round(98 + (rng() * 2 - 1));
          const spo2Eval = classifySpO2(spo2Val);
          allReadings.push({
            crewMemberId: currentCrewId,
            timestamp: dayTimestamp + 3600000 * 9.5,
            missionDay: day,
            indicator: 'spo2',
            value: spo2Val,
            unit: '%',
            status: spo2Eval.status,
            reasons: spo2Eval.reasons,
            source: 'manual',
            notes: 'SIMULATED DATA: Pulse oximetry finger sensor.',
          });
        }

        // Temperature (weekly or day 142)
        if (day % 7 === 0 || day === 142) {
          const tempVal = Math.round((36.6 + (rng() * 0.4 - 0.2)) * 10) / 10;
          const tempEval = classifyTemperature(tempVal);
          allReadings.push({
            crewMemberId: currentCrewId,
            timestamp: dayTimestamp + 3600000 * 10,
            missionDay: day,
            indicator: 'temperature',
            value: tempVal,
            unit: '°C',
            status: tempEval.status,
            reasons: tempEval.reasons,
            source: 'manual',
            notes: 'SIMULATED DATA: Core tympanic body temperature.',
          });
        }

        // Glucose (weekly or day 142)
        if (day % 7 === 0 || day === 142) {
          const gluVal = Math.round(92 + (rng() * 12 - 6));
          const gluEval = classifyGlucose(gluVal, false);
          allReadings.push({
            crewMemberId: currentCrewId,
            timestamp: dayTimestamp + 3600000 * 11,
            missionDay: day,
            indicator: 'glucose',
            value: gluVal,
            unit: 'mg/dL',
            status: gluEval.status,
            reasons: gluEval.reasons,
            source: 'manual',
            notes: 'SIMULATED DATA: Fasting capillary blood glucose check.',
          });
        }
      }

      // Amsler Grid checks:
      // Normal baseline checks on day 7, 30, 60, 90, 120
      for (const d of [7, 30, 60, 90, 120]) {
        const dOffset = (142 - d) * 86400000;
        allReadings.push({
          crewMemberId: currentCrewId,
          timestamp: now - dOffset,
          missionDay: d,
          indicator: 'amsler',
          value: { eye: 'both', newDistortionCount: 0 },
          unit: 'grid',
          status: 'NOMINAL',
          reasons: ['No visual metamorphopsia or central scotoma detected'],
          source: 'amsler',
          notes: 'SIMULATED DATA: Routine Amsler grid self-screening.',
        });
      }

      // Injected Story: Day 135 Right Eye new distortion (ALERT per §7.15)
      const amslerEvalDay135 = classifyAmsler(true, true);
      allReadings.push({
        crewMemberId: currentCrewId,
        timestamp: now - (142 - 135) * 86400000,
        missionDay: 135,
        indicator: 'amsler',
        value: { eye: 'right', newDistortionCount: 1, location: 'inferonasal' },
        unit: 'grid',
        status: amslerEvalDay135.status,
        reasons: amslerEvalDay135.reasons,
        source: 'amsler',
        notes: 'SIMULATED DATA: New central metamorphopsia logged in right eye. SANS evaluation recommended.',
      });

      // Radiation Cumulative reading on Day 142: 255.6 mSv (42.6% of career limit -> NOMINAL)
      const radEval = classifyRadiation(255.6);
      allReadings.push({
        crewMemberId: currentCrewId,
        timestamp: now,
        missionDay: 142,
        indicator: 'radiation',
        value: 255.6,
        unit: 'mSv',
        status: radEval.status,
        reasons: radEval.reasons,
        source: 'calculated',
        notes: 'SIMULATED DATA: Curiosity RAD deep-space transit cumulative dosimeter record.',
      });

      await db.healthReadings.bulkAdd(allReadings);

      // 6. Ground Packets (§7.12, §7.15):
      // - Downlink: Emergency SBAR incident report from simulated crew event
      // - Downlink: Daily health & sleep telemetry summary packet
      // - Downlink: Alert packet for sleep debt & PVT slowing
      // - Uplink: Flight Surgeon morning advisory briefing
      const delayMs = 846 * (2000 / 60); // 28.2 s effective delay under 30x compression

      const initialPackets: Omit<GroundPacket, 'id'>[] = [
        // Outbox: SBAR Emergency Incident Report (Delivered)
        {
          direction: 'downlink',
          priority: 'HIGH',
          type: 'INCIDENT',
          title: 'SBAR Incident: Acute Retrosternal Discomfort (Simulated)',
          payload: {
            summary:
              'Simulated acute substernal pressure in crewmate. Local HALO emergency protocol completed. Metronome CPR previewed; AED attached (no shock advised). Vitals stabilized.',
            missionDay: 142,
            environment: 'Deep Space Transit',
            sbar: {
              situation: {
                summary: 'Acute chest discomfort reported during morning maintenance.',
                missionDay: 142,
                durationSeconds: 310,
              },
              background: {
                patientAge: 38,
                patientSex: 'M',
                baselines: [
                  { indicator: 'heart_rate', label: 'HEART RATE', normal: '64 ± 5' },
                  { indicator: 'blood_pressure', label: 'BLOOD PRESSURE', normal: '114/74 ± 6' },
                ],
              },
              assessment: {
                redFlags: ['Substernal pressure sensation', 'Diaphoresis reported'],
                triageAnswers: { responsive: true, breathingNormally: true },
              },
              request: {
                immediateNeeds: ['Flight surgeon telemetry review', 'Cardiovascular protocol concurrence'],
                flightSurgeonAction: 'Review ECG & troponin telemetry when bandwidth permits.',
              },
            },
          },
          sentAt: now - 3600000,
          arrivalAt: now - 3600000 + delayMs,
          delivered: true,
          read: true,
        },

        // Outbox: Alert Telemetry Packet (Delivered)
        {
          direction: 'downlink',
          priority: 'HIGH',
          type: 'ALERT',
          title: 'ALERT: Sleep Debt & PVT Response Slowing (Day 142)',
          payload: {
            crew: 'Dr. Alex Vance',
            missionDay: 142,
            indicator: 'sleep',
            value: 5.5,
            pvtSpeed: 3.2,
            note: 'Consecutive nights < 6h. PVT reaction speed slowed by 23.8% relative to personal baseline.',
            summary: 'Sleep debt ALERT flagged by rules engine. Cognitive vigilance lapse threshold exceeded.',
          },
          sentAt: now - 1800000,
          arrivalAt: now - 1800000 + delayMs,
          delivered: true,
          read: true,
        },

        // Outbox: Daily Telemetry Summary (Delivered)
        {
          direction: 'downlink',
          priority: 'NORMAL',
          type: 'SUMMARY',
          title: 'Ares Transit Daily Biometrics & Radiation Summary (Day 142)',
          payload: {
            missionDay: 142,
            crewCount: 4,
            cumulativeRadiationMsv: 255.6,
            summary: 'Daily health check-in complete. 3 of 4 crew nominal. CMO Alex Vance managing sleep fatigue.',
          },
          sentAt: now - 900000,
          arrivalAt: now - 900000 + delayMs,
          delivered: true,
          read: true,
        },

        // Inbox: Flight Surgeon Morning Briefing (Delivered)
        {
          direction: 'uplink',
          priority: 'NORMAL',
          type: 'REPLY',
          title: 'Flight Surgeon Morning Briefing (Earth → Ship)',
          payload: {
            author: 'Dr. Evelyn Reed (Lead Flight Surgeon, NASA JSC)',
            message:
              'Ares crew: Solar forecast is clear for the next 72 hours. We acknowledge telemetry for Day 142. Note CMO Vance sleep logs: authorize 0.5 mg melatonin and enforce scheduled 8-hour crew sleep window.',
            sentAtDate: new Date(now - 1200000).toISOString(),
          },
          sentAt: now - 1200000,
          arrivalAt: now - 1200000 + delayMs,
          delivered: true,
          read: false,
        },
      ];

      await db.groundPackets.bulkAdd(initialPackets as GroundPacket[]);
    }
  );
}
