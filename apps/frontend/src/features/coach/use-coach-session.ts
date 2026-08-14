import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  type AppError,
  type ComfortEstimate,
  err,
  isErr,
  ok,
  type Result,
  toDayType,
} from "shared";

import {
  getCongestionData,
  getCorrectionData,
  getTimetableData,
} from "@/features/dataset/dataset-repository";
import {
  type CongestionDatasetPayload,
  type CorrectionDatasetPayload,
  createSqliteDatasetStore,
  type TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";
import { createModeledStrategy } from "@/features/prediction/strategies/modeled-strategy";
import type { Station } from "@/features/prediction/use-route-detail";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { floorToTimeBucket } from "@/lib/clock-time";
import { getDb } from "@/lib/db";
import {
  buildStopSequence,
  deriveCoachProgress,
  resolveDelayMinutes,
} from "./coach-session";
import { useTrainStatus } from "./use-train-status";

const TICK_INTERVAL_MS = 15000;

export type CoachSnapshot = {
  currentStation: Station;
  nextStation: Station | null;
  remainingStops: number;
  isApproachingDestination: boolean;
  currentLeg: RouteLeg;
  legKey: string;
  boardedAt: string;
  prediction: ComfortEstimate;
  aheadStationProbabilities: ReadonlyArray<{
    station: Station;
    probability: number;
  }>;
  delayMinutes: number;
  trainStatusStale: boolean;
};

function currentTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

type DatasetBundle = {
  timetable: TimetableDatasetPayload;
  congestion: CongestionDatasetPayload;
  correction: CorrectionDatasetPayload;
};

function computeSnapshot(
  legs: RouteLeg[],
  stops: ReturnType<typeof buildStopSequence>,
  { timetable, congestion, correction }: DatasetBundle,
  delayMinutes: number,
  trainStatus: Result<
    { delayMinutes: number; stale?: boolean; fetchedAt: string },
    AppError
  > | null,
): CoachSnapshot | null {
  if (legs.length === 0 || stops.length === 0) {
    return null;
  }

  const now = currentTimeString(new Date());
  const progress = deriveCoachProgress(stops, now);
  const leg = legs[progress.currentLegIndex];
  if (!leg) {
    return null;
  }

  const stationsById = new Map(
    timetable.stations.map((station) => [station.id, station]),
  );
  const currentStation = stationsById.get(progress.currentStationId);
  const nextStation = progress.nextStationId
    ? (stationsById.get(progress.nextStationId) ?? null)
    : null;
  if (!currentStation) {
    return null;
  }

  // Not a congestion lookup key -- this is the leg identifier the feedback
  // API is keyed by (see use-feedback.ts), carried on the snapshot for
  // coach.tsx's feedback hand-off.
  const legKey = `${leg.fromStationId}-${leg.toStationId}`;
  const boardedAt = floorToTimeBucket(leg.departureTime);
  const dayType = toDayType(new Date());

  const strategy = createModeledStrategy({ timetable, congestion, correction });
  const predicted = strategy.estimate({
    fromStationId: leg.fromStationId,
    toStationId: leg.toStationId,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime,
    dayType,
    delayMinutes,
  });
  if (isErr(predicted)) {
    return null;
  }

  // segments[0] starts at the boarding station, so skip it and take each
  // later segment's origin -- the intermediate stops, with the probability
  // in effect on arriving there.
  const aheadStationProbabilities = predicted.data.segments
    .slice(1)
    .map((segment) => {
      const station = stationsById.get(segment.fromStopId);
      return station
        ? { station, probability: segment.seatProbability }
        : undefined;
    })
    .filter(
      (entry): entry is { station: Station; probability: number } =>
        entry !== undefined && entry.station.seq > currentStation.seq,
    );

  return {
    currentStation,
    nextStation,
    remainingStops: progress.remainingStops,
    isApproachingDestination: progress.isApproachingDestination,
    currentLeg: leg,
    legKey,
    boardedAt,
    prediction: predicted.data,
    aheadStationProbabilities,
    delayMinutes,
    trainStatusStale:
      !!trainStatus && !isErr(trainStatus) && Boolean(trainStatus.data.stale),
  };
}

// 7.1/7.2: composes the (untested, native-runtime-only) dataset fetch with
// coach-session.ts's pure progression/delay logic and the CongestionStrategy
// -- same "thin hook, tested pure core" split this codebase already uses for
// use-route-detail.ts/use-route-search.ts. Each leg's prediction is computed
// against its ORIGINAL boarding/alighting station pair (the only pair the
// synthetic congestion dataset is actually keyed by -- estimating from an
// intermediate "current" station would resolve to a profile that does not
// exist and fail with insufficient_data), then re-displayed as the rider's
// position advances through it -- a redisplay of that static per-leg
// estimate, not a live per-position recompute of the underlying score.
// `computeSnapshot` below is called on every render (cheap and idempotent,
// so this is not gated on delay/tick actually changing); what changes the
// DISPLAYED values is `delayMinutes` feeding into EstimateInput's
// `delayMinutes` field (7.2) or `tick`/dataset forcing a re-render in the
// first place.
export function useCoachSession(legs: RouteLeg[] | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!legs) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [legs]);

  const datasetQuery = useQuery({
    queryKey: ["coach-session-dataset", legs],
    enabled: legs !== null && legs.length > 0,
    queryFn: async (): Promise<Result<DatasetBundle, AppError>> => {
      const db = await getDb();
      const store = createSqliteDatasetStore(db);
      const [timetableResult, congestionResult, correctionResult] =
        await Promise.all([
          getTimetableData(store),
          getCongestionData(store),
          getCorrectionData(store),
        ]);
      if (isErr(timetableResult)) {
        return err(timetableResult.error);
      }
      if (isErr(congestionResult)) {
        return err(congestionResult.error);
      }
      if (isErr(correctionResult)) {
        return err(correctionResult.error);
      }
      return ok({
        timetable: timetableResult.data,
        congestion: congestionResult.data,
        correction: correctionResult.data,
      });
    },
  });

  const stops = useMemo(() => {
    if (!legs || !datasetQuery.data || isErr(datasetQuery.data)) {
      return [];
    }
    return buildStopSequence(datasetQuery.data.data.timetable, legs);
  }, [legs, datasetQuery.data]);

  const railwayId =
    stops.length > 0 && datasetQuery.data && !isErr(datasetQuery.data)
      ? (datasetQuery.data.data.timetable.stations.find(
          (station) => station.id === stops[0]?.stationId,
        )?.railwayId ?? null)
      : null;

  const trainStatus = useTrainStatus(railwayId);
  const [delayMinutes, setDelayMinutes] = useState(0);

  useEffect(() => {
    if (!trainStatus.data) {
      return;
    }
    setDelayMinutes((previous) =>
      resolveDelayMinutes(
        previous,
        isErr(trainStatus.data) ? null : trainStatus.data.data,
      ),
    );
  }, [trainStatus.data]);

  // Deliberately NOT useMemo: `tick` only exists to force a re-render every
  // TICK_INTERVAL_MS (via setTick above) so this recomputes as real-world
  // elapsed time advances -- `now` inside computeSnapshot is re-derived from
  // `new Date()` on every call, not from `tick` itself, so there is no
  // dependency array to keep in sync (and nothing for useExhaustiveDependencies
  // to flag as unread-but-listed).
  void tick;
  const snapshot =
    legs && datasetQuery.data && !isErr(datasetQuery.data)
      ? computeSnapshot(
          legs,
          stops,
          datasetQuery.data.data,
          delayMinutes,
          trainStatus.data ?? null,
        )
      : null;

  return {
    snapshot,
    isPending: datasetQuery.isPending,
    isError: datasetQuery.data ? isErr(datasetQuery.data) : false,
    refetch: datasetQuery.refetch,
  };
}
