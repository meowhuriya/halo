import { describe, it, expect } from 'vitest';
import { planAssistantReply } from './VoiceAssistant';

const ctx = { readiness: 72, alerts: 2, delaySeconds: 846, missionDay: 142, envName: 'Mars transit', crewName: 'Alex Vance', unreadGround: 1 };

describe('HALO voice assistant', () => {
  it('opens the eye test', () => {
    expect(planAssistantReply('can you open the eye test', ctx).go).toBe('/vision');
  });
  it('starts a heart scan', () => {
    expect(planAssistantReply('start a heart scan', ctx).go).toBe('/scan');
  });
  it('reports readiness with band and alerts', () => {
    const a = planAssistantReply("how's my readiness", ctx);
    expect(a.say).toContain('72 percent');
    expect(a.say).toContain('caution');
    expect(a.say).toContain('2 active alerts');
  });
  it('reports the light delay', () => {
    expect(planAssistantReply('what is the delay to earth', ctx).say).toContain('14 minutes');
  });
  it('goes to emergency on collapse phrasing', () => {
    expect(planAssistantReply('he collapsed', ctx).go).toBe('/emergency');
  });
  it('explains itself when unsure', () => {
    expect(planAssistantReply('banana', ctx).say).toContain('You can say');
  });
});
