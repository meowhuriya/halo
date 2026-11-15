import { describe, it, expect } from 'vitest';
import { findTopic, answerQuestion } from './assistantBrain';

describe('assistant brain (offline Q&A)', () => {
  it('finds topics from everyday words', () => {
    expect(findTopic('what is sans')?.id).toBe('amsler');
    expect(findTopic('why does my pulse change in space')?.id).toBe('heart_rate');
    expect(findTopic('tell me about radiation')?.id).toBe('hazard_radiation');
    expect(findTopic('how is my blood sugar')?.id).toBe('glucose');
  });
  it('answers how-to, normal-range and why-in-space questions from the Learn library', async () => {
    const a = await answerQuestion('how do I measure blood pressure', undefined);
    expect(a?.say).toMatch(/cuff/i);
    const b = await answerQuestion('what is a normal temperature', undefined);
    expect(b?.say).toMatch(/36/);
    const c = await answerQuestion('why does sleep change in space', undefined);
    expect(c?.say.length).toBeGreaterThan(20);
  });
  it('reads the screen on request', async () => {
    const a = await answerQuestion('read this out loud', undefined, 'Readiness 72 percent. Two alerts.');
    expect(a?.say).toContain('Readiness 72');
  });
  it('returns null for pure navigation so commands still work', async () => {
    expect(await answerQuestion('open the bridge', undefined)).toBeNull();
  });
});
