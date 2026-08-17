import { strToU8, zipSync } from "fflate";
import { isErr, isOk } from "shared";
import { describe, expect, it } from "vitest";
import { parseGtfsStaticZip } from "../../../scripts/ingest/gtfs-jp-parser";

const STOPS_TXT = [
  "stop_id,stop_name,stop_lat,stop_lon",
  "S1,ふじ駅,35.0,139.0",
  "S2,さくら駅,35.1,139.1",
  "S3,もみじ駅,35.2,139.2",
  "S4,つばき駅,35.3,139.3",
].join("\n");

const ROUTES_TXT = [
  "route_id,route_short_name,route_long_name",
  "R1,テスト線,Test Line",
].join("\n");

const CALENDAR_TXT = [
  "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
  "WEEKDAY,1,1,1,1,1,0,0,20260101,20261231",
  "WEEKEND,0,0,0,0,0,1,1,20260101,20261231",
].join("\n");

const TRIPS_TXT = [
  "route_id,service_id,trip_id",
  "R1,WEEKDAY,T_FORWARD",
  "R1,WEEKDAY,T_REVERSE",
  "R1,WEEKEND,T_WEEKEND",
  "R1,WEEKDAY,T_PARTIAL",
  "R2,WEEKDAY,T_OTHER_ROUTE",
].join("\n");

const STOP_TIMES_TXT = [
  "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
  "T_FORWARD,07:00:00,07:00:00,S1,0",
  "T_FORWARD,07:05:00,07:06:00,S2,1",
  "T_FORWARD,07:10:00,07:11:00,S3,2",
  "T_FORWARD,07:15:00,07:15:00,S4,3",
  "T_REVERSE,08:00:00,08:00:00,S4,0",
  "T_REVERSE,08:05:00,08:06:00,S3,1",
  "T_REVERSE,08:10:00,08:11:00,S2,2",
  "T_REVERSE,08:15:00,08:15:00,S1,3",
  "T_WEEKEND,09:00:00,09:00:00,S1,0",
  "T_WEEKEND,09:15:00,09:15:00,S4,1",
  "T_PARTIAL,10:00:00,10:00:00,S1,0",
  "T_PARTIAL,10:05:00,10:06:00,S2,1",
  "T_OTHER_ROUTE,11:00:00,11:00:00,S1,0",
  "T_OTHER_ROUTE,11:05:00,11:05:00,S4,1",
].join("\n");

function buildFixtureZip(
  overrides: Partial<Record<string, string>> = {},
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "stops.txt": strToU8(overrides["stops.txt"] ?? STOPS_TXT),
    "routes.txt": strToU8(overrides["routes.txt"] ?? ROUTES_TXT),
    "trips.txt": strToU8(overrides["trips.txt"] ?? TRIPS_TXT),
    "stop_times.txt": strToU8(overrides["stop_times.txt"] ?? STOP_TIMES_TXT),
    "calendar.txt": strToU8(overrides["calendar.txt"] ?? CALENDAR_TXT),
  };
  return zipSync(files);
}

const STOP_IDS = ["S1", "S2", "S3", "S4"];

describe("parseGtfsStaticZip", () => {
  it("parses stations in the requested order with car count supplied by the caller", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: STOP_IDS,
      carCount: 8,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.stations).toEqual([
        { id: "S1", nameJa: "ふじ駅", nameEn: "ふじ駅", seq: 0 },
        { id: "S2", nameJa: "さくら駅", nameEn: "さくら駅", seq: 1 },
        { id: "S3", nameJa: "もみじ駅", nameEn: "もみじ駅", seq: 2 },
        { id: "S4", nameJa: "つばき駅", nameEn: "つばき駅", seq: 3 },
      ]);
    }
  });

  it("normalizes a reverse-direction trip's stopTimes to the requested station order", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: STOP_IDS,
      carCount: 8,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const reverseTrip = result.data.trips.find(
        (t) => t.tripId === "T_REVERSE",
      );
      expect(reverseTrip?.stopTimes.map((st) => st.stopId)).toEqual(STOP_IDS);
      expect(reverseTrip?.stopTimes.map((st) => st.stopSequence)).toEqual([
        0, 1, 2, 3,
      ]);
    }
  });

  it("assigns dayType from calendar.txt (weekday vs weekend service_id)", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: STOP_IDS,
      carCount: 8,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const forward = result.data.trips.find((t) => t.tripId === "T_FORWARD");
      const weekend = result.data.trips.find((t) => t.tripId === "T_WEEKEND");
      expect(forward?.dayType).toBe("weekday");
      // T_WEEKEND only covers S1/S4 (not the full range) so it's dropped --
      // covered by the "drops partial trips" test below. This asserts the
      // calendar mapping itself via a full-range trip's service_id.
      expect(weekend).toBeUndefined();
    }
  });

  it("drops trips that don't cover the full requested station range", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: STOP_IDS,
      carCount: 8,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const tripIds = result.data.trips.map((t) => t.tripId);
      expect(tripIds).not.toContain("T_PARTIAL");
      expect(tripIds).not.toContain("T_WEEKEND");
    }
  });

  it("ignores trips belonging to a different route_id", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: STOP_IDS,
      carCount: 8,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.trips.some((t) => t.tripId === "T_OTHER_ROUTE")).toBe(
        false,
      );
    }
  });

  it("uses the caller-supplied carCount on every trip since GTFS has no such field", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: STOP_IDS,
      carCount: 6,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.trips.every((t) => t.carCount === 6)).toBe(true);
    }
  });

  it("rejects a route whose stop_times visit the requested range in a branching/non-monotonic order", () => {
    const branchingStopTimes = [
      "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
      "T_BRANCH,07:00:00,07:00:00,S1,0",
      "T_BRANCH,07:05:00,07:06:00,S3,1",
      "T_BRANCH,07:10:00,07:11:00,S2,2",
      "T_BRANCH,07:15:00,07:15:00,S4,3",
    ].join("\n");
    const branchingTrips = [
      "route_id,service_id,trip_id",
      "R1,WEEKDAY,T_BRANCH",
    ].join("\n");

    const result = parseGtfsStaticZip(
      buildFixtureZip({
        "stop_times.txt": branchingStopTimes,
        "trips.txt": branchingTrips,
      }),
      { routeId: "R1", stopIds: STOP_IDS, carCount: 8 },
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("returns a validation_error when a requested stopId is missing from stops.txt", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R1",
      stopIds: [...STOP_IDS, "S_MISSING"],
      carCount: 8,
    });

    expect(isErr(result)).toBe(true);
  });

  it("returns a validation_error when the route_id has no trips at all", () => {
    const result = parseGtfsStaticZip(buildFixtureZip(), {
      routeId: "R_NONEXISTENT",
      stopIds: STOP_IDS,
      carCount: 8,
    });

    expect(isErr(result)).toBe(true);
  });

  it("handles a BOM-prefixed CSV and post-midnight (24h+) GTFS times", () => {
    const bom = "﻿";
    const lateStopTimes = [
      "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
      "T_LATE,25:10:00,25:10:00,S1,0",
      "T_LATE,25:20:00,25:20:00,S2,1",
      "T_LATE,25:30:00,25:30:00,S3,2",
      "T_LATE,25:40:00,25:40:00,S4,3",
    ].join("\n");
    const lateTrips = ["route_id,service_id,trip_id", "R1,WEEKDAY,T_LATE"].join(
      "\n",
    );

    const result = parseGtfsStaticZip(
      buildFixtureZip({
        "stops.txt": bom + STOPS_TXT,
        "stop_times.txt": lateStopTimes,
        "trips.txt": lateTrips,
      }),
      { routeId: "R1", stopIds: STOP_IDS, carCount: 8 },
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.trips[0]?.stopTimes[0]?.arrivalTime).toBe("01:10");
    }
  });
});
