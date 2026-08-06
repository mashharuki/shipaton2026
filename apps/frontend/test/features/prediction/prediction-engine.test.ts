import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";

import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
} from "@/features/dataset/dataset-store";
import {
  predictLeg,
  recommendBoarding,
} from "@/features/prediction/prediction-engine";
import congestionFixture from "../../../../backend/fixtures/datasets/congestion.json";
import correctionFixture from "../../../../backend/fixtures/datasets/correction.json";

const congestion = congestionFixture.payload as CongestionDatasetPayload;
const correction = correctionFixture.payload as CorrectionDatasetPayload;

const baseQuery = {
  railwayId: "RAIL_CHUO",
  legKey: "STA_SHINJUKU-STA_TOKYO",
  timeBucket: "07:00",
  dayType: "weekday" as const,
  tripMinutes: 16,
  intermediateStationIds: ["STA_YOTSUYA", "STA_OCHANOMIZU", "STA_KANDA"],
};

describe("predictLeg", () => {
  it("should return insufficient_data when no congestion profile matches the query", () => {
    const result = predictLeg(congestion, correction, {
      ...baseQuery,
      legKey: "STA_NOWHERE-STA_ELSE",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should return the same prediction for the same input (determinism, 5.2)", () => {
    const first = predictLeg(congestion, correction, baseQuery);
    const second = predictLeg(congestion, correction, baseQuery);

    expect(first).toEqual(second);
  });

  it("should only include factors that were actually used (5.6)", () => {
    const result = predictLeg(congestion, correction, baseQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      // correction.json ships an empty stats array pre-launch (2.3's note),
      // so only base_profile should ever be contributed here.
      expect(result.data.factors.map((f) => f.kind)).toEqual(["base_profile"]);
    }
  });

  it("should include a feedback_correction factor when a matching correction entry exists", () => {
    const correctionWithData: CorrectionDatasetPayload = {
      schemaVersion: 1,
      stats: [
        {
          railwayId: "RAIL_CHUO",
          legKey: "STA_SHINJUKU-STA_TOKYO",
          timeBucket: "07:00",
          dayType: "weekday",
          deltaScore: 0.1,
          sampleSize: 8,
        },
      ],
    };

    const result = predictLeg(congestion, correctionWithData, baseQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.factors.map((f) => f.kind)).toEqual([
        "base_profile",
        "feedback_correction",
      ]);
    }
  });

  it("should report low confidence and a range estimate when sample size is below threshold (5.3/5.4)", () => {
    const result = predictLeg(congestion, correction, baseQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      // the fixture's sampleSize is 0 for every car pre-launch (2.3's note)
      expect(result.data.confidence).toBe("low");
      expect(result.data.standingMinutes).not.toHaveProperty("point");
      expect(result.data.standingMinutes).toHaveProperty("rangeMin");
      expect(result.data.standingMinutes).toHaveProperty("rangeMax");
    }
  });

  it("should derive a seat probability inversely related to the average congestion load", () => {
    const crowded: CongestionDatasetPayload = {
      schemaVersion: 1,
      profiles: [
        {
          railwayId: "RAIL_CHUO",
          legKey: "STA_SHINJUKU-STA_TOKYO",
          timeBucket: "07:00",
          dayType: "weekday",
          carNumber: 1,
          loadScore: 0.9,
          sampleSize: 0,
        },
      ],
    };
    const lessCrowded: CongestionDatasetPayload = {
      schemaVersion: 1,
      profiles: [
        {
          railwayId: "RAIL_CHUO",
          legKey: "STA_SHINJUKU-STA_TOKYO",
          timeBucket: "07:00",
          dayType: "weekday",
          carNumber: 1,
          loadScore: 0.2,
          sampleSize: 0,
        },
      ],
    };

    const crowdedResult = predictLeg(crowded, correction, baseQuery);
    const lessCrowdedResult = predictLeg(lessCrowded, correction, baseQuery);

    expect(isOk(crowdedResult)).toBe(true);
    expect(isOk(lessCrowdedResult)).toBe(true);
    if (isOk(crowdedResult) && isOk(lessCrowdedResult)) {
      expect(crowdedResult.data.seatProbability).toBeLessThan(
        lessCrowdedResult.data.seatProbability,
      );
    }
  });

  it("should return one seat-probability entry per intermediate station, in order", () => {
    const result = predictLeg(congestion, correction, baseQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(
        result.data.perStationSeatProbability.map((p) => p.stationId),
      ).toEqual(baseQuery.intermediateStationIds);
      for (const { probability } of result.data.perStationSeatProbability) {
        expect(probability).toBeGreaterThanOrEqual(0);
        expect(probability).toBeLessThanOrEqual(1);
      }
    }
  });

  it("should keep comfortScore and seatedMinutes within sane bounds", () => {
    const result = predictLeg(congestion, correction, baseQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.comfortScore).toBeGreaterThanOrEqual(0);
      expect(result.data.comfortScore).toBeLessThanOrEqual(1);
      expect(result.data.seatedMinutes).toBeGreaterThanOrEqual(0);
      expect(result.data.seatedMinutes).toBeLessThanOrEqual(
        baseQuery.tripMinutes,
      );
    }
  });
});

describe("recommendBoarding", () => {
  const boardingQuery = {
    railwayId: "RAIL_CHUO",
    legKey: "STA_SHINJUKU-STA_TOKYO",
    timeBucket: "07:00",
    dayType: "weekday" as const,
  };

  it("should return insufficient_data when no congestion profile matches the query", () => {
    const result = recommendBoarding(congestion, {
      ...boardingQuery,
      legKey: "STA_NOWHERE-STA_ELSE",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should recommend the car with the lowest load score (6.1)", () => {
    const congestionFixtureWithCars: CongestionDatasetPayload = {
      schemaVersion: 1,
      profiles: [
        { ...boardingQuery, carNumber: 1, loadScore: 0.8, sampleSize: 10 },
        { ...boardingQuery, carNumber: 2, loadScore: 0.3, sampleSize: 10 },
        { ...boardingQuery, carNumber: 3, loadScore: 0.6, sampleSize: 10 },
      ],
    };

    const result = recommendBoarding(congestionFixtureWithCars, boardingQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.recommendedCarNumber).toBe(2);
      expect(result.data.carCount).toBe(3);
    }
  });

  it("should include one comparison entry per car, sorted by car number, with no door-level field (6.3)", () => {
    const result = recommendBoarding(congestion, boardingQuery);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.carComparisons.map((c) => c.carNumber)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ]);
      for (const car of result.data.carComparisons) {
        expect(car).not.toHaveProperty("door");
        expect(car.seatProbability).toBeGreaterThanOrEqual(0);
        expect(car.seatProbability).toBeLessThanOrEqual(1);
      }
    }
  });

  it("should return the same recommendation for the same input (determinism, 5.2)", () => {
    const first = recommendBoarding(congestion, boardingQuery);
    const second = recommendBoarding(congestion, boardingQuery);

    expect(first).toEqual(second);
  });
});
