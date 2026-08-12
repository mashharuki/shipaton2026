import { type DayType, isErr } from "shared";

import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import { searchRoutes } from "./route-search-engine";

// 3.1: the station picker offers exactly what the synced timetable covers,
// in physical line order, so an out-of-area selection is impossible from
// the UI (route-search-engine still returns out_of_area for saved routes
// and deep links that reference a stale station id).
export function listSelectableStations(
  timetable: TimetableDatasetPayload,
): TimetableDatasetPayload["stations"] {
  return [...timetable.stations].sort((a, b) => a.seq - b.seq);
}

// 3.1: derives the departure-time options by asking the real search engine
// for every candidate from midnight onward and collecting each candidate's
// boarding time. Deliberately NOT a second traversal of trainTimetables:
// reusing searchRoutes is what guarantees "every listed time yields at
// least one route", and keeps direction/dayType/in-area filtering in one
// place. Transfer candidates board at the same origin, so legs[0] carries
// the same meaning for them.
export function listDepartureTimes(
  timetable: TimetableDatasetPayload,
  query: { fromStationId: string; toStationId: string; dayType: DayType },
): string[] {
  const result = searchRoutes(timetable, {
    fromStationId: query.fromStationId,
    toStationId: query.toStationId,
    departureTime: "00:00",
    dayType: query.dayType,
  });
  if (isErr(result)) {
    return [];
  }

  const times = new Set<string>();
  for (const candidate of result.data) {
    const first = candidate.legs[0];
    if (first) {
      times.add(first.departureTime);
    }
  }
  return [...times].sort();
}

// 15.3: the bundled dataset is weekday-only, so opening the app on a
// weekend must say so rather than silently returning zero routes.
export function hasTimetableFor(
  timetable: TimetableDatasetPayload,
  dayType: DayType,
): boolean {
  return timetable.trainTimetables.some((entry) => entry.dayType === dayType);
}

const SATURDAY = 6;
const SUNDAY = 0;

// Built from local date fields rather than toISOString(): use-route-search's
// resolveDayType() parses this string as local noon, and in JST an
// early-morning UTC conversion lands on the previous calendar day.
// (lib/clock-time.ts's todayDateString() has that UTC behaviour -- do not
// copy it here.)
export function nextWeekdayServiceDate(now: Date): string {
  const date = new Date(now.getTime());
  while (date.getDay() === SATURDAY || date.getDay() === SUNDAY) {
    date.setDate(date.getDate() + 1);
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
