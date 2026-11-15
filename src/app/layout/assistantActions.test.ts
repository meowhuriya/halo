import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { parseReading, symptomAction, waitIntent, logSpokenReading } from './assistantActions';
import { db } from '../../data/db';

describe('assistant actions', () => {
  it('parses spoken readings', () => {
    expect(parseReading('my blood pressure is 128 over 82')).toEqual({ kind: 'blood_pressure', sys: 128, dia: 82 });
    expect(parseReading('log bp 120/80')).toEqual({ kind: 'blood_pressure', sys: 120, dia: 80 });
    expect(parseReading('I slept 5 and a half hours')).toEqual({ kind: 'sleep', value: 5.5 });
    expect(parseReading('temperature is 37.6')).toEqual({ kind: 'temperature', value: 37.6 });
    expect(parseReading('temp 99.5 fahrenheit')?.kind).toBe('temperature');
    expect(parseReading('oxygen 96 percent')).toEqual({ kind: 'spo2', value: 96 });
    expect(parseReading('sugar 110 after lunch')).toMatchObject({ kind: 'glucose', value: 110, postMeal: true });
    expect(parseReading('pulse 88')).toEqual({ kind: 'heart_rate', value: 88 });
    expect(parseReading('open the eye test')).toBeNull();
  });
  it('logs through the rules engine and saves a reading', async () => {
    const crewId = await db.crewMembers.add({ name: 'T', callSign: 'T', age: 30, sex: 'F', role: 'x', isCmo: false, isCurrent: true, createdAt: Date.now() } as never);
    const r = await logSpokenReading('my blood pressure is 150 over 95', crewId as number, 1, 0);
    expect(r?.logged).toBe(true);
    expect(r?.say).toMatch(/alert/i);
    const saved = await db.healthReadings.where('crewMemberId').equals(crewId as number).toArray();
    expect(saved.length).toBe(1);
    expect(saved[0].status).toBe('ALERT');
  });
  it('rejects nonsense values instead of saving them', async () => {
    const r = await logSpokenReading('pulse 999', 1, 1, 0);
    expect(r?.logged).toBeUndefined();
  });
  it('routes symptoms', () => {
    expect(symptomAction('my vision is bad')?.go).toBe('/vision');
    expect(symptomAction('I have chest pain')?.go).toBe('/emergency');
    expect(symptomAction('what is the delay')).toBeNull();
  });
  it('understands wait / stop / resume', () => {
    expect(waitIntent('wait')).toBe('wait');
    expect(waitIntent('hold on a second')).toBe('wait');
    expect(waitIntent('stop')).toBe('stop');
    expect(waitIntent("okay I'm back")).toBe('resume');
    expect(waitIntent('open trends')).toBeNull();
  });
});
