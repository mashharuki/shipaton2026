import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";
import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import { searchRoutes } from "@/features/search/route-search-engine";
import timetableFixture from "../../../../backend/fixtures/datasets/timetable.json";

const timetable = timetableFixture.payload as TimetableDatasetPayload;

describe("searchRoutes", () => {
  it("should return direct route candidates for a known in-area weekday search", () => {
    const result = searchRoutes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: "07:00",
      dayType: "weekday",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const trainIds = result.data.map((c) => c.legs[0]?.trainId);
      expect(trainIds).toContain("TRAIN_WEEKDAY_0700");
      for (const candidate of result.data) {
        expect(candidate.legs).toHaveLength(1);
        expect(candidate.legs[0]?.fromStationId).toBe("STA_SHINJUKU");
        expect(candidate.legs[0]?.toStationId).toBe("STA_TOKYO");
      }
    }
  });

  it("should only return candidates departing at or after the requested time", () => {
    const result = searchRoutes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: "08:30",
      dayType: "weekday",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      for (const candidate of result.data) {
        expect(candidate.legs[0]?.departureTime >= "08:30").toBe(true);
      }
      // the fixture has a morning batch (07:00-08:16) and an evening batch
      // (18:00+); an 08:30 query should only surface the evening trains.
      const trainIds = result.data.map((c) => c.legs[0]?.trainId);
      expect(
        trainIds.every(
          (id) =>
            id?.includes("1800") ||
            id?.includes("1815") ||
            id?.includes("1830") ||
            id?.includes("1845") ||
            id?.includes("1900"),
        ),
      ).toBe(true);
    }
  });

  it("should return out_of_area when the destination station is outside the synced network", () => {
    const result = searchRoutes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_NONEXISTENT",
      departureTime: "07:00",
      dayType: "weekday",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("out_of_area");
    }
  });

  it("should return out_of_area when the origin station is outside the synced network", () => {
    const result = searchRoutes(timetable, {
      fromStationId: "STA_NONEXISTENT",
      toStationId: "STA_TOKYO",
      departureTime: "07:00",
      dayType: "weekday",
    });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("out_of_area");
    }
  });

  it("should find a 1-transfer candidate when no direct train covers the requested trip", () => {
    // A -> B on RAIL_A, then B -> D on RAIL_B, sharing station "B" as the
    // transfer point. No train covers A -> D directly.
    const twoLineTimetable: TimetableDatasetPayload = {
      schemaVersion: 1,
      stations: [
        { id: "A", railwayId: "RAIL_A", nameJa: "A", nameEn: "A", seq: 0 },
        { id: "B", railwayId: "RAIL_A", nameJa: "B", nameEn: "B", seq: 1 },
        { id: "D", railwayId: "RAIL_B", nameJa: "D", nameEn: "D", seq: 2 },
      ],
      trainTimetables: [
        {
          trainId: "TRAIN_A1",
          stationId: "A",
          departureTime: "07:00",
          arrivalTime: "07:00",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_A1",
          stationId: "B",
          departureTime: "07:10",
          arrivalTime: "07:10",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_B1",
          stationId: "B",
          departureTime: "07:15",
          arrivalTime: "07:15",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_B1",
          stationId: "D",
          departureTime: "07:25",
          arrivalTime: "07:25",
          carCount: 8,
          dayType: "weekday",
        },
      ],
    };

    const result = searchRoutes(twoLineTimetable, {
      fromStationId: "A",
      toStationId: "D",
      departureTime: "07:00",
      dayType: "weekday",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const transferCandidate = result.data.find((c) => c.legs.length === 2);
      expect(transferCandidate).toBeDefined();
      expect(transferCandidate?.legs[0]?.toStationId).toBe("B");
      expect(transferCandidate?.legs[1]?.fromStationId).toBe("B");
      expect(transferCandidate?.legs[1]?.toStationId).toBe("D");
    }
  });
});
