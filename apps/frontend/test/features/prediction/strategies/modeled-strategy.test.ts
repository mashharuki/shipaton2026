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

  it("should recommend a boarding car without the caller building any lookup key", () => {
    const result = strategy.recommendBoarding(baseInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.recommendedCarNumber).toBeGreaterThan(0);
    }
  });
});
