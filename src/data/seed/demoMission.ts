import { db, type CrewMember, type MissionConfig, type ScheduledTask, type HealthReading } from '../db';

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
      dosimeterDoseMsv: 255.6, // ~142 days * 1.8 mSv/day
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

    // 5. Sample recent health readings
    const readings: HealthReading[] = [
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 3,
        missionDay: 142,
        indicator: 'sleep',
        value: 5.6,
        unit: 'hours',
        status: 'WATCH',
        reasons: ['Sleep 5.6 h is below 6 h for consecutive nights (accumulating sleep debt)'],
        source: 'manual',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 18,
        missionDay: 141,
        indicator: 'heart_rate',
        value: 72,
        unit: 'bpm',
        status: 'NOMINAL',
        reasons: ['Within nominal clinical resting limits (50-100 bpm)'],
        source: 'camera',
        quality: 'GOOD',
      },
      {
        crewMemberId: currentCrewId,
        timestamp: now - 3600000 * 18,
        missionDay: 141,
        indicator: 'spo2',
        value: 97,
        unit: '%',
        status: 'NOMINAL',
        reasons: ['Normal oxygenation in cabin atmosphere'],
        source: 'manual',
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
