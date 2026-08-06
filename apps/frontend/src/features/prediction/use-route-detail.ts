import { useQuery } from "@tanstack/react-query";
import {
  type AppError,
  createAppError,
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
  createSqliteDatasetStore,
  type TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { floorToTimeBucket, minutesOfDay } from "@/lib/clock-time";
import { getDb } from "@/lib/db";
import { intermediateStationIds } from "@/lib/station-utils";
import { predictLeg, recommendBoarding } from "./prediction-engine";
import type { BoardingAdvice, PredictionResult } from "./types";

export type Station = TimetableDatasetPayload["stations"][number];

export type LegBoardingDetail = {
  leg: RouteLeg;
  fromStation: Station;
  toStation: Station;
  prediction: PredictionResult;
  boardingAdvice: BoardingAdvice;
  // Same data as prediction.perStationSeatProbability, with each stationId
  // resolved to its display record (6.2) so route-detail.tsx doesn't need
  // its own copy of the station lookup.
  perStationProbabilities: ReadonlyArray<{
    station: Station;
    probability: number;
  }>;
};

// 6.1-6.4: given the legs of an already-selected route (from results.tsx),
// recomputes prediction + boarding advice for each leg from the locally
// synced dataset -- deliberately recomputed rather than passed through
// navigation params, since PredictionEngine's own invariant (design.md:
// "同一入力＋同一データセット版 → 同一出力") makes this safe and it avoids
// serializing PredictionResult/BoardingAdvice objects through the router.
export function useRouteDetail(legs: RouteLeg[] | null) {
  return useQuery({
    queryKey: ["route-detail", legs],
    enabled: legs !== null && legs.length > 0,
    queryFn: async (): Promise<Result<LegBoardingDetail[], AppError>> => {
      if (!legs) {
        // Unreachable given `enabled`, but keeps the function total.
        return err(createAppError("unknown", "No route selected"));
      }

      const db = await getDb();
      const store = createSqliteDatasetStore(db);
      const dayType = toDayType(new Date());

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

      const timetable = timetableResult.data;
      const stationsById = new Map(
        timetable.stations.map((station) => [station.id, station]),
      );

      const details: LegBoardingDetail[] = [];
      for (const leg of legs) {
        const fromStation = stationsById.get(leg.fromStationId);
        const toStation = stationsById.get(leg.toStationId);
        if (!fromStation || !toStation) {
          continue;
        }

        const legKey = `${leg.fromStationId}-${leg.toStationId}`;
        const timeBucket = floorToTimeBucket(leg.departureTime);
        const tripMinutes =
          minutesOfDay(leg.arrivalTime) - minutesOfDay(leg.departureTime);

        const predicted = predictLeg(
          congestionResult.data,
          correctionResult.data,
          {
            railwayId: fromStation.railwayId,
            legKey,
            timeBucket,
            dayType,
            tripMinutes,
            intermediateStationIds: intermediateStationIds(
              timetable,
              leg.fromStationId,
              leg.toStationId,
            ),
          },
        );
        if (isErr(predicted)) {
          return err(predicted.error);
        }

        const boarding = recommendBoarding(congestionResult.data, {
          railwayId: fromStation.railwayId,
          legKey,
          timeBucket,
          dayType,
        });
        if (isErr(boarding)) {
          return err(boarding.error);
        }

        const perStationProbabilities = predicted.data.perStationSeatProbability
          .map(({ stationId, probability }) => {
            const station = stationsById.get(stationId);
            return station ? { station, probability } : undefined;
          })
          .filter(
            (entry): entry is { station: Station; probability: number } =>
              entry !== undefined,
          );

        details.push({
          leg,
          fromStation,
          toStation,
          prediction: predicted.data,
          boardingAdvice: boarding.data,
          perStationProbabilities,
        });
      }

      if (details.length === 0) {
        return err(
          createAppError("insufficient_data", "No leg could be resolved"),
        );
      }

      return ok(details);
    },
  });
}
