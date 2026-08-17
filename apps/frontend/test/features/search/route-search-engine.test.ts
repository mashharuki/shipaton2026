import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";
import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import { searchRoutes } from "@/features/search/route-search-engine";
import timetableFixture from "../../../../backend/fixtures/datasets/timetable.json";

const timetable = timetableFixture.payload as TimetableDatasetPayload;

// P1/P2 回帰テスト用fixture: 折返し便（逆方向）は物理的な停車順が路線全体の
// 駅連番と逆になる。station.seq でこの便自身の停車順を復元しようとすると
// 常に「A→B→C」の順にソートされてしまい、実際には「C→B→A」と走っている
// この便の向きを取り違える。stopSequence は便ごとに独立しているため、
// この取り違えが構造的に起こり得ないことを検証する。
const reverseDirectionTimetable: TimetableDatasetPayload = {
  schemaVersion: 1,
  stations: [
    { id: "STA_A", railwayId: "RAIL_X", nameJa: "A", nameEn: "A", seq: 0 },
    { id: "STA_B", railwayId: "RAIL_X", nameJa: "B", nameEn: "B", seq: 1 },
    { id: "STA_C", railwayId: "RAIL_X", nameJa: "C", nameEn: "C", seq: 2 },
  ],
  trips: [
    {
      tripId: "TRAIN_OUTBOUND",
      dayType: "weekday",
      carCount: 8,
      stopTimes: [
        {
          stopId: "STA_A",
          stopSequence: 0,
          arrivalTime: "07:00",
          departureTime: "07:00",
        },
        {
          stopId: "STA_B",
          stopSequence: 1,
          arrivalTime: "07:05",
          departureTime: "07:05",
        },
        {
          stopId: "STA_C",
          stopSequence: 2,
          arrivalTime: "07:10",
          departureTime: "07:10",
        },
      ],
    },
    {
      // 物理的にはC→B→Aの順に走る（駅連番 seq: A=0,B=1,C=2 の昇順とは逆）。
      tripId: "TRAIN_INBOUND",
      dayType: "weekday",
      carCount: 8,
      stopTimes: [
        {
          stopId: "STA_C",
          stopSequence: 0,
          arrivalTime: "08:00",
          departureTime: "08:00",
        },
        {
          stopId: "STA_B",
          stopSequence: 1,
          arrivalTime: "08:05",
          departureTime: "08:05",
        },
        {
          stopId: "STA_A",
          stopSequence: 2,
          arrivalTime: "08:10",
          departureTime: "08:10",
        },
      ],
    },
  ],
};

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
      trips: [
        {
          tripId: "TRAIN_A1",
          dayType: "weekday",
          carCount: 8,
          stopTimes: [
            {
              stopId: "A",
              stopSequence: 0,
              arrivalTime: "07:00",
              departureTime: "07:00",
            },
            {
              stopId: "B",
              stopSequence: 1,
              arrivalTime: "07:10",
              departureTime: "07:10",
            },
          ],
        },
        {
          tripId: "TRAIN_B1",
          dayType: "weekday",
          carCount: 8,
          stopTimes: [
            {
              stopId: "B",
              stopSequence: 0,
              arrivalTime: "07:15",
              departureTime: "07:15",
            },
            {
              stopId: "D",
              stopSequence: 1,
              arrivalTime: "07:25",
              departureTime: "07:25",
            },
          ],
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

describe("searchRoutes (P1/P2 regression: trip-scoped stop order)", () => {
  it("should find a direct route on a return-direction trip whose physical stop order is the reverse of global station seq order", () => {
    const result = searchRoutes(reverseDirectionTimetable, {
      fromStationId: "STA_C",
      toStationId: "STA_A",
      departureTime: "07:30",
      dayType: "weekday",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const direct = result.data.find(
        (candidate) =>
          candidate.legs.length === 1 &&
          candidate.legs[0].trainId === "TRAIN_INBOUND",
      );
      expect(direct).toBeDefined();
      expect(direct?.legs[0].departureTime).toBe("08:00");
      expect(direct?.legs[0].arrivalTime).toBe("08:10");
    }
  });

  it("should not find a route on the inbound trip going the wrong direction (A to C needs the outbound trip)", () => {
    const result = searchRoutes(reverseDirectionTimetable, {
      fromStationId: "STA_A",
      toStationId: "STA_C",
      departureTime: "06:30",
      dayType: "weekday",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const viaInbound = result.data.find(
        (candidate) => candidate.legs[0]?.trainId === "TRAIN_INBOUND",
      );
      expect(viaInbound).toBeUndefined();
      const viaOutbound = result.data.find(
        (candidate) => candidate.legs[0]?.trainId === "TRAIN_OUTBOUND",
      );
      expect(viaOutbound).toBeDefined();
    }
  });
});
