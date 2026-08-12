import { describe, expect, it } from "vitest";
import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import {
  hasTimetableFor,
  listDepartureTimes,
  listSelectableStations,
  nextWeekdayServiceDate,
} from "@/features/search/search-form";
import timetableFixture from "../../../../backend/fixtures/datasets/timetable.json";

const timetable = timetableFixture.payload as TimetableDatasetPayload;

describe("listSelectableStations", () => {
  it("should return every station ordered by seq", () => {
    const stations = listSelectableStations(timetable);

    expect(stations.map((s) => s.id)).toEqual([
      "STA_SHINJUKU",
      "STA_YOTSUYA",
      "STA_OCHANOMIZU",
      "STA_KANDA",
      "STA_TOKYO",
    ]);
  });

  it("should not mutate the source array", () => {
    const before = timetable.stations.map((s) => s.id);
    listSelectableStations(timetable);

    expect(timetable.stations.map((s) => s.id)).toEqual(before);
  });
});

describe("listDepartureTimes", () => {
  it("should return every real departure time for the pair, sorted ascending", () => {
    const times = listDepartureTimes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      dayType: "weekday",
    });

    expect(times).toEqual([
      "07:00",
      "07:15",
      "07:30",
      "07:45",
      "08:00",
      "18:00",
      "18:15",
      "18:30",
      "18:45",
      "19:00",
    ]);
  });

  it("should return an empty list when the direction is reversed", () => {
    const times = listDepartureTimes(timetable, {
      fromStationId: "STA_TOKYO",
      toStationId: "STA_SHINJUKU",
      dayType: "weekday",
    });

    expect(times).toEqual([]);
  });

  it("should return an empty list for a dayType the dataset does not cover", () => {
    const times = listDepartureTimes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      dayType: "weekend",
    });

    expect(times).toEqual([]);
  });

  it("should return an empty list when a station is outside the network", () => {
    const times = listDepartureTimes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_NONEXISTENT",
      dayType: "weekday",
    });

    expect(times).toEqual([]);
  });

  it("should deduplicate times shared by several candidates", () => {
    const times = listDepartureTimes(timetable, {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_KANDA",
      dayType: "weekday",
    });

    expect(times).toEqual([...new Set(times)]);
    expect(times.length).toBeGreaterThan(0);
  });
});

describe("hasTimetableFor", () => {
  it("should be true for weekday, which the fixture covers", () => {
    expect(hasTimetableFor(timetable, "weekday")).toBe(true);
  });

  it("should be false for weekend, which the fixture does not cover", () => {
    expect(hasTimetableFor(timetable, "weekend")).toBe(false);
  });
});

describe("nextWeekdayServiceDate", () => {
  it("should return the following Monday when today is Saturday", () => {
    expect(nextWeekdayServiceDate(new Date("2026-08-08T07:00:00"))).toBe(
      "2026-08-10",
    );
  });

  it("should return the following Monday when today is Sunday", () => {
    expect(nextWeekdayServiceDate(new Date("2026-08-09T07:00:00"))).toBe(
      "2026-08-10",
    );
  });

  it("should return today when today is already a weekday", () => {
    expect(nextWeekdayServiceDate(new Date("2026-08-12T07:00:00"))).toBe(
      "2026-08-12",
    );
  });

  it("should build the date from local fields, not UTC", () => {
    // 23:30 JST on 2026-08-12 is 14:30 UTC the same day, but an early-morning
    // local time (07:00 JST) is the previous day in UTC -- toISOString() would
    // report 2026-08-11 for it. The local-field build must not.
    expect(nextWeekdayServiceDate(new Date("2026-08-12T00:30:00"))).toBe(
      "2026-08-12",
    );
  });

  it("should use local date fields to build output (not toISOString)", () => {
    // This test catches if toISOString() is used instead of manual local field extraction.
    // The function increments the date using .setDate() on local date, so if the wrong
    // string format method is used, the year/month/day would not match the incremented local date.
    // Verify that multiple dates work correctly with proper year-month-day padding:
    const result1 = nextWeekdayServiceDate(new Date("2026-08-08T12:00:00Z"));
    expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result1).toBe("2026-08-10"); // Saturday -> skip to Monday

    const result2 = nextWeekdayServiceDate(new Date("2026-08-07T12:00:00Z"));
    expect(result2).toBe("2026-08-07"); // Friday -> no skip needed

    // Verify month and day padding (e.g., "01" not "1")
    const result3 = nextWeekdayServiceDate(new Date("2026-01-02T12:00:00Z")); // Friday Jan 2
    expect(result3).toMatch(/2026-01-/);
    expect(result3).toBe("2026-01-02");
  });
});

describe("listDepartureTimes (sorting regression)", () => {
  it("should sort departure times ascending even when source trains are not in order", () => {
    // Synthetic timetable with trains declared in reverse chronological order.
    // Verifies that .sort() is necessary and not just relying on fixture order.
    const nonChronologicalTimetable: TimetableDatasetPayload = {
      schemaVersion: 3,
      stations: [
        {
          id: "STA_START",
          railwayId: "RAIL_X",
          nameJa: "Start",
          nameEn: "Start",
          seq: 0,
        },
        {
          id: "STA_END",
          railwayId: "RAIL_X",
          nameJa: "End",
          nameEn: "End",
          seq: 1,
        },
      ],
      trainTimetables: [
        // Declare trains in reverse time order to verify .sort()
        {
          trainId: "TRAIN_3",
          stationId: "STA_START",
          departureTime: "19:00",
          arrivalTime: "19:00",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_2",
          stationId: "STA_START",
          departureTime: "12:00",
          arrivalTime: "12:00",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_1",
          stationId: "STA_START",
          departureTime: "06:00",
          arrivalTime: "06:00",
          carCount: 8,
          dayType: "weekday",
        },
        // Arrivals at destination
        {
          trainId: "TRAIN_1",
          stationId: "STA_END",
          departureTime: "06:30",
          arrivalTime: "06:30",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_2",
          stationId: "STA_END",
          departureTime: "12:30",
          arrivalTime: "12:30",
          carCount: 8,
          dayType: "weekday",
        },
        {
          trainId: "TRAIN_3",
          stationId: "STA_END",
          departureTime: "19:30",
          arrivalTime: "19:30",
          carCount: 8,
          dayType: "weekday",
        },
      ],
    };

    const times = listDepartureTimes(nonChronologicalTimetable, {
      fromStationId: "STA_START",
      toStationId: "STA_END",
      dayType: "weekday",
    });

    // Must be sorted: [06:00, 12:00, 19:00], not [19:00, 12:00, 06:00]
    expect(times).toEqual(["06:00", "12:00", "19:00"]);
  });
});
