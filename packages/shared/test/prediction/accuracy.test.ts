import { describe, expect, it } from "vitest";
import {
  type ComfortEstimatePair,
  computeAccuracyReport,
  MAE_DEGRADE_THRESHOLD_MINUTES,
  spearmanCorrelation,
} from "../../src/prediction/accuracy";
import type { ComfortEstimate } from "../../src/prediction/comfort";
import { isErr, isOk } from "../../src/result";

function estimate(overrides: Partial<ComfortEstimate> = {}): ComfortEstimate {
  return {
    segments: [
      { fromStopId: "S1", toStopId: "S2", minutes: 10, seatProbability: 0.5 },
    ],
    provenance: "measured",
    standingMinutes: { point: 5 },
    seatedMinutes: 5,
    seatProbability: 0.5,
    confidence: "high",
    sampleSizeHint: "1",
    factors: [],
    comfortScore: 0.5,
    ...overrides,
  };
}

function pair(
  measuredStandingMinutes: number,
  modeledStandingMinutes: number,
  overrides: Partial<{
    measuredByCarriage: ComfortEstimate["byCarriage"];
    modeledByCarriage: ComfortEstimate["byCarriage"];
  }> = {},
): ComfortEstimatePair {
  return {
    measured: estimate({
      provenance: "measured",
      standingMinutes: { point: measuredStandingMinutes },
      byCarriage: overrides.measuredByCarriage,
    }),
    modeled: estimate({
      provenance: "modeled",
      standingMinutes: { point: modeledStandingMinutes },
      byCarriage: overrides.modeledByCarriage,
    }),
  };
}

describe("spearmanCorrelation", () => {
  it("returns 1 for a perfectly matching order", () => {
    expect(spearmanCorrelation([1, 2, 3], [10, 20, 30])).toBe(1);
  });

  it("returns -1 for a perfectly reversed order", () => {
    expect(spearmanCorrelation([1, 2, 3], [30, 20, 10])).toBe(-1);
  });

  it("returns null when fewer than 2 points", () => {
    expect(spearmanCorrelation([1], [1])).toBeNull();
  });

  it("returns null when array lengths differ", () => {
    expect(spearmanCorrelation([1, 2], [1, 2, 3])).toBeNull();
  });

  it("returns null when one side has zero variance (all tied)", () => {
    expect(spearmanCorrelation([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it("handles ties via average rank rather than crashing or misordering", () => {
    // seatProbabilityForOccupancyStatus routinely produces ties (EMPTY and
    // MANY_SEATS_AVAILABLE both map to 1) -- this is the domain-realistic case.
    const rho = spearmanCorrelation([1, 1, 0.6, 0], [1, 1, 0.2, 0]);
    expect(rho).not.toBeNull();
    expect(rho as number).toBeGreaterThan(0.9);
  });
});

describe("computeAccuracyReport", () => {
  it("returns insufficient_data for an empty sample list", () => {
    const result = computeAccuracyReport([]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("returns validation_error when measured.provenance is not 'measured'", () => {
    const badPair: ComfortEstimatePair = {
      measured: estimate({ provenance: "modeled" }),
      modeled: estimate({ provenance: "modeled" }),
    };

    const result = computeAccuracyReport([badPair]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("returns validation_error when modeled.provenance is not 'modeled'", () => {
    const badPair: ComfortEstimatePair = {
      measured: estimate({ provenance: "measured" }),
      modeled: estimate({ provenance: "measured" }),
    };

    const result = computeAccuracyReport([badPair]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("computes MAE as the mean absolute standing-minutes error across samples", () => {
    // errors: |5-8|=3, |10-6|=4 -> MAE = 3.5
    const result = computeAccuracyReport([pair(5, 8), pair(10, 6)]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.standingMinutesMAE).toBeCloseTo(3.5, 5);
    }
  });

  it("computes bias as the mean signed error (modeled - measured)", () => {
    // signed errors: 8-5=+3, 6-10=-4 -> bias = -0.5
    const result = computeAccuracyReport([pair(5, 8), pair(10, 6)]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.standingMinutesBias).toBeCloseTo(-0.5, 5);
    }
  });

  it("passes (numeric_standing_time) when MAE is at or under the KA-5 threshold", () => {
    const result = computeAccuracyReport([
      pair(5, 5 + MAE_DEGRADE_THRESHOLD_MINUTES),
    ]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.standingMinutesMAE).toBe(
        MAE_DEGRADE_THRESHOLD_MINUTES,
      );
      expect(result.data.verdict).toBe("numeric_standing_time");
    }
  });

  it("degrades to seating_ease_rank_only when MAE exceeds the KA-5 threshold", () => {
    const result = computeAccuracyReport([
      pair(5, 5 + MAE_DEGRADE_THRESHOLD_MINUTES + 0.01),
    ]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.verdict).toBe("seating_ease_rank_only");
    }
  });

  it("computes carriageRankCorrelation only from pairs with >=2 overlapping carriage numbers", () => {
    const withCarriages = pair(5, 5, {
      measuredByCarriage: [
        { carriageNumber: 1, seatProbability: 0.9 },
        { carriageNumber: 2, seatProbability: 0.1 },
      ],
      modeledByCarriage: [
        { carriageNumber: 1, seatProbability: 0.8 },
        { carriageNumber: 2, seatProbability: 0.2 },
      ],
    });
    const withoutCarriages = pair(5, 5);

    const result = computeAccuracyReport([withCarriages, withoutCarriages]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.carriageRankSampleCount).toBe(1);
      expect(result.data.carriageRankCorrelation).toBeCloseTo(1, 5);
    }
  });

  it("returns null carriageRankCorrelation when no sample has usable byCarriage data", () => {
    const result = computeAccuracyReport([pair(5, 6), pair(7, 8)]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.carriageRankCorrelation).toBeNull();
      expect(result.data.carriageRankSampleCount).toBe(0);
    }
  });

  it("skips a pair for rank correlation when carriage numbers don't overlap enough", () => {
    const mismatched = pair(5, 5, {
      measuredByCarriage: [{ carriageNumber: 1, seatProbability: 0.9 }],
      modeledByCarriage: [{ carriageNumber: 2, seatProbability: 0.2 }],
    });

    const result = computeAccuracyReport([mismatched]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.carriageRankSampleCount).toBe(0);
      expect(result.data.carriageRankCorrelation).toBeNull();
    }
  });

  it("reports sampleCount equal to the number of input pairs regardless of rank-correlation eligibility", () => {
    const result = computeAccuracyReport([pair(5, 6), pair(7, 8), pair(9, 10)]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.sampleCount).toBe(3);
    }
  });
});
