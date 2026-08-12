import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";

// Plain "ja" | "en" rather than importing SupportedLocale from @/lib/i18n:
// that module runs expo-localization/i18next initialization at import time,
// which this file's node-environment vitest suite (test/lib/station-utils.test.ts)
// must not drag in.
export type StationLocale = "ja" | "en";

// Task 6 fix round 1: resolves a station id to its locale-appropriate name,
// or null when the id isn't in the given station list -- callers (home
// screen's saved-route rows and recent-search rows) must never fall back to
// rendering the raw STA_* id, since `stations` can be empty/stale before the
// dataset sync resolves or after it errors.
export function resolveStationName<
  T extends { id: string; nameJa: string; nameEn: string },
>(stations: T[], stationId: string, locale: StationLocale): string | null {
  const station = stations.find((s) => s.id === stationId);
  if (!station) {
    return null;
  }
  return locale === "ja" ? station.nameJa : station.nameEn;
}

// Approximates "intermediate stations" via station `seq` ordering (same
// dataset already used for the sync'd network) rather than re-deriving each
// specific train's stop list -- a reasonable approximation for the current
// single-railway MVP scope where every train on the line stops everywhere.
// Shared by route-ranker.ts (5.4, PredictionEngine's perStationSeatProbability
// input) and use-route-detail.ts (5.5, same purpose for the detail screen).
export function intermediateStationIds(
  timetable: TimetableDatasetPayload,
  fromStationId: string,
  toStationId: string,
): string[] {
  const seqByStation = new Map(
    timetable.stations.map((station) => [station.id, station.seq]),
  );
  const fromSeq = seqByStation.get(fromStationId);
  const toSeq = seqByStation.get(toStationId);
  if (fromSeq === undefined || toSeq === undefined) {
    return [];
  }
  const [lower, upper] = fromSeq < toSeq ? [fromSeq, toSeq] : [toSeq, fromSeq];
  return timetable.stations
    .filter((station) => station.seq > lower && station.seq < upper)
    .sort((a, b) => a.seq - b.seq)
    .map((station) => station.id);
}
