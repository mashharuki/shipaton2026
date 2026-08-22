import type { AppError } from "../errors/app-error";
import { createAppError } from "../errors/app-error";
import { err, ok, type Result } from "../result";
import type { ComfortEstimate } from "./comfort";

/**
 * M5 (design doc §7/§8, docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md):
 * "精度検証パイプライン。完了条件: MAE 数値が出る"
 *
 * Compares a `measured` ComfortEstimate (ground truth -- e.g. M4's Sydney
 * TfNSW MeasuredStrategy) against a `modeled` ComfortEstimate for the same
 * trip/leg (the model structure intended for a region without real
 * measurements, e.g. Tokyo's ModeledStrategy), and computes the KA-5
 * accuracy metrics: standing-minutes MAE/bias, and per-carriage rank
 * correlation (design §7: "同一 trip / 同一号車 / 同一区間で突き合わせ").
 *
 * §7.1's limit applies to how this report may be used: a passing MAE here
 * validates the MODEL STRUCTURE against Sydney's real data, not Tokyo's
 * specific coefficients (different rolling stock, different boarding
 * behavior). Never present this as "Tokyo predictions are this accurate."
 */

export type ComfortEstimatePair = {
  measured: ComfortEstimate;
  modeled: ComfortEstimate;
};

/**
 * red-team KA-5 kill criterion (docs/pm/review-seatsignal-idea-2026-08-04.md):
 * "立ち時間 MAE ≤ 10分" -- exceeding this means dropping the numeric minutes
 * display in favor of a coarser "seating ease rank" degrade.
 */
export const MAE_DEGRADE_THRESHOLD_MINUTES = 10;

export type AccuracyVerdict =
  | "numeric_standing_time"
  | "seating_ease_rank_only";

export type AccuracyReport = {
  sampleCount: number;
  /** Mean absolute error, in minutes, of modeled vs. measured standing time. */
  standingMinutesMAE: number;
  /** Mean signed error (modeled - measured); positive means the model over-predicts standing time. */
  standingMinutesBias: number;
  /** Spearman rank correlation of per-carriage seatProbability, averaged over pairs where both sides have byCarriage with >=2 overlapping carriage numbers. null if no such pair exists. */
  carriageRankCorrelation: number | null;
  /** How many pairs actually contributed to carriageRankCorrelation (out of sampleCount). */
  carriageRankSampleCount: number;
  verdict: AccuracyVerdict;
};

function standingMinutesPoint(estimate: ComfortEstimate): number {
  const sm = estimate.standingMinutes;
  return "point" in sm ? sm.point : (sm.rangeMin + sm.rangeMax) / 2;
}

/**
 * Average-rank (fractional rank) transform -- ties get the mean of the
 * ranks they'd otherwise occupy. Not a simplification skipped for this
 * domain: the ordinal occupancy->seatProbability mapping
 * (seatProbabilityForOccupancyStatus) maps EMPTY and MANY_SEATS_AVAILABLE
 * to the same probability, so ties are routine, not an edge case.
 */
function averageRanks(values: readonly number[]): number[] {
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) {
      j += 1;
    }
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) {
      ranks[order[k]] = averageRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Spearman rank correlation. Returns null (not 0) when undefined -- either
 * too few points, or one side has zero rank variance (every value tied),
 * in which case "no correlation" is a category error, not a score of 0.
 */
export function spearmanCorrelation(
  a: readonly number[],
  b: readonly number[],
): number | null {
  if (a.length !== b.length || a.length < 2) {
    return null;
  }
  const rankA = averageRanks(a);
  const rankB = averageRanks(b);
  if (new Set(rankA).size < 2 || new Set(rankB).size < 2) {
    return null;
  }
  const n = a.length;
  const sumSquaredDiff = rankA.reduce(
    (sum, ra, idx) => sum + (ra - rankB[idx]) ** 2,
    0,
  );
  return 1 - (6 * sumSquaredDiff) / (n * (n * n - 1));
}

function carriageRankCorrelationFor(pair: ComfortEstimatePair): number | null {
  if (!pair.measured.byCarriage || !pair.modeled.byCarriage) {
    return null;
  }
  const measuredByNumber = new Map(
    pair.measured.byCarriage.map((c) => [c.carriageNumber, c.seatProbability]),
  );
  const modeledByNumber = new Map(
    pair.modeled.byCarriage.map((c) => [c.carriageNumber, c.seatProbability]),
  );
  const commonNumbers = [...measuredByNumber.keys()]
    .filter((n) => modeledByNumber.has(n))
    .sort((a, b) => a - b);
  if (commonNumbers.length < 2) {
    return null;
  }
  const measuredValues = commonNumbers.map(
    (n) => measuredByNumber.get(n) as number,
  );
  const modeledValues = commonNumbers.map(
    (n) => modeledByNumber.get(n) as number,
  );
  return spearmanCorrelation(measuredValues, modeledValues);
}

export function computeAccuracyReport(
  pairs: ReadonlyArray<ComfortEstimatePair>,
): Result<AccuracyReport, AppError> {
  if (pairs.length === 0) {
    return err(
      createAppError(
        "insufficient_data",
        "computeAccuracyReport requires at least one measured/modeled pair",
      ),
    );
  }

  for (const pair of pairs) {
    if (pair.measured.provenance !== "measured") {
      return err(
        createAppError(
          "validation_error",
          `Expected pair.measured.provenance === "measured", got "${pair.measured.provenance}"`,
        ),
      );
    }
    if (pair.modeled.provenance !== "modeled") {
      return err(
        createAppError(
          "validation_error",
          `Expected pair.modeled.provenance === "modeled", got "${pair.modeled.provenance}"`,
        ),
      );
    }
  }

  const signedErrors = pairs.map(
    (pair) =>
      standingMinutesPoint(pair.modeled) - standingMinutesPoint(pair.measured),
  );
  const standingMinutesMAE =
    signedErrors.reduce((sum, d) => sum + Math.abs(d), 0) / signedErrors.length;
  const standingMinutesBias =
    signedErrors.reduce((sum, d) => sum + d, 0) / signedErrors.length;

  const rankCorrelations = pairs
    .map(carriageRankCorrelationFor)
    .filter((rho): rho is number => rho !== null);
  const carriageRankCorrelation =
    rankCorrelations.length > 0
      ? rankCorrelations.reduce((sum, rho) => sum + rho, 0) /
        rankCorrelations.length
      : null;

  return ok({
    sampleCount: pairs.length,
    standingMinutesMAE,
    standingMinutesBias,
    carriageRankCorrelation,
    carriageRankSampleCount: rankCorrelations.length,
    verdict:
      standingMinutesMAE > MAE_DEGRADE_THRESHOLD_MINUTES
        ? "seating_ease_rank_only"
        : "numeric_standing_time",
  });
}
