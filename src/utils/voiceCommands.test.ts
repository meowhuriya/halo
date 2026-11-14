import { describe, it, expect } from 'vitest';
import { matchIntent } from './voiceCommands';

describe('voice intents (emergency hands-free)', () => {
  it('maps unresponsive phrasing to NO before YES', () => {
    expect(matchIntent("no she's not breathing")).toBe('NO');
    expect(matchIntent('unresponsive')).toBe('NO');
    expect(matchIntent('he collapsed')).toBe('NO');
  });
  it('maps conscious phrasing to YES', () => {
    expect(matchIntent('yes he is awake')).toBe('YES');
    expect(matchIntent('breathing and talking')).toBe('YES');
  });
  it('maps symptoms', () => {
    expect(matchIntent('chest pain')).toBe('CHEST_PAIN');
    expect(matchIntent("there's smoke she can't breathe")).toBe('BREATHING');
    expect(matchIntent('radiation storm')).toBe('RADIATION');
  });
  it('maps control words', () => {
    expect(matchIntent('repeat')).toBe('REPEAT');
    expect(matchIntent('say that again')).toBe('REPEAT');
    expect(matchIntent('okay next')).toBe('NEXT');
  });
  it('maps who', () => {
    expect(matchIntent("it's me")).toBe('ME');
    expect(matchIntent('a crewmate')).toBe('CREWMATE');
  });
  it('returns null for noise', () => {
    expect(matchIntent('')).toBeNull();
    expect(matchIntent('the weather is nice')).toBeNull();
  });
});
