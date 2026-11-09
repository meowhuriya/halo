import type { HealthStatus } from '../data/db';

export interface RuleEvaluation {
  status: HealthStatus;
  reasons: string[];
}

/**
 * Foundation rule evaluator placeholder for Phase 1.
 * Will be fully expanded with all boundaries in Phase 2.
 */
export function evaluateVitalsStatus(indicator: string, value: number): RuleEvaluation {
  if (indicator === 'heart_rate') {
    if (value < 40 || value > 130) {
      return { status: 'CRITICAL', reasons: [`Heart rate ${value} bpm exceeds critical limits (<40 or >130)`] };
    }
    if (value >= 111 && value <= 130) {
      return { status: 'ALERT', reasons: [`Heart rate ${value} bpm in alert zone (111–130)`] };
    }
    if ((value >= 40 && value <= 49) || (value >= 101 && value <= 110)) {
      return { status: 'WATCH', reasons: [`Heart rate ${value} bpm in watch boundary`] };
    }
    return { status: 'NOMINAL', reasons: ['Heart rate within nominal clinical envelope (50–100 bpm)'] };
  }

  return { status: 'NOMINAL', reasons: ['Value nominal'] };
}
