/**
 * High-precision Web Audio API CPR Metronome per HALO_SPEC §7.11:
 * - 110 compressions per minute (standard ERC/AHA resuscitation rate).
 * - Schedules audio clicks using the AudioContext clock (NOT setInterval) to prevent thread jitter.
 * - 30:2 compression-to-breath counter.
 */

export interface MetronomeTickEvent {
  compressionCount: number; // 1 to 30
  cycleCount: number; // 1, 2, 3...
  phase: 'compression' | 'breath';
  breathNumber?: 1 | 2;
  timestamp: number;
}

export type MetronomeTickCallback = (event: MetronomeTickEvent) => void;

export class CprMetronome {
  private audioCtx: AudioContext | null = null;
  private isRunningState = false;
  private isMuted = false;
  private lookaheadTimer: number | null = null;

  // 110 beats per minute
  public readonly tempoBpm = 110;
  private readonly intervalSec = 60 / 110; // ~0.54545 s

  // Audio scheduler state
  private nextBeatTime = 0;
  private currentCompression = 0;
  private currentCycle = 1;
  private phase: 'compression' | 'breath' = 'compression';
  private breathIndex = 0;

  private onTickCallback: MetronomeTickCallback | null = null;

  constructor(onTick?: MetronomeTickCallback) {
    if (onTick) {
      this.onTickCallback = onTick;
    }
  }

  public setOnTick(callback: MetronomeTickCallback): void {
    this.onTickCallback = callback;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public isRunning(): boolean {
    return this.isRunningState;
  }

  private initAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public start(): void {
    if (this.isRunningState) return;

    const ctx = this.initAudioContext();
    this.isRunningState = true;
    this.currentCompression = 0;
    this.currentCycle = 1;
    this.phase = 'compression';
    this.breathIndex = 0;

    const currentTime = ctx ? ctx.currentTime : Date.now() / 1000;
    this.nextBeatTime = currentTime + 0.05;

    this.runScheduler();
  }

  public stop(): void {
    this.isRunningState = false;
    if (this.lookaheadTimer !== null) {
      window.clearTimeout(this.lookaheadTimer);
      this.lookaheadTimer = null;
    }
    this.currentCompression = 0;
    this.phase = 'compression';
    this.breathIndex = 0;
  }

  public reset(): void {
    this.stop();
    this.currentCycle = 1;
  }

  private scheduleAudioClick(time: number, isAccent: boolean, isBreath: boolean): void {
    if (this.isMuted || !this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = isBreath ? 'sine' : 'triangle';
      // Pitch: 880 Hz standard, 1320 Hz on 30th compression, 520 Hz for breaths
      osc.frequency.setValueAtTime(isBreath ? 520 : isAccent ? 1320 : 880, time);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (isBreath ? 0.15 : 0.04));

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(time);
      osc.stop(time + (isBreath ? 0.16 : 0.05));
    } catch {
      // Audio playback fails gracefully if context was closed
    }
  }

  private runScheduler = (): void => {
    if (!this.isRunningState) return;

    const ctx = this.audioCtx;
    const currentTime = ctx ? ctx.currentTime : Date.now() / 1000;
    // Schedule ahead window (100 ms)
    const scheduleAheadTime = 0.12;

    while (this.nextBeatTime < currentTime + scheduleAheadTime) {
      if (this.phase === 'compression') {
        this.currentCompression += 1;
        const isAccent = this.currentCompression === 30 || this.currentCompression === 1;

        this.scheduleAudioClick(this.nextBeatTime, isAccent, false);

        if (this.onTickCallback) {
          this.onTickCallback({
            compressionCount: this.currentCompression,
            cycleCount: this.currentCycle,
            phase: 'compression',
            timestamp: Date.now(),
          });
        }

        if (this.currentCompression >= 30) {
          // Switch to breath phase
          this.phase = 'breath';
          this.breathIndex = 0;
          // Give 2 metronome beats pause for breath delivery (~2.2 s)
          this.nextBeatTime += this.intervalSec * 1.5;
        } else {
          this.nextBeatTime += this.intervalSec;
        }
      } else {
        // Breath phase: 2 rescue breaths
        this.breathIndex += 1;
        this.scheduleAudioClick(this.nextBeatTime, true, true);

        if (this.onTickCallback) {
          this.onTickCallback({
            compressionCount: 30,
            cycleCount: this.currentCycle,
            phase: 'breath',
            breathNumber: this.breathIndex as 1 | 2,
            timestamp: Date.now(),
          });
        }

        if (this.breathIndex >= 2) {
          // Breaths complete -> next compression cycle
          this.phase = 'compression';
          this.currentCompression = 0;
          this.currentCycle += 1;
          this.nextBeatTime += this.intervalSec * 1.8;
        } else {
          this.nextBeatTime += this.intervalSec * 2.2;
        }
      }
    }

    // High frequency scheduling loop check every 25ms
    this.lookaheadTimer = window.setTimeout(this.runScheduler, 25);
  };
}
