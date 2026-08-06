import { describe, expect, it } from "vitest";

import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import { intermediateStationIds } from "@/lib/station-utils";

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
