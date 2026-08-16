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

type StopTime = TimetableDatasetPayload["trips"][number]["stopTimes"][number];

type TrainStops = {
  trainId: string;
  // この便自身の stopSequence 順。路線全体の駅連番からは独立している --
  // 折返し・逆方向便は物理的な停車順が路線全体の連番と逆になるため、
  // 便ごとに閉じた順序情報が必須。
  stops: StopTime[];
};

function stopsByTrain(
  timetable: TimetableDatasetPayload,
  dayType: DayType,
  knownStationIds: Set<string>,
): TrainStops[] {
  const trains: TrainStops[] = [];
  for (const trip of timetable.trips) {
    if (trip.dayType !== dayType) {
      continue;
    }
    const stops = trip.stopTimes
      .filter((stopTime) => knownStationIds.has(stopTime.stopId))
      .sort((a, b) => a.stopSequence - b.stopSequence);
    if (stops.length > 0) {
      trains.push({ trainId: trip.tripId, stops });
    }
  }
  return trains;
}

function stopIndex(train: TrainStops, stationId: string): number {
  return train.stops.findIndex((stop) => stop.stopId === stationId);
}

function buildLeg(train: TrainStops, from: StopTime, to: StopTime): RouteLeg {
  return {
    trainId: train.trainId,
    fromStationId: from.stopId,
    toStationId: to.stopId,
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
  const knownStationIds = new Set(
    timetable.stations.map((station) => station.id),
  );
  if (
    !knownStationIds.has(query.fromStationId) ||
    !knownStationIds.has(query.toStationId)
  ) {
    return err(
      createAppError(
        "out_of_area",
        "Requested station is outside the supported network",
      ),
    );
  }

  const trains = stopsByTrain(timetable, query.dayType, knownStationIds);

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
      if (transferStop.stopId === query.toStationId) {
        continue;
      }

      for (const second of trains) {
        if (second.trainId === first.trainId) {
          continue;
        }
        const connectIdx = stopIndex(second, transferStop.stopId);
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
