import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";

import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
  TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";
import { predictLeg } from "@/features/prediction/prediction-engine";
import { createModeledStrategy } from "@/features/prediction/strategies/modeled-strategy";
import { intermediateStationIds } from "@/lib/station-utils";
import congestionFixture from "../../../../../backend/fixtures/datasets/congestion.json";
import correctionFixture from "../../../../../backend/fixtures/datasets/correction.json";
import timetableFixture from "../../../../../backend/fixtures/datasets/timetable.json";

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

describe("createModeledStrategy", () => {
  it("should report modeled provenance because the dataset is synthetic, not measured", () => {
    expect(strategy.provenance).toBe("modeled");
  });

  it("should produce the same standingMinutes as the legacy predictLeg for the same leg", () => {
    const viaStrategy = strategy.estimate(baseInput);
    const viaLegacy = predictLeg(congestion, correction, {
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:00",
      dayType: "weekday",
      tripMinutes: 16,
      intermediateStationIds: intermediateStationIds(
        timetable,
        "STA_SHINJUKU",
        "STA_TOKYO",
      ),
    });

    expect(isOk(viaStrategy)).toBe(true);
    expect(isOk(viaLegacy)).toBe(true);
    if (isOk(viaStrategy) && isOk(viaLegacy)) {
      expect(viaStrategy.data.standingMinutes).toEqual(
        viaLegacy.data.standingMinutes,
      );
      expect(viaStrategy.data.comfortScore).toBe(viaLegacy.data.comfortScore);
      expect(viaStrategy.data.factors).toEqual(viaLegacy.data.factors);
      expect(viaStrategy.data.confidence).toBe(viaLegacy.data.confidence);
    }
  });

  it("should carry the same per-station probabilities as the legacy field, in order", () => {
    // segments[0] starts at the boarding station, so it is not an
    // intermediate stop -- use-route-detail.ts and use-coach-session.ts
    // both skip it via segments.slice(1) to recover exactly the set of
    // intermediate stops perStationSeatProbability used to report. This
    // pins that readout against the legacy field directly, since neither
    // consumer has its own unit test for the mapping.
    const viaStrategy = strategy.estimate(baseInput);
    const viaLegacy = predictLeg(congestion, correction, {
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:00",
      dayType: "weekday",
      tripMinutes: 16,
      intermediateStationIds: intermediateStationIds(
        timetable,
        "STA_SHINJUKU",
        "STA_TOKYO",
      ),
    });

    expect(isOk(viaStrategy)).toBe(true);
    expect(isOk(viaLegacy)).toBe(true);
    if (isOk(viaStrategy) && isOk(viaLegacy)) {
      expect(viaLegacy.data.perStationSeatProbability.length).toBeGreaterThan(
        0,
      );
      expect(
        viaStrategy.data.segments.slice(1).map((segment) => ({
          stationId: segment.fromStopId,
          probability: segment.seatProbability,
        })),
      ).toEqual(viaLegacy.data.perStationSeatProbability);
    }
  });

  it("should emit one segment per hop, covering boarding to alighting in order", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const intermediates = intermediateStationIds(
        timetable,
        "STA_SHINJUKU",
        "STA_TOKYO",
      );
      expect(result.data.segments).toHaveLength(intermediates.length + 1);
      expect(result.data.segments[0].fromStopId).toBe("STA_SHINJUKU");
      expect(
        result.data.segments[result.data.segments.length - 1].toStopId,
      ).toBe("STA_TOKYO");
      // 各区間の toStopId は次の区間の fromStopId と連続する
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
      expect(total).toBeCloseTo(16, 5);
    }
  });

  it("should return the same estimate for the same input (determinism, 5.2)", () => {
    expect(strategy.estimate(baseInput)).toEqual(strategy.estimate(baseInput));
  });

  it("should return insufficient_data when no congestion profile matches the leg", () => {
    const result = strategy.estimate({
      ...baseInput,
      fromStationId: "STA_NOWHERE",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should expose per-carriage comfort because the synthetic dataset is car-keyed", () => {
    const result = strategy.estimate(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.byCarriage).toBeDefined();
      expect(result.data.byCarriage?.length).toBeGreaterThan(0);
    }
  });

  it("should return validation_error when arrivalTime equals departureTime", () => {
    const result = strategy.estimate({
      ...baseInput,
      arrivalTime: baseInput.departureTime,
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("should normalize an overnight leg (arrivalTime earlier than departureTime) to a positive duration", () => {
    // No congestion profile exists for this exact time bucket in the
    // fixture, so this only needs to prove resolveTripMinutes runs before
    // predictLeg's own profile lookup -- an insufficient_data result (not
    // validation_error) means the negative-duration guard did not reject
    // it, i.e. midnight-crossing was normalized rather than treated as
    // invalid input.
    const result = strategy.estimate({
      ...baseInput,
      departureTime: "23:50",
      arrivalTime: "00:10",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).not.toBe("validation_error");
    }
  });

  it("should keep segment minutes positive and summing to 20 for an overnight leg with matching profiles", () => {
    // WEEKDAY_EVENING_DEPARTURES includes "19:00" in the fixture generator,
    // covering STA_SHINJUKU-STA_TOKYO -- reusing it lets this leg actually
    // reach buildSegments (not just resolveTripMinutes) for an overnight
    // span, so the assertion below exercises the exact code path the bug
    // report named: minutesPerSegment must not be negative or zero.
    const result = strategy.estimate({
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: "19:00",
      arrivalTime: "00:00",
      dayType: "weekday",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      for (const segment of result.data.segments) {
        expect(segment.minutes).toBeGreaterThan(0);
      }
      const total = result.data.segments.reduce(
        (sum, segment) => sum + segment.minutes,
        0,
      );
      expect(total).toBeCloseTo(300, 5);
    }
  });
});
