import { describe, it, expect } from 'vitest';
import { ENVIRONMENTS } from '../../config/environments';
import type { CrewMember, HealthReading, MissionConfig, PersonalBaseline } from '../../data/db';
import {
  buildDigitalTwinTelemetry,
  computeCumulativeRadiationStatus,
} from './digitalTwin';

const BASE_CREW: CrewMember = {
  id: 1,
  name: 'Dr. Alex Vance',
  callSign: 'AEGIS',
  age: 38,
  sex: 'M',
  role: 'CMO',
  isCmo: true,
  isCurrent: true,
  createdAt: 1000,
};

const BASE_CONFIG: MissionConfig = {
  id: 'current',
  missionName: 'Ares V Mars Transit',
  environmentId: 'transit',
  oneWayDelaySeconds: 846,
  missionStartDate: '2026-01-01',
  missionDay: 142,
  timeCompression: true,
  dosimeterDoseMsv: 0,
  updatedAt: 1000,
};

describe('Digital Twin telemetry & Radiation engine per HALO_SPEC §7.2 & §7.8', () => {
  it('computes all 7 body regions cleanly and flags Demo-like stories via the rules engine', () => {
    const readings: HealthReading[] = [
      {
        crewMemberId: 1,
        timestamp: 1000,
        missionDay: 142,
        indicator: 'sleep',
        value: 5.5,
        unit: 'hours',
        status: 'ALERT',
        reasons: ['Sleep < 6 h for 3 consecutive days'],
        source: 'manual',
      },
      {
        crewMemberId: 1,
        timestamp: 1100,
        missionDay: 142,
        indicator: 'pvt',
        value: 3.2,
        unit: 'speed (1/s)',
        status: 'ALERT',
        reasons: ['PVT speed slowed by > 20% vs baseline'],
        source: 'pvt',
      },
      {
        crewMemberId: 1,
        timestamp: 1200,
        missionDay: 142,
        indicator: 'blood_pressure',
        value: { systolic: 126, diastolic: 78 },
        unit: 'mmHg',
        status: 'WATCH',
        reasons: ['Systolic BP 126 mmHg in elevated watch range'],
        source: 'manual',
      },
      {
        crewMemberId: 1,
        timestamp: 1300,
        missionDay: 135,
        indicator: 'amsler',
        value: { eye: 'right', newDistortionCount: 1 },
        unit: 'grid',
        status: 'ALERT',
        reasons: ['New visual distortion on Right eye'],
        source: 'amsler',
      },
      {
        crewMemberId: 1,
        timestamp: 1400,
        missionDay: 141,
        indicator: 'heart_rate',
        value: 68,
        unit: 'bpm',
        status: 'NOMINAL',
        reasons: ['Within nominal resting range'],
        source: 'camera',
        quality: 'GOOD',
      },
      {
        crewMemberId: 1,
        timestamp: 1500,
        missionDay: 141,
        indicator: 'spo2',
        value: 98,
        unit: '%',
        status: 'NOMINAL',
        reasons: ['Normal oxygenation'],
        source: 'manual',
      },
    ];

    const result = buildDigitalTwinTelemetry({
      crew: BASE_CREW,
      readings,
      baselines: [],
      tasks: [],
      config: BASE_CONFIG,
      environment: ENVIRONMENTS.transit,
    });

    expect(result.regionList).toHaveLength(7);
    expect(result.regions.brain.status).toBe('ALERT');
    expect(result.regions.eyes.status).toBe('ALERT');
    expect(result.regions.heart.status).toBe('WATCH');
    expect(result.regions.lungs.status).toBe('NOMINAL');
    expect(result.regions.blood.hasData).toBe(false);
    expect(result.regions.blood.status).toBeNull();
    expect(result.regions.bones.hasData).toBe(false);
    // 142 * 1.8 = 255.6 mSv -> 42.6% -> NOMINAL
    expect(result.regions.skin.status).toBe('NOMINAL');
    expect(result.radiation.doseMsv).toBe(255.6);
    expect(result.radiation.percentOfLimit).toBe(42.6);
    expect(result.alerts.map((a) => a.regionId)).toEqual(['brain', 'brain', 'eyes', 'heart']);
  });

  it('re-evaluates personal baseline z-score anomalies dynamically for Heart & Temperature', () => {
    const baselines: PersonalBaseline[] = [
      { crewMemberId: 1, indicator: 'heart_rate', mean: 62, sd: 3, sampleCount: 5, updatedAt: 1000 },
    ];
    const readings: HealthReading[] = [
      {
        crewMemberId: 1,
        timestamp: 2000,
        missionDay: 45,
        indicator: 'heart_rate',
        value: 85, // (85 - 62)/3 = +7.7 SD -> z >= 3 WATCH even though 85 <= 100 clinical!
        unit: 'bpm',
        status: 'NOMINAL',
        reasons: [],
        source: 'manual',
      },
    ];

    const result = buildDigitalTwinTelemetry({
      crew: BASE_CREW,
      readings,
      baselines,
      tasks: [],
      config: { ...BASE_CONFIG, missionDay: 45 },
      environment: ENVIRONMENTS.transit,
    });

    expect(result.regions.heart.status).toBe('WATCH');
    expect(result.regions.heart.reasons.some((r) => /unusual for you/i.test(r))).toBe(true);
  });

  it('triggers CRITICAL regions cleanly across vitals and overrides radiation dose when dosimeter entered', () => {
    const manualRad: HealthReading = {
      crewMemberId: 1,
      timestamp: 5000,
      missionDay: 142,
      indicator: 'radiation',
      value: 605,
      unit: 'mSv',
      status: 'CRITICAL',
      reasons: ['Dosimeter exceeds 600 mSv'],
      source: 'manual',
    };
    const lowSpo2: HealthReading = {
      crewMemberId: 1,
      timestamp: 5100,
      missionDay: 142,
      indicator: 'spo2',
      value: 88,
      unit: '%',
      status: 'NOMINAL', // deliberately stale/nominal stored to verify rules engine recomputes CRITICAL!
      reasons: [],
      source: 'manual',
    };

    const radSummary = computeCumulativeRadiationStatus(
      [manualRad],
      BASE_CONFIG,
      ENVIRONMENTS.transit
    );
    expect(radSummary.isManualOverride).toBe(true);
    expect(radSummary.doseMsv).toBe(605);
    expect(radSummary.status).toBe('CRITICAL');

    const twin = buildDigitalTwinTelemetry({
      crew: BASE_CREW,
      readings: [manualRad, lowSpo2],
      baselines: [],
      tasks: [],
      config: BASE_CONFIG,
      environment: ENVIRONMENTS.transit,
    });

    expect(twin.regions.skin.status).toBe('CRITICAL');
    expect(twin.regions.lungs.status).toBe('CRITICAL');
    expect(twin.alerts[0].status).toBe('CRITICAL');
  });

  it('ignores POOR quality camera readings so bad rPPG scans never color the Heart region', () => {
    const poorScan: HealthReading = {
      crewMemberId: 1,
      timestamp: 9000,
      missionDay: 10,
      indicator: 'heart_rate',
      value: 165,
      unit: 'bpm',
      status: 'CRITICAL',
      reasons: ['Bad scan'],
      source: 'camera',
      quality: 'POOR',
    };

    const twin = buildDigitalTwinTelemetry({
      crew: BASE_CREW,
      readings: [poorScan],
      baselines: [],
      tasks: [],
      config: { ...BASE_CONFIG, missionDay: 10 },
      environment: ENVIRONMENTS.iss,
    });

    expect(twin.regions.heart.hasData).toBe(false);
    expect(twin.regions.heart.status).toBeNull();
  });
});
