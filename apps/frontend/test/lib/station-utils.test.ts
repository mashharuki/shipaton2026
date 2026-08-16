import { describe, expect, it } from "vitest";

import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import {
  intermediateStationIds,
  resolveStationName,
} from "@/lib/station-utils";

const timetable: TimetableDatasetPayload = {
  schemaVersion: 1,
  stations: [
    { id: "STA_A", railwayId: "RAIL_X", nameJa: "A", nameEn: "A", seq: 0 },
    { id: "STA_B", railwayId: "RAIL_X", nameJa: "B", nameEn: "B", seq: 1 },
    { id: "STA_C", railwayId: "RAIL_X", nameJa: "C", nameEn: "C", seq: 2 },
    { id: "STA_D", railwayId: "RAIL_X", nameJa: "D", nameEn: "D", seq: 3 },
  ],
  trips: [],
};

describe("resolveStationName", () => {
  const stations = [
    { id: "STA_SHINJUKU", nameJa: "新宿", nameEn: "Shinjuku" },
    { id: "STA_TOKYO", nameJa: "東京", nameEn: "Tokyo" },
  ];

  it("should return nameJa for a found station under the ja locale", () => {
    expect(resolveStationName(stations, "STA_SHINJUKU", "ja")).toBe("新宿");
  });

  it("should return nameEn for a found station under the en locale", () => {
    expect(resolveStationName(stations, "STA_SHINJUKU", "en")).toBe("Shinjuku");
  });

  it("should return null when the station id is not in the list", () => {
    expect(resolveStationName(stations, "STA_NOWHERE", "ja")).toBeNull();
  });

  it("should return null when the stations array is empty", () => {
    expect(resolveStationName([], "STA_SHINJUKU", "ja")).toBeNull();
  });
});

describe("intermediateStationIds", () => {
  it("should return the stations strictly between from and to, in travel order", () => {
    expect(intermediateStationIds(timetable, "STA_A", "STA_D")).toEqual([
      "STA_B",
      "STA_C",
    ]);
  });

  it("should return the same stations regardless of travel direction", () => {
    expect(intermediateStationIds(timetable, "STA_D", "STA_A")).toEqual([
      "STA_B",
      "STA_C",
    ]);
  });

  it("should return an empty array for adjacent stations", () => {
    expect(intermediateStationIds(timetable, "STA_A", "STA_B")).toEqual([]);
  });

  it("should return an empty array when either station is unknown", () => {
    expect(intermediateStationIds(timetable, "STA_A", "STA_NOWHERE")).toEqual(
      [],
    );
  });
});
