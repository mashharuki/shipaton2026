import { isOk } from "shared";
import { describe, expect, it } from "vitest";

import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
  TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";
import { deriveBoardingAdvice } from "@/features/prediction/boarding-advice";
import { recommendBoarding } from "@/features/prediction/prediction-engine";
import { createModeledStrategy } from "@/features/prediction/strategies/modeled-strategy";
import congestionFixture from "../../../../backend/fixtures/datasets/congestion.json";
import correctionFixture from "../../../../backend/fixtures/datasets/correction.json";
import timetableFixture from "../../../../backend/fixtures/datasets/timetable.json";

const timetable = timetableFixture.payload as TimetableDatasetPayload;
const congestion = congestionFixture.payload as CongestionDatasetPayload;
const correction = correctionFixture.payload as CorrectionDatasetPayload;

const strategy = createModeledStrategy({ timetable, congestion, correction });

const baseInput = {
  fromStationId: "STA_SHINJUKU",
  toStationId: "STA_TOKYO",
  departureTime: "07:00",
  arrivalTime: "07:16",
  dayType: "weekday" as const,
};

describe("deriveBoardingAdvice", () => {
  it("should return undefined when the estimate has no per-carriage data", () => {
    const advice = deriveBoardingAdvice({
      segments: [],
      provenance: "modeled",
      standingMinutes: { point: 0 },
      seatedMinutes: 0,
      seatProbability: 0,
      confidence: "low",
      sampleSizeHint: "<5",
      factors: [],
      comfortScore: 0,
    });

    expect(advice).toBeUndefined();
  });

  it("should recommend the carriage with the highest seat probability", () => {
    const result = strategy.estimate(baseInput);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      return;
    }

    const advice = deriveBoardingAdvice(result.data);
    expect(advice).toBeDefined();
    if (!advice) {
      return;
    }

    const best = advice.carComparisons.reduce((a, b) =>
      b.seatProbability > a.seatProbability ? b : a,
    );
    expect(advice.recommendedCarNumber).toBe(best.carNumber);
  });

  it("should match the legacy recommendBoarding output, given the same congestion profiles", () => {
    // predictLeg and recommendBoarding filter congestion.profiles by the
    // exact same 4 keys (railwayId/legKey/timeBucket/dayType), so the
    // byCarriage that estimate() already computes carries the same
    // information recommendBoarding would have -- this pins that the
    // derivation reproduces it, modulo floating-point noise in loadScore
    // (a derived field: 1 - (1 - x) is not bit-exact for arbitrary x, even
    // though byCarriage's own seatProbability is a verbatim passthrough and
    // does match exactly).
    const viaEstimate = strategy.estimate(baseInput);
    const viaLegacy = recommendBoarding(congestion, {
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:00",
      dayType: "weekday",
    });

    expect(isOk(viaEstimate)).toBe(true);
    expect(isOk(viaLegacy)).toBe(true);
    if (!isOk(viaEstimate) || !isOk(viaLegacy)) {
      return;
    }

    const advice = deriveBoardingAdvice(viaEstimate.data);
    expect(advice).toBeDefined();
    if (!advice) {
      return;
    }

    expect(advice.recommendedCarNumber).toBe(
      viaLegacy.data.recommendedCarNumber,
    );
    expect(advice.carCount).toBe(viaLegacy.data.carCount);
    expect(advice.confidence).toBe(viaLegacy.data.confidence);
    expect(advice.reasonMessageKey).toBe(viaLegacy.data.reasonMessageKey);
    expect(advice.carComparisons).toHaveLength(
      viaLegacy.data.carComparisons.length,
    );
    advice.carComparisons.forEach((car, i) => {
      const legacyCar = viaLegacy.data.carComparisons[i];
      expect(car.carNumber).toBe(legacyCar.carNumber);
      expect(car.seatProbability).toBe(legacyCar.seatProbability);
      expect(car.loadScore).toBeCloseTo(legacyCar.loadScore, 10);
    });
  });
});
