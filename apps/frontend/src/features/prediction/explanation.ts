import type { PredictionFactor } from "shared";

// 5.6: the reason explanation is exactly the message keys of the factors
// scorePrediction() actually contributed -- no separate composition step,
// since shared's buildFactors() already only includes defined inputs (never
// a placeholder/guessed factor). Kept as its own function (matching
// design.md's file split) so callers -- and tests -- have a single place to
// resolve "why this prediction" independent of the scoring math.
export function explainPrediction(
  factors: ReadonlyArray<PredictionFactor>,
): string[] {
  return factors.map((factor) => factor.messageKey);
}
