import { useQuery } from "@tanstack/react-query";
import {
  type AppError,
  type ComfortEstimate,
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
import { getDb } from "@/lib/db";
import { deriveBoardingAdvice } from "./boarding-advice";
import { createModeledStrategy } from "./strategies/modeled-strategy";
import type { BoardingAdvice } from "./types";

export type Station = TimetableDatasetPayload["stations"][number];

export type LegBoardingDetail = {
  leg: RouteLeg;
  fromStation: Station;
  toStation: Station;
  prediction: ComfortEstimate;
  boardingAdvice: BoardingAdvice;
  // Derived from prediction.segments, with each intermediate stop resolved
  // to its display record (6.2) so route-detail.tsx doesn't need its own
  // copy of the station lookup.
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
// serializing ComfortEstimate/BoardingAdvice objects through the router.
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

      const strategy = createModeledStrategy({
        timetable,
        congestion: congestionResult.data,
        correction: correctionResult.data,
      });

      const details: LegBoardingDetail[] = [];
      for (const leg of legs) {
        const fromStation = stationsById.get(leg.fromStationId);
        const toStation = stationsById.get(leg.toStationId);
        if (!fromStation || !toStation) {
          continue;
        }

        const estimateInput = {
          fromStationId: leg.fromStationId,
          toStationId: leg.toStationId,
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
          dayType,
        };

        const predicted = strategy.estimate(estimateInput);
        if (isErr(predicted)) {
          return err(predicted.error);
        }

        const boardingAdvice = deriveBoardingAdvice(predicted.data);
        if (!boardingAdvice) {
          return err(
            createAppError(
              "insufficient_data",
              "No per-carriage congestion data for this leg",
            ),
          );
        }

        // segments[0] starts at the boarding station, so its own fromStopId
        // is not an intermediate stop -- skip it and take each later
        // segment's origin, which is exactly the set of intermediate stops
        // with the seat probability in effect on arriving there.
        const perStationProbabilities = predicted.data.segments
          .slice(1)
          .map((segment) => {
            const station = stationsById.get(segment.fromStopId);
            return station
              ? { station, probability: segment.seatProbability }
              : undefined;
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
          boardingAdvice,
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
