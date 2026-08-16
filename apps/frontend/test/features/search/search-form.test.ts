import { describe, expect, it } from "vitest";
import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import {
  hasTimetableFor,
  isSearchFormComplete,
  listDepartureTimes,
  listSelectableStations,
  nextWeekdayServiceDate,
  type SearchFormValue,
  selectableDestinations,
  selectDepartureTime,
  selectFromStation,
  selectToStation,
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
    // This test MUST fail when implementation uses toISOString() and TZ=Asia/Tokyo.
    expect(nextWeekdayServiceDate(new Date("2026-08-12T00:30:00"))).toBe(
      "2026-08-12",
    );
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
      trips: [
        // Declare trips in reverse time order to verify .sort()
        {
          tripId: "TRAIN_3",
          dayType: "weekday",
          carCount: 8,
          stopTimes: [
            {
              stopId: "STA_START",
              stopSequence: 0,
              arrivalTime: "19:00",
              departureTime: "19:00",
            },
            {
              stopId: "STA_END",
              stopSequence: 1,
              arrivalTime: "19:30",
              departureTime: "19:30",
            },
          ],
        },
        {
          tripId: "TRAIN_2",
          dayType: "weekday",
          carCount: 8,
          stopTimes: [
            {
              stopId: "STA_START",
              stopSequence: 0,
              arrivalTime: "12:00",
              departureTime: "12:00",
            },
            {
              stopId: "STA_END",
              stopSequence: 1,
              arrivalTime: "12:30",
              departureTime: "12:30",
            },
          ],
        },
        {
          tripId: "TRAIN_1",
          dayType: "weekday",
          carCount: 8,
          stopTimes: [
            {
              stopId: "STA_START",
              stopSequence: 0,
              arrivalTime: "06:00",
              departureTime: "06:00",
            },
            {
              stopId: "STA_END",
              stopSequence: 1,
              arrivalTime: "06:30",
              departureTime: "06:30",
            },
          ],
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

const emptyValue: SearchFormValue = {
  fromStationId: null,
  toStationId: null,
  departureTime: null,
};

describe("selectFromStation", () => {
  // seq order: SHINJUKU(0) - YOTSUYA(1) - OCHANOMIZU(2) - KANDA(3) - TOKYO(4)
  const stations = [
    { id: "STA_SHINJUKU", seq: 0 },
    { id: "STA_YOTSUYA", seq: 1 },
    { id: "STA_OCHANOMIZU", seq: 2 },
    { id: "STA_KANDA", seq: 3 },
    { id: "STA_TOKYO", seq: 4 },
  ];

  it("should clear the destination when it equals the newly picked origin", () => {
    const next = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      },
      "STA_TOKYO",
      stations,
    );

    expect(next).toEqual({
      fromStationId: "STA_TOKYO",
      toStationId: null,
      departureTime: null,
    });
  });

  it("should clear the destination when the new origin is no longer strictly upstream of it", () => {
    // Regression for the reachable bad state: destination Yotsuya (seq 1),
    // origin moves to Kanda (seq 3) -- the destination is now behind the
    // origin, so it must be cleared rather than silently kept invalid.
    const next = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_YOTSUYA",
        departureTime: "07:00",
      },
      "STA_KANDA",
      stations,
    );

    expect(next).toEqual({
      fromStationId: "STA_KANDA",
      toStationId: null,
      departureTime: null,
    });
  });

  it("should preserve the destination when it is still downstream of the newly picked origin", () => {
    const next = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      },
      "STA_YOTSUYA",
      stations,
    );

    expect(next).toEqual({
      fromStationId: "STA_YOTSUYA",
      toStationId: "STA_TOKYO",
      departureTime: null,
    });
  });

  it("should clear the destination when the newly picked origin is not in the station list", () => {
    // Fail closed: an unknown origin (e.g. a stale deep link) has no seq to
    // compare against, so keeping the destination would risk re-creating
    // the bug this function exists to prevent.
    const next = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      },
      "STA_REMOVED",
      stations,
    );

    expect(next).toEqual({
      fromStationId: "STA_REMOVED",
      toStationId: null,
      departureTime: null,
    });
  });

  it("should clear the destination when the current destination is not in the station list", () => {
    // Same fail-closed rule, other side: a stale saved route can reference
    // a destination the synced timetable no longer has.
    const next = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_REMOVED",
        departureTime: "07:00",
      },
      "STA_YOTSUYA",
      stations,
    );

    expect(next).toEqual({
      fromStationId: "STA_YOTSUYA",
      toStationId: null,
      departureTime: null,
    });
  });

  it("should always clear the departure time, whether or not the destination is cleared", () => {
    const clearedDestination = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      },
      "STA_TOKYO",
      stations,
    );
    const preservedDestination = selectFromStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      },
      "STA_YOTSUYA",
      stations,
    );

    expect(clearedDestination.departureTime).toBeNull();
    expect(preservedDestination.departureTime).toBeNull();
  });
});

describe("selectToStation", () => {
  it("should set the destination and clear the departure time", () => {
    const next = selectToStation(
      {
        fromStationId: "STA_SHINJUKU",
        toStationId: null,
        departureTime: "07:00",
      },
      "STA_TOKYO",
    );

    expect(next).toEqual({
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: null,
    });
  });

  it("should not change the origin", () => {
    const next = selectToStation(
      { ...emptyValue, fromStationId: "STA_SHINJUKU" },
      "STA_TOKYO",
    );

    expect(next.fromStationId).toBe("STA_SHINJUKU");
  });
});

describe("selectDepartureTime", () => {
  it("should set the departure time without touching origin or destination", () => {
    const value: SearchFormValue = {
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: null,
    };

    expect(selectDepartureTime(value, "07:00")).toEqual({
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: "07:00",
    });
  });
});

describe("selectableDestinations", () => {
  const stations = [
    { id: "STA_SHINJUKU" },
    { id: "STA_YOTSUYA" },
    { id: "STA_TOKYO" },
  ];

  it("should exclude the currently chosen origin", () => {
    expect(selectableDestinations(stations, "STA_YOTSUYA")).toEqual([
      { id: "STA_SHINJUKU" },
      { id: "STA_TOKYO" },
    ]);
  });

  it("should return every station when no origin is chosen yet", () => {
    expect(selectableDestinations(stations, null)).toEqual(stations);
  });
});

describe("isSearchFormComplete", () => {
  it("should be false when the origin is null", () => {
    expect(
      isSearchFormComplete({
        fromStationId: null,
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      }),
    ).toBe(false);
  });

  it("should be false when the destination is null", () => {
    expect(
      isSearchFormComplete({
        fromStationId: "STA_SHINJUKU",
        toStationId: null,
        departureTime: "07:00",
      }),
    ).toBe(false);
  });

  it("should be false when the departure time is null", () => {
    expect(
      isSearchFormComplete({
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: null,
      }),
    ).toBe(false);
  });

  it("should be true when all three fields are set", () => {
    expect(
      isSearchFormComplete({
        fromStationId: "STA_SHINJUKU",
        toStationId: "STA_TOKYO",
        departureTime: "07:00",
      }),
    ).toBe(true);
  });
});
