import {
  type AppError,
  createAppError,
  type DayType,
  err,
  ok,
  type Result,
} from "shared";

import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";

export type RouteLeg = {
  trainId: string;
  fromStationId: string;
  toStationId: string;
  departureTime: string;
  arrivalTime: string;
};

export type RouteCandidate = {
  legs: RouteLeg[];
};

export type RouteSearchQuery = {
  fromStationId: string;
  toStationId: string;
  departureTime: string;
  dayType: DayType;
};

type TimetableStop = TimetableDatasetPayload["trainTimetables"][number];

type TrainStops = {
  trainId: string;
  // Sorted into this train's own physical stop order -- comparing *index*
  // within this array (not raw station `seq`) is what determines "before/
  // after" on a given train, since `seq` is only meaningful for ordering
  // stations that share a railway, and two different trains being compared
  // against each other (transfer search) may not.
  stops: TimetableStop[];
};

function stopsByTrain(
  timetable: TimetableDatasetPayload,
  dayType: DayType,
  seqByStation: Map<string, number>,
): TrainStops[] {
  const grouped = new Map<string, TimetableStop[]>();
  for (const entry of timetable.trainTimetables) {
    if (entry.dayType !== dayType || !seqByStation.has(entry.stationId)) {
      continue;
    }
    const existing = grouped.get(entry.trainId) ?? [];
    existing.push(entry);
    grouped.set(entry.trainId, existing);
  }
  return [...grouped.entries()].map(([trainId, stops]) => ({
    trainId,
    stops: [...stops].sort(
      (a, b) =>
        (seqByStation.get(a.stationId) ?? 0) -
        (seqByStation.get(b.stationId) ?? 0),
    ),
  }));
}

function stopIndex(train: TrainStops, stationId: string): number {
  return train.stops.findIndex((stop) => stop.stationId === stationId);
}

function buildLeg(
  train: TrainStops,
  from: TimetableStop,
  to: TimetableStop,
): RouteLeg {
  return {
    trainId: train.trainId,
    fromStationId: from.stationId,
    toStationId: to.stationId,
    departureTime: from.departureTime,
    arrivalTime: to.arrivalTime,
  };
}

// 3.1/3.4: enumerates candidate routes (direct, and up to 1 transfer) from
// the already-synced timetable dataset -- purely on caller-supplied data,
// no DatasetRepository/SQLite dependency here, so it's a plain function
// testable with fixture data (this task's completion condition).
export function searchRoutes(
  timetable: TimetableDatasetPayload,
  query: RouteSearchQuery,
): Result<RouteCandidate[], AppError> {
  const seqByStation = new Map(
    timetable.stations.map((station) => [station.id, station.seq]),
  );
  if (
    !seqByStation.has(query.fromStationId) ||
    !seqByStation.has(query.toStationId)
  ) {
    return err(
      createAppError(
        "out_of_area",
        "Requested station is outside the supported network",
      ),
    );
  }

  const trains = stopsByTrain(timetable, query.dayType, seqByStation);

  const direct: RouteCandidate[] = [];
  for (const train of trains) {
    const fromIdx = stopIndex(train, query.fromStationId);
    const toIdx = stopIndex(train, query.toStationId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) {
      continue;
    }
    const fromStop = train.stops[fromIdx];
    const toStop = train.stops[toIdx];
    if (fromStop.departureTime < query.departureTime) {
      continue;
    }
    direct.push({ legs: [buildLeg(train, fromStop, toStop)] });
  }

  const transfers: RouteCandidate[] = [];
  for (const first of trains) {
    const boardIdx = stopIndex(first, query.fromStationId);
    if (boardIdx === -1) {
      continue;
    }
    const boardStop = first.stops[boardIdx];
    if (boardStop.departureTime < query.departureTime) {
      continue;
    }
    // If this train already reaches the destination, staying aboard is at
    // least as good as any transfer via it -- already covered by `direct`.
    if (stopIndex(first, query.toStationId) !== -1) {
      continue;
    }

    for (
      let transferIdx = boardIdx + 1;
      transferIdx < first.stops.length;
      transferIdx++
    ) {
      const transferStop = first.stops[transferIdx];
      if (transferStop.stationId === query.toStationId) {
        continue;
      }

      for (const second of trains) {
        if (second.trainId === first.trainId) {
          continue;
        }
        const connectIdx = stopIndex(second, transferStop.stationId);
        const alightIdx = stopIndex(second, query.toStationId);
        if (connectIdx === -1 || alightIdx === -1 || connectIdx >= alightIdx) {
          continue;
        }
        const connectStop = second.stops[connectIdx];
        const alightStop = second.stops[alightIdx];
        if (connectStop.departureTime < transferStop.arrivalTime) {
          continue;
        }
        transfers.push({
          legs: [
            buildLeg(first, boardStop, transferStop),
            buildLeg(second, connectStop, alightStop),
          ],
        });
      }
    }
  }

  return ok([...direct, ...transfers]);
}
