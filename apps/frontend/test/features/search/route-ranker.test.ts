import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";

import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
  TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";
import { createModeledStrategy } from "@/features/prediction/strategies/modeled-strategy";
import type { ComfortPreference } from "@/features/preferences/preference-store";
import { rankRoutes } from "@/features/search/route-ranker";
import type { RouteCandidate } from "@/features/search/route-search-engine";

// Not imported from preference-store.ts's real DEFAULT_PREFERENCE -- that
// module also wires up expo-sqlite/kv-store as a side effect of import,
// which (like every RN-native module) can't be parsed under this project's
// Vitest config. route-ranker only needs the value shape, not the store.
const DEFAULT_PREFERENCE: ComfortPreference = {
  speedComfortBalance: "balance",
  maxExtraMinutes: 15,
  transferTolerance: "medium",
  walkingTolerance: "medium",
};

const timetable: TimetableDatasetPayload = {
  schemaVersion: 1,
  stations: [
    { id: "STA_A", railwayId: "RAIL_X", nameJa: "A", nameEn: "A", seq: 0 },
    { id: "STA_B", railwayId: "RAIL_X", nameJa: "B", nameEn: "B", seq: 1 },
    { id: "STA_C", railwayId: "RAIL_X", nameJa: "C", nameEn: "C", seq: 2 },
    { id: "STA_D", railwayId: "RAIL_X", nameJa: "D", nameEn: "D", seq: 3 },
  ],
  trainTimetables: [],
};

function fastCandidate(): RouteCandidate {
  return {
    legs: [
      {
        trainId: "TRAIN_FAST",
        fromStationId: "STA_A",
        toStationId: "STA_D",
        departureTime: "07:00",
        arrivalTime: "07:20",
      },
    ],
  };
}

function slowCandidate(): RouteCandidate {
  return {
    legs: [
      {
        trainId: "TRAIN_SLOW",
        fromStationId: "STA_A",
        toStationId: "STA_D",
        departureTime: "07:05",
        arrivalTime: "07:35",
      },
    ],
  };
}

// departureTime/arrivalTime are bare "HH:mm" with no date -- arrivalTime
// earlier than departureTime means the leg crosses midnight, not that it
// took negative time.
function overnightCandidate(): RouteCandidate {
  return {
    legs: [
      {
        trainId: "TRAIN_OVERNIGHT",
        fromStationId: "STA_A",
        toStationId: "STA_D",
        departureTime: "23:50",
        arrivalTime: "00:10",
      },
    ],
  };
}

function overnightCongestion(): CongestionDatasetPayload {
  return {
    schemaVersion: 1,
    profiles: [
      {
        railwayId: "RAIL_X",
        legKey: "STA_A-STA_D",
        // floorToTimeBucket("23:50") -- must match, or the strategy fails
        // with insufficient_data before totalMinutes is ever computed.
        timeBucket: "23:45",
        dayType: "weekday",
        carNumber: 1,
        loadScore: 0.5,
        sampleSize: 10,
      },
    ],
  };
}

function congestionFor(
  loadScoreByTrain: Record<string, number>,
): CongestionDatasetPayload {
  return {
    schemaVersion: 1,
    profiles: Object.entries(loadScoreByTrain).map(([legKey, loadScore]) => ({
      railwayId: "RAIL_X",
      legKey,
      timeBucket: "07:00",
      dayType: "weekday",
      carNumber: 1,
      loadScore,
      sampleSize: 10,
    })),
  };
}

const emptyCorrection: CorrectionDatasetPayload = {
  schemaVersion: 1,
  stats: [],
};

// rankRoutes no longer takes datasets -- it takes a CongestionStrategy that
// already owns them. Tests build one per congestion fixture.
function strategyFor(congestion: CongestionDatasetPayload) {
  return createModeledStrategy({
    timetable,
    congestion,
    correction: emptyCorrection,
  });
}

describe("rankRoutes", () => {
  it("should return an empty ranking when there are no candidates", () => {
    const result = rankRoutes(
      [],
      strategyFor(congestionFor({})),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual([]);
    }
  });

  it("should rank routes without the caller supplying congestion data", () => {
    const result = rankRoutes(
      [fastCandidate()],
      strategyFor(congestionFor({ "STA_A-STA_D": 0.5 })),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].prediction.provenance).toBe("modeled");
    }
  });

  it("should select the minimum-total-time candidate as fastest", () => {
    const congestion = congestionFor({ "STA_A-STA_D": 0.5 });
    const result = rankRoutes(
      [slowCandidate(), fastCandidate()],
      strategyFor(congestion),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const fastest = result.data.find((r) => r.type === "fastest");
      expect(fastest?.candidate.legs[0]?.trainId).toBe("TRAIN_FAST");
      expect(fastest?.diffFromFastestMinutes).toBe(0);
    }
  });

  it("should select a less-crowded (more comfortable) candidate over the fastest when it's within maxExtraMinutes and less crowded", () => {
    // both candidates share one legKey in this fixture (same congestion
    // profile), so give the slow candidate its own distinguishable
    // congestion via a per-candidate override by using different fromStation.
    const roomySlow: RouteCandidate = {
      legs: [
        {
          trainId: "TRAIN_ROOMY",
          fromStationId: "STA_B",
          toStationId: "STA_D",
          departureTime: "07:05",
          arrivalTime: "07:30",
        },
      ],
    };
    const congestion = congestionFor({
      "STA_A-STA_D": 0.9,
      "STA_B-STA_D": 0.1,
    });

    const result = rankRoutes(
      [fastCandidate(), roomySlow],
      strategyFor(congestion),
      { ...DEFAULT_PREFERENCE, maxExtraMinutes: 30 },
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const comfort = result.data.find((r) => r.type === "comfort");
      expect(comfort?.candidate.legs[0]?.trainId).toBe("TRAIN_ROOMY");
      // "追加 N 分で予想立ち時間を M 分削減" -- comfort costs extra time
      // over the fastest option.
      expect(comfort?.diffFromFastestMinutes).toBeGreaterThan(0);
    }
  });

  it("should return 3 distinct types when at least 3 distinct candidates exist", () => {
    const roomySlow: RouteCandidate = {
      legs: [
        {
          trainId: "TRAIN_ROOMY",
          fromStationId: "STA_B",
          toStationId: "STA_D",
          departureTime: "07:05",
          arrivalTime: "07:25",
        },
      ],
    };
    const middle: RouteCandidate = {
      legs: [
        {
          trainId: "TRAIN_MIDDLE",
          fromStationId: "STA_C",
          toStationId: "STA_D",
          departureTime: "07:02",
          arrivalTime: "07:22",
        },
      ],
    };
    const congestion = congestionFor({
      "STA_A-STA_D": 0.9,
      "STA_B-STA_D": 0.1,
      "STA_C-STA_D": 0.5,
    });

    const result = rankRoutes(
      [fastCandidate(), roomySlow, middle],
      strategyFor(congestion),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.map((r) => r.type).sort()).toEqual([
        "balanced",
        "comfort",
        "fastest",
      ]);
      const trainIds = new Set(
        result.data.map((r) => r.candidate.legs[0]?.trainId),
      );
      expect(trainIds.size).toBe(3);
    }
  });

  it("should include full metrics for each ranked route (4.2)", () => {
    const congestion = congestionFor({ "STA_A-STA_D": 0.5 });
    const result = rankRoutes(
      [fastCandidate()],
      strategyFor(congestion),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const route = result.data[0];
      expect(route).toMatchObject({
        arrivalTime: "07:20",
        totalMinutes: 20,
        transferCount: 0,
      });
      expect(route?.prediction.seatProbability).toBeGreaterThanOrEqual(0);
      expect(route?.prediction.confidence).toBeDefined();
    }
  });

  it("should skip candidates with no matching congestion data and rank the rest", () => {
    const congestion = congestionFor({ "STA_A-STA_D": 0.5 });
    const noDataCandidate: RouteCandidate = {
      legs: [
        {
          trainId: "TRAIN_NO_DATA",
          fromStationId: "STA_B",
          toStationId: "STA_D",
          departureTime: "07:01",
          arrivalTime: "07:21",
        },
      ],
    };

    const result = rankRoutes(
      [fastCandidate(), noDataCandidate],
      strategyFor(congestion),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const trainIds = result.data.map((r) => r.candidate.legs[0]?.trainId);
      expect(trainIds).not.toContain("TRAIN_NO_DATA");
      expect(trainIds).toContain("TRAIN_FAST");
    }
  });

  it("should return insufficient_data when no candidate has any matching congestion data", () => {
    const result = rankRoutes(
      [fastCandidate()],
      strategyFor(congestionFor({})),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("insufficient_data");
    }
  });

  it("should report a positive totalMinutes for a candidate whose leg crosses midnight", () => {
    const result = rankRoutes(
      [overnightCandidate()],
      strategyFor(overnightCongestion()),
      DEFAULT_PREFERENCE,
      "weekday",
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.length).toBeGreaterThan(0);
      // 23:50 -> 00:10 is a 20-minute trip, not -1420 -- a raw
      // minutesOfDay(arrival) - minutesOfDay(departure) would have produced
      // the latter and made this candidate falsely dominate "fastest".
      for (const route of result.data) {
        expect(route.totalMinutes).toBeCloseTo(20, 5);
      }
    }
  });
});
