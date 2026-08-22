import type { OccupancyObservation } from "shared";
import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";

import { deriveBoardingAdvice } from "@/features/prediction/boarding-advice";
import { createMeasuredStrategy } from "@/features/prediction/strategies/measured-strategy";

const TRIP_ID = "SYD_T1";
const REGION_ID = "au-nsw-sydney";
const SOURCE = "tfnsw-test-fixture";

function observation(
  overrides: Partial<OccupancyObservation> & {
    stopId: string;
    stopSequence: number;
  },
): OccupancyObservation {
  return {
    regionId: REGION_ID,
    observedAt: "2026-08-22T00:00:00Z",
    tripId: TRIP_ID,
    horizon: "predicted",
    source: SOURCE,
    ...overrides,
  };
}

// Trip runs S1 -> S2 -> S3 -> S4. Carriage 1 fills up as the trip
// progresses; carriage 2 stays roomier throughout, so it should always be
// the recommended carriage.
const FOUR_STOP_OBSERVATIONS: OccupancyObservation[] = [
  observation({
    stopId: "S1",
    stopSequence: 0,
    carriageNumber: 1,
    occupancyStatus: "MANY_SEATS_AVAILABLE",
  }),
  observation({
    stopId: "S1",
    stopSequence: 0,
    carriageNumber: 2,
    occupancyStatus: "EMPTY",
  }),
  observation({
    stopId: "S2",
    stopSequence: 1,
    carriageNumber: 1,
    occupancyStatus: "FEW_SEATS_AVAILABLE",
  }),
  observation({
    stopId: "S2",
    stopSequence: 1,
    carriageNumber: 2,
    occupancyStatus: "MANY_SEATS_AVAILABLE",
  }),
  observation({
    stopId: "S3",
    stopSequence: 2,
    carriageNumber: 1,
    occupancyStatus: "STANDING_ROOM_ONLY",
  }),
  observation({
    stopId: "S3",
    stopSequence: 2,
    carriageNumber: 2,
    occupancyStatus: "FEW_SEATS_AVAILABLE",
  }),
  observation({
    stopId: "S4",
    stopSequence: 3,
    carriageNumber: 1,
    occupancyStatus: "FULL",
  }),
  observation({
    stopId: "S4",
    stopSequence: 3,
    carriageNumber: 2,
    occupancyStatus: "STANDING_ROOM_ONLY",
  }),
];

const baseInput = {
  fromStationId: "S1",
  toStationId: "S4",
  departureTime: "08:00",
  arrivalTime: "08:30",
  dayType: "weekday" as const,
  tripId: TRIP_ID,
};

describe("createMeasuredStrategy", () => {
  const strategy = createMeasuredStrategy({
    observations: FOUR_STOP_OBSERVATIONS,
  });

  it("should report measured provenance because this reads real GTFS-RT occupancy, not a synthetic profile", () => {
    expect(strategy.provenance).toBe("measured");
  });

  it("should return validation_error when tripId is missing", () => {
    const result = strategy.estimate({ ...baseInput, tripId: undefined });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("should return insufficient_data when no observations exist for the tripId", () => {
    const result = strategy.estimate({ ...baseInput, tripId: "NO_SUCH_TRIP" });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should return insufficient_data when the boarding stop was never observed for this trip", () => {
    const result = strategy.estimate({
      ...baseInput,
      fromStationId: "S_NOWHERE",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should return validation_error when fromStationId does not precede toStationId in the observed sequence", () => {
    const result = strategy.estimate({
      ...baseInput,
      fromStationId: "S4",
      toStationId: "S1",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("should emit one segment per hop, covering boarding to alighting in order", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.segments).toHaveLength(3);
      expect(result.data.segments[0].fromStopId).toBe("S1");
      expect(result.data.segments[2].toStopId).toBe("S4");
      for (let i = 1; i < result.data.segments.length; i++) {
        expect(result.data.segments[i].fromStopId).toBe(
          result.data.segments[i - 1].toStopId,
        );
      }
    }
  });

  it("should keep total segment minutes equal to the leg duration", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const total = result.data.segments.reduce(
        (sum, segment) => sum + segment.minutes,
        0,
      );
      expect(total).toBeCloseTo(30, 5);
    }
  });

  it("should compute standingMinutes via the ESM formula (sum of minutes * (1 - seatProbability))", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const expected = result.data.segments.reduce(
        (sum, segment) => sum + segment.minutes * (1 - segment.seatProbability),
        0,
      );
      const actual =
        "point" in result.data.standingMinutes
          ? result.data.standingMinutes.point
          : Number.NaN;
      expect(actual).toBeCloseTo(expected, 5);
    }
  });

  it("should recommend carriage 2 because it stays roomier for the whole matched range", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.byCarriage).toBeDefined();
      const carriage1 = result.data.byCarriage?.find(
        (c) => c.carriageNumber === 1,
      );
      const carriage2 = result.data.byCarriage?.find(
        (c) => c.carriageNumber === 2,
      );
      expect(carriage2?.seatProbability ?? 0).toBeGreaterThan(
        carriage1?.seatProbability ?? 1,
      );
    }
  });

  it("should degrade byCarriage to undefined when no observation carries a carriageNumber (vehicle-level-only feed)", () => {
    const vehicleLevelOnly: OccupancyObservation[] = FOUR_STOP_OBSERVATIONS.map(
      ({ carriageNumber, ...rest }) => rest,
    );
    const vehicleLevelStrategy = createMeasuredStrategy({
      observations: vehicleLevelOnly,
    });

    const result = vehicleLevelStrategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.byCarriage).toBeUndefined();
    }
  });

  it("should return insufficient_data rather than a fabricated value when a matched stop has no occupancy_status at all", () => {
    const missingStatus: OccupancyObservation[] = FOUR_STOP_OBSERVATIONS.map(
      (o) => (o.stopId === "S2" ? { ...o, occupancyStatus: undefined } : o),
    );
    const partialStrategy = createMeasuredStrategy({
      observations: missingStatus,
    });

    const result = partialStrategy.estimate(baseInput);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should return the same estimate for the same input (determinism)", () => {
    expect(strategy.estimate(baseInput)).toEqual(strategy.estimate(baseInput));
  });

  it("UI integration: feeds straight into deriveBoardingAdvice (the same function route-detail.tsx uses for ModeledStrategy) with no Sydney-specific branch", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const advice = deriveBoardingAdvice(result.data);
      expect(advice).toBeDefined();
      expect(advice?.recommendedCarNumber).toBe(2);
      expect(advice?.carCount).toBe(2);
      expect(advice?.confidence).toBe("high");
    }
  });
});
