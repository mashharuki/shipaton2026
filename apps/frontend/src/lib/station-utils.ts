import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";

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
