import { describe, expect, it, vi } from "vitest";

// use-weekly-report.ts imports getDb from @/lib/db for its useWeeklyReport()
// hook, which pulls in expo-sqlite (a native module the Vite-based Vitest
// pipeline can't parse -- same wall documented in push-registration.test.ts).
// Only the pure aggregation functions below are under test.
vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  computeWeeklyMetrics,
  shiftWeek,
  weekWindowContaining,
} from "@/features/report/use-weekly-report";
import type { TripRecord } from "@/features/trip-history/trip-history-repository";

function trip(
  overrides: Partial<TripRecord> & { startedAt: string },
): TripRecord {
  return {
    tripId: "trip-1",
    legs: [
      {
        trainId: "T1",
        fromStationId: "STA_A",
        toStationId: "STA_B",
        departureTime: "07:30",
        arrivalTime: "08:00",
      },
    ],
    endedAt: overrides.startedAt,
    feedback: null,
    ...overrides,
  };
}

describe("weekWindowContaining", () => {
  it("should return the Monday-start/Sunday-end window for a mid-week date", () => {
    // 2026-08-05 is a Wednesday
    const window = weekWindowContaining(new Date("2026-08-05T12:00:00.000Z"));
    expect(window).toEqual({ start: "2026-08-03", end: "2026-08-09" });
  });

  it("should treat Monday itself as the start of its own window", () => {
    const window = weekWindowContaining(new Date("2026-08-03T00:00:00.000Z"));
    expect(window).toEqual({ start: "2026-08-03", end: "2026-08-09" });
  });

  it("should treat Sunday as the end of the window that started the preceding Monday", () => {
    const window = weekWindowContaining(new Date("2026-08-09T23:00:00.000Z"));
    expect(window).toEqual({ start: "2026-08-03", end: "2026-08-09" });
  });
});

describe("shiftWeek", () => {
  it("should shift a window back by one week", () => {
    const window = { start: "2026-08-03", end: "2026-08-09" };
    expect(shiftWeek(window, -1)).toEqual({
      start: "2026-07-27",
      end: "2026-08-02",
    });
  });

  it("should shift a window forward by one week", () => {
    const window = { start: "2026-08-03", end: "2026-08-09" };
    expect(shiftWeek(window, 1)).toEqual({
      start: "2026-08-10",
      end: "2026-08-16",
    });
  });
});

describe("computeWeeklyMetrics", () => {
  const window = { start: "2026-08-03", end: "2026-08-09" };

  it("should exclude trips outside the window", () => {
    const metrics = computeWeeklyMetrics(
      [trip({ startedAt: "2026-08-10T00:00:00.000Z" })],
      window,
    );
    expect(metrics.totalStandingMinutes).toBe(0);
    expect(metrics.comfortRouteCount).toBe(0);
    expect(metrics.predictionAccuracy).toBeNull();
  });

  it("should count a comfort-type trip toward comfortRouteCount", () => {
    const metrics = computeWeeklyMetrics(
      [
        trip({ startedAt: "2026-08-04T07:00:00.000Z", routeType: "comfort" }),
        trip({ startedAt: "2026-08-05T07:00:00.000Z", routeType: "fastest" }),
      ],
      window,
    );
    expect(metrics.comfortRouteCount).toBe(1);
  });

  it("should treat seated_from_start as 0 standing minutes and stood_whole_trip as the full trip duration", () => {
    const metrics = computeWeeklyMetrics(
      [
        trip({
          startedAt: "2026-08-04T07:00:00.000Z",
          feedback: { seatedOutcome: "seated_from_start" },
        }),
        trip({
          startedAt: "2026-08-05T07:00:00.000Z",
          feedback: { seatedOutcome: "stood_whole_trip" },
        }),
      ],
      window,
    );
    // seated_from_start -> 0, stood_whole_trip -> 30 min (07:30 -> 08:00)
    expect(metrics.totalStandingMinutes).toBe(30);
  });

  it("should treat seated_from_middle as half the trip duration", () => {
    const metrics = computeWeeklyMetrics(
      [
        trip({
          startedAt: "2026-08-04T07:00:00.000Z",
          feedback: {
            seatedOutcome: "seated_from_middle",
            seatedStationId: "STA_MID",
          },
        }),
      ],
      window,
    );
    // trip duration is 30 min (07:30 -> 08:00); half of that is 15
    expect(metrics.totalStandingMinutes).toBe(15);
  });

  it("should compute reducedStandingMinutes as predicted minus actual, floored at 0", () => {
    const metrics = computeWeeklyMetrics(
      [
        trip({
          startedAt: "2026-08-04T07:00:00.000Z",
          predictedStandingMinutes: 20,
          feedback: { seatedOutcome: "seated_from_start" }, // actual 0
        }),
        trip({
          startedAt: "2026-08-05T07:00:00.000Z",
          predictedStandingMinutes: 5,
          feedback: { seatedOutcome: "stood_whole_trip" }, // actual 30, predicted < actual
        }),
      ],
      window,
    );
    // trip 1: max(0, 20 - 0) = 20; trip 2: max(0, 5 - 30) = 0
    expect(metrics.reducedStandingMinutes).toBe(20);
  });

  it("should compute predictionAccuracy as the share of trips reported as-expected", () => {
    const metrics = computeWeeklyMetrics(
      [
        trip({
          startedAt: "2026-08-04T07:00:00.000Z",
          feedback: {
            seatedOutcome: "seated_from_start",
            vsExpected: "as_expected",
          },
        }),
        trip({
          startedAt: "2026-08-05T07:00:00.000Z",
          feedback: {
            seatedOutcome: "stood_whole_trip",
            vsExpected: "more_crowded_than_expected",
          },
        }),
      ],
      window,
    );
    expect(metrics.predictionAccuracy).toBeCloseTo(0.5);
  });

  it("should return a 7-entry daily breakdown covering Monday through Sunday", () => {
    const metrics = computeWeeklyMetrics(
      [
        trip({
          startedAt: "2026-08-04T07:00:00.000Z",
          predictedStandingMinutes: 10,
        }),
      ],
      window,
    );
    expect(metrics.dailyStandingMinutes).toHaveLength(7);
    expect(metrics.dailyStandingMinutes[0]).toEqual({
      date: "2026-08-03",
      minutes: 0,
    });
    expect(metrics.dailyStandingMinutes[1]).toEqual({
      date: "2026-08-04",
      minutes: 10,
    });
  });
});
