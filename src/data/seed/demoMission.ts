import { db, type CrewMember, type MissionConfig, type ScheduledTask, type HealthReading } from '../db';
import { classifySleep, classifyBloodPressure, classifyPvt, classifyAmsler, classifyRadiation } from '../../config/thresholds';

export async function seedDemoMission(): Promise<void> {
  // Clear previous data for a clean demo state
  await db.transaction('rw', [db.crewMembers, db.missionConfig, db.tasks, db.healthReadings, db.baselines, db.groundPackets], async () => {
    await db.crewMembers.clear();
    await db.missionConfig.clear();
    await db.tasks.clear();
    await db.healthReadings.clear();
    await db.baselines.clear();
    await db.groundPackets.clear();

    const now = Date.now();

    // 1. Seed Crew Members (Ares Transit - 4 crew)
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

    // 2. Mission Config: Ares Transit — Day 142, 14 min delay
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 141); // Exactly Day 142
    const startDateStr = startDate.toISOString().split('T')[0];

    const missionConfig: MissionConfig = {
      id: 'current',
      missionName: 'Ares V Mars Transit',
      environmentId: 'transit',
      oneWayDelaySeconds: 846, // 14 min 06 s
      missionStartDate: startDateStr,
      missionDay: 142,
      timeCompression: true,
      dosimeterDoseMsv: 255.6, // ~142 days * 1.8 mSv/day (42.6% of 600 mSv)
      customNotes: 'SIMULATED DATA: Deep space transit cruise phase. Planetary alignment latency 14 min 06 s.',
      updatedAt: now,
    };

    await db.missionConfig.put(missionConfig);

    // 3. Baselines for current crew member
    await db.baselines.bulkAdd([
      { crewMemberId: currentCrewId, indicator: 'heart_rate', mean: 64, sd: 5, sampleCount: 15, updatedAt: now },
      { crewMemberId: currentCrewId, indicator: 'systolic_bp', mean: 114, sd: 6, sampleCount: 15, updatedAt: now },
      { crewMemberId: currentCrewId, indicator: 'diastolic_bp', mean: 74, sd: 5, sampleCount: 15, updatedAt: now },
      { crewMemberId: currentCrewId, indicator: 'spo2', mean: 98, sd: 1, sampleCount: 15, updatedAt: now },
      { crewMemberId: currentCrewId, indicator: 'temperature', mean: 36.6, sd: 0.2, sampleCount: 15, updatedAt: now },
      { crewMemberId: currentCrewId, indicator: 'sleep', mean: 7.4, sd: 0.6, sampleCount: 15, updatedAt: now },
      { crewMemberId: currentCrewId, indicator: 'pvt_speed', mean: 4.2, sd: 0.3, sampleCount: 15, updatedAt: now },
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
        title: 'Sleep Log & Mood Assessment',
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

    // 5. Injected stories per §7.15 (v3):
    // - Sleep declining to ~5.5h in days 120-140 with 3+ consecutive days < 6h -> sleep = ALERT
    // - PVT slowing by > 20% vs baseline -> PVT = ALERT
    // - BP drifting upward last 10 days (126/78 mmHg) -> at least WATCH
    // - One new Amsler distortion in right eye on day 135 -> ALERT
    // - Cumulative radiation: 255.6 mSv (42.6% of career limit) -> NOMINAL
    const sleepEval = classifySleep(5.5, { consecutiveDaysUnder6: 3 });
    const pvtEval = classifyPvt(3.2, 4.2); // (4.2 - 3.2)/4.2 = 23.8% slowdown -> ALERT
    const bpEval = classifyBloodPressure(126, 78); // 126/78 -> WATCH
    const amslerEval = classifyAmsler(true, true); // new distortion -> ALERT
    const radEval = classifyRadiation(255.6); // NOMINAL

    const readings: HealthReading[] = [
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 3,
        missionDay: 142,
        indicator: 'sleep',
        value: 5.5,
        unit: 'hours',
        status: sleepEval.status,
        reasons: sleepEval.reasons,
        source: 'manual',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 4,
        missionDay: 142,
        indicator: 'pvt',
        value: 3.2,
        unit: 'speed (1/s)',
        status: pvtEval.status,
        reasons: pvtEval.reasons,
        source: 'pvt',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 5,
        missionDay: 142,
        indicator: 'blood_pressure',
        value: { systolic: 126, diastolic: 78 },
        unit: 'mmHg',
        status: bpEval.status,
        reasons: bpEval.reasons,
        source: 'manual',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 24 * 7, // day 135
        missionDay: 135,
        indicator: 'amsler',
        value: { eye: 'right', newDistortionCount: 1 },
        unit: 'grid',
        status: amslerEval.status,
        reasons: amslerEval.reasons,
        source: 'amsler',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 18,
        missionDay: 141,
        indicator: 'heart_rate',
        value: 68,
        unit: 'bpm',
        status: 'NOMINAL',
        reasons: ['Within nominal clinical resting limits (50–100 bpm)'],
        source: 'camera',
        quality: 'GOOD',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 18,
        missionDay: 141,
        indicator: 'spo2',
        value: 98,
        unit: '%',
        status: 'NOMINAL',
        reasons: ['Normal oxygenation in cabin atmosphere (≥ 95%)'],
        source: 'manual',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now,
        missionDay: 142,
        indicator: 'radiation',
        value: 255.6,
        unit: 'mSv',
        status: radEval.status,
        reasons: radEval.reasons,
        source: 'calculated',
      },
    ];

    await db.healthReadings.bulkAdd(readings);

    // 6. Ground packet demo
    await db.groundPackets.add({
      direction: 'uplink',
      priority: 'NORMAL',
      type: 'SUMMARY',
      title: 'Flight Surgeon Morning Briefing (Earth → Ship)',
      payload: {
        author: 'Dr. M. Stone, NASA Johnson Space Center',
        message: 'Ares crew: Radiation forecast nominal for next 48h. Keep up resistance training.',
      },
      sentAt: now - 1800000,
      arrivalAt: now - 954000,
      delivered: true,
      read: false,
    });
  });
}
