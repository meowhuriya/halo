import Dexie, { type Table } from 'dexie';
import type { EnvironmentId } from '../config/environments';

export type HealthStatus = 'NOMINAL' | 'WATCH' | 'ALERT' | 'CRITICAL';

export interface CrewMember {
  id?: number;
  name: string;
  callSign: string;
  age: number;
  sex: 'M' | 'F' | 'Other';
  role: string;
  isCmo: boolean;
  isCurrent: boolean;
  avatarUrl?: string;
  createdAt: number;
}

export interface MissionConfig {
  id: string; // 'current'
  missionName: string;
  environmentId: EnvironmentId;
  oneWayDelaySeconds: number;
  missionStartDate: string; // YYYY-MM-DD
  missionDay: number;
  timeCompression: boolean; // 1 min light delay = 2s real time for demo
  dosimeterDoseMsv?: number;
  customNotes?: string;
  updatedAt: number;
}

export interface HealthReading {
  id?: number;
  crewMemberId: number;
  timestamp: number;
  missionDay: number;
  indicator: 
    | 'heart_rate' 
    | 'blood_pressure' 
    | 'spo2' 
    | 'temperature' 
    | 'glucose' 
    | 'respiratory_rate' 
    | 'sleep' 
    | 'mood' 
    | 'phq2' 
    | 'gad2' 
    | 'pvt' 
    | 'amsler' 
    | 'orthostatic' 
    | 'radiation';
  value: number | string | Record<string, unknown>;
  unit: string;
  status: HealthStatus;
  reasons: string[];
  source: 'camera' | 'manual' | 'pvt' | 'amsler' | 'calculated';
  quality?: 'GOOD' | 'FAIR' | 'POOR';
  snrDb?: number;
  motionScore?: number;
  notes?: string;
}

export interface PersonalBaseline {
  id?: number;
  crewMemberId: number;
  indicator: string;
  mean: number;
  sd: number;
  sampleCount: number;
  updatedAt: number;
}

export interface ScheduledTask {
  id?: number;
  crewMemberId: number;
  taskType: 'mood_sleep' | 'camera_hr' | 'pvt' | 'bp' | 'phq2_gad2' | 'amsler' | 'glucose' | 'exercise';
  title: string;
  frequency: 'daily' | '3_days' | 'weekly';
  dueDay: number;
  status: 'pending' | 'completed' | 'overdue';
  completedAt?: number;
  xpAwarded: number;
}

export interface GroundPacket {
  id?: number;
  direction: 'downlink' | 'uplink'; // downlink: to earth, uplink: to halo
  priority: 'NORMAL' | 'HIGH';
  type: 'ALERT' | 'INCIDENT' | 'SUMMARY' | 'REPLY';
  title: string;
  payload: Record<string, unknown>;
  sentAt: number;
  arrivalAt: number;
  delivered: boolean;
  read: boolean;
}

export interface IncidentReport {
  id?: number;
  timestamp: number;
  missionDay: number;
  emergencyType: 'CPR' | 'CHEST_PAIN' | 'TOXIC_BREATHING' | 'SOLAR_STORM';
  summary: string;
  timeline: Array<{ time: number; event: string }>;
  vitalsCaptured: Record<string, unknown>;
  status: 'resolved' | 'ongoing';
}

export class HaloDatabase extends Dexie {
  crewMembers!: Table<CrewMember>;
  missionConfig!: Table<MissionConfig>;
  healthReadings!: Table<HealthReading>;
  baselines!: Table<PersonalBaseline>;
  tasks!: Table<ScheduledTask>;
  groundPackets!: Table<GroundPacket>;
  incidentReports!: Table<IncidentReport>;

  constructor() {
    super('halo_mission_db');
    this.version(1).stores({
      crewMembers: '++id, name, isCurrent, role, isCmo',
      missionConfig: 'id',
      healthReadings: '++id, timestamp, crewMemberId, indicator, status, source, missionDay',
      baselines: '++id, [crewMemberId+indicator], indicator, crewMemberId',
      tasks: '++id, crewMemberId, dueDay, status, taskType',
      groundPackets: '++id, direction, delivered, sentAt, arrivalAt, priority',
      incidentReports: '++id, timestamp, emergencyType, status'
    });
  }
}

export const db = new HaloDatabase();
