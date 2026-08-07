import { useCallback, useEffect, useState } from "react";

import {
  createSqliteTripHistoryStore,
  type TripRecord,
} from "@/features/trip-history/trip-history-repository";
import { minutesOfDay } from "@/lib/clock-time";
import { getDb } from "@/lib/db";

export type WeekWindow = {
  start: string; // ISO date (Monday)
  end: string; // ISO date (Sunday)
};

type DailyStanding = {
  date: string;
  minutes: number;
};

export type WeeklyMetrics = {
  totalStandingMinutes: number;
  reducedStandingMinutes: number;
  comfortRouteCount: number;
  // null when no trip in the window has an answered vsExpected -- there's no
  // meaningful accuracy percentage to show yet, distinct from a real 0%.
  predictionAccuracy: number | null;
  dailyStandingMinutes: DailyStanding[]; // 7 entries, index 0 = window.start (Monday)
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number): string {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

// UTC-based throughout (not local-timezone getters) so this is deterministic
// under any test-runner/CI timezone -- same rationale backend's
// notify-commuters.ts documents for its own JST wall-clock math, applied
// here to the device's own calendar week instead.
function mondayOf(dateOnly: string): string {
  const weekday = new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(dateOnly, -diffToMonday);
}

// 11.1/11.4: "this week" as the user's device sees it, and the week-switch
// navigation 11.4 requires.
export function weekWindowContaining(date: Date): WeekWindow {
  const start = mondayOf(toDateOnly(date));
  return { start, end: addDays(start, 6) };
}

export function shiftWeek(window: WeekWindow, deltaWeeks: number): WeekWindow {
  const start = addDays(window.start, deltaWeeks * 7);
  return { start, end: addDays(start, 6) };
}

function tripDateOnly(trip: TripRecord): string {
  return trip.startedAt.slice(0, 10);
}

function isInWindow(trip: TripRecord, window: WeekWindow): boolean {
  const date = tripDateOnly(trip);
  return date >= window.start && date <= window.end;
}

function tripDurationMinutes(trip: TripRecord): number {
  const first = trip.legs[0];
  const last = trip.legs[trip.legs.length - 1];
  if (!first || !last) {
    return 0;
  }
  return Math.max(
    0,
    minutesOfDay(last.arrivalTime) - minutesOfDay(first.departureTime),
  );
}

// No per-intermediate-station timetable lookup is done here (that data
// exists in the dataset but isn't wired into trip history) -- seated_from_
// middle is approximated as the midpoint of the trip's total duration. This
// is a documented approximation, not a precise reconstruction.
function actualStandingMinutes(trip: TripRecord): number | null {
  if (!trip.feedback) {
    return null;
  }
  const duration = tripDurationMinutes(trip);
  switch (trip.feedback.seatedOutcome) {
    case "seated_from_start":
      return 0;
    case "stood_whole_trip":
      return duration;
    case "seated_from_middle":
      return duration / 2;
  }
}

// 11.1-11.4: pure aggregation over on-device trip history -- no network
// call, matching design.md's "端末内集計（サーバ送信なし）". Kept free of
// SQLite/React so it's directly Vitest-testable; useWeeklyReport() below is
// the thin I/O wrapper around it.
export function computeWeeklyMetrics(
  trips: TripRecord[],
  window: WeekWindow,
): WeeklyMetrics {
  const tripsInWindow = trips.filter((trip) => isInWindow(trip, window));

  let totalStandingMinutes = 0;
  let reducedStandingMinutes = 0;
  let comfortRouteCount = 0;
  let asExpectedCount = 0;
  let vsExpectedAnsweredCount = 0;

  const dailyTotals = new Map<string, { sum: number; count: number }>();
  for (let i = 0; i < 7; i++) {
    dailyTotals.set(addDays(window.start, i), { sum: 0, count: 0 });
  }

  for (const trip of tripsInWindow) {
    if (trip.routeType === "comfort") {
      comfortRouteCount++;
    }

    const actual = actualStandingMinutes(trip);
    if (actual !== null) {
      totalStandingMinutes += actual;
      if (trip.predictedStandingMinutes !== undefined) {
        reducedStandingMinutes += Math.max(
          0,
          trip.predictedStandingMinutes - actual,
        );
      }
    }

    if (trip.feedback?.vsExpected) {
      vsExpectedAnsweredCount++;
      if (trip.feedback.vsExpected === "as_expected") {
        asExpectedCount++;
      }
    }

    if (trip.predictedStandingMinutes !== undefined) {
      const bucket = dailyTotals.get(tripDateOnly(trip));
      if (bucket) {
        bucket.sum += trip.predictedStandingMinutes;
        bucket.count++;
      }
    }
  }

  const dailyStandingMinutes: DailyStanding[] = Array.from(
    { length: 7 },
    (_, i) => {
      const date = addDays(window.start, i);
      const bucket = dailyTotals.get(date);
      const minutes =
        bucket && bucket.count > 0 ? bucket.sum / bucket.count : 0;
      return { date, minutes };
    },
  );

  return {
    totalStandingMinutes,
    reducedStandingMinutes,
    comfortRouteCount,
    predictionAccuracy:
      vsExpectedAnsweredCount > 0
        ? asExpectedCount / vsExpectedAnsweredCount
        : null,
    dailyStandingMinutes,
  };
}

// 11.4: the current week plus the immediately preceding week (for the
// week-switch comparison), recomputed whenever `weekOffset` (0 = this week,
// -1 = last week, ...) changes.
export function useWeeklyReport(weekOffset: number) {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const db = await getDb();
    const store = createSqliteTripHistoryStore(db);
    setTrips(await store.listTrips());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const thisWindow = shiftWeek(weekWindowContaining(new Date()), weekOffset);
  const previousWindow = shiftWeek(thisWindow, -1);

  return {
    isLoading,
    window: thisWindow,
    current: computeWeeklyMetrics(trips, thisWindow),
    previous: computeWeeklyMetrics(trips, previousWindow),
  };
}
