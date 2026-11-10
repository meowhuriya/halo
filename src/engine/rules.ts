import { evaluateAbsoluteStatus } from './baseline';
import { type RuleEvaluation } from '../config/thresholds';

export type { RuleEvaluation };

export function evaluateVitalsStatus(
  indicator: string,
  value: number,
  options?: { dia?: number; isPostMeal?: boolean; consecutiveDaysUnder6?: number; consecutiveDaysUnder4?: number }
): RuleEvaluation {
  return evaluateAbsoluteStatus(indicator, value, options);
}
