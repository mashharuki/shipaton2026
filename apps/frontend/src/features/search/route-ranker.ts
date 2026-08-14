import {
  type AppError,
  type ComfortEstimate,
  createAppError,
  type DayType,
  err,
  isErr,
  ok,
  type Result,
} from "shared";

import type { CongestionStrategy } from "@/features/prediction/strategies/types";
import type { ComfortPreference } from "@/features/preferences/preference-store";
import { minutesOfDay } from "@/lib/clock-time";
import type { RouteCandidate } from "./route-search-engine";

export const RANKED_ROUTE_TYPES = ["fastest", "balanced", "comfort"] as const;
export type RankedRouteType = (typeof RANKED_ROUTE_TYPES)[number];

export type RankedRoute = {
  type: RankedRouteType;
  candidate: RouteCandidate;
  arrivalTime: string;
  totalMinutes: number;
  diffFromFastestMinutes: number;
  transferCount: number;
  prediction: ComfortEstimate;
};

type EvaluatedCandidate = {
  candidate: RouteCandidate;
  totalMinutes: number;
  prediction: ComfortEstimate;
};

const BALANCE_STANDING_WEIGHT = 1;

function candidateSpan(candidate: RouteCandidate): {
  fromStationId: string;
  toStationId: string;
  departureTime: string;
  arrivalTime: string;
} {
  const first = candidate.legs[0];
  const last = candidate.legs[candidate.legs.length - 1];
  return {
    fromStationId: first.fromStationId,
    toStationId: last.toStationId,
    departureTime: first.departureTime,
    arrivalTime: last.arrivalTime,
  };
}

// `dayType` は引数で受け取り素通しする。ここで現在時刻から導出すると
// design.md の Invariant「同一入力＋同一データセット版 → 同一出力」が壊れる。
function evaluate(
  candidate: RouteCandidate,
  strategy: CongestionStrategy,
  dayType: DayType,
): EvaluatedCandidate | undefined {
  const span = candidateSpan(candidate);
  const totalMinutes =
    minutesOfDay(span.arrivalTime) - minutesOfDay(span.departureTime);

  const predicted = strategy.estimate({
    fromStationId: span.fromStationId,
    toStationId: span.toStationId,
    departureTime: span.departureTime,
    arrivalTime: span.arrivalTime,
    dayType,
  });

  if (isErr(predicted)) {
    return undefined;
  }

  return { candidate, totalMinutes, prediction: predicted.data };
}

function blendedScore(
  evaluated: EvaluatedCandidate,
  preference: ComfortPreference,
): number {
  const standingPoint =
    "point" in evaluated.prediction.standingMinutes
      ? evaluated.prediction.standingMinutes.point
      : (evaluated.prediction.standingMinutes.rangeMin +
          evaluated.prediction.standingMinutes.rangeMax) /
        2;
  const speedWeight =
    preference.speedComfortBalance === "speed"
      ? 2
      : preference.speedComfortBalance === "comfort"
        ? 0.5
        : 1;
  return (
    speedWeight * evaluated.totalMinutes +
    BALANCE_STANDING_WEIGHT * standingPoint
  );
}

// 2.3/4.1: selects up to 3 distinct routes ("最速"/"バランス"/"最も快適")
// from RouteSearchEngine's candidates, using PredictionEngine (per
// candidate, treating the whole boarding-to-alighting span as one
// congestion lookup -- matching how the dataset itself is keyed) and the
// user's ComfortPreference. Candidates PredictionEngine can't score
// (insufficient_data for that specific leg) are dropped rather than
// failing the whole ranking, unless NONE can be scored.
export function rankRoutes(
  candidates: RouteCandidate[],
  strategy: CongestionStrategy,
  preference: ComfortPreference,
  dayType: DayType,
): Result<RankedRoute[], AppError> {
  if (candidates.length === 0) {
    return ok([]);
  }

  const evaluated = candidates
    .map((candidate) => evaluate(candidate, strategy, dayType))
    .filter((entry): entry is EvaluatedCandidate => entry !== undefined);

  if (evaluated.length === 0) {
    return err(
      createAppError(
        "insufficient_data",
        "No candidate route has a matching congestion profile",
      ),
    );
  }

  const fastestTotal = Math.min(...evaluated.map((e) => e.totalMinutes));
  const assigned = new Map<RouteCandidate, RankedRouteType>();

  function pick(
    type: RankedRouteType,
    choose: (pool: EvaluatedCandidate[]) => EvaluatedCandidate | undefined,
  ): void {
    const pool = evaluated.filter((e) => !assigned.has(e.candidate));
    if (pool.length === 0) {
      return;
    }
    const chosen = choose(pool);
    if (chosen) {
      assigned.set(chosen.candidate, type);
    }
  }

  pick("fastest", (pool) =>
    pool.reduce((best, e) => (e.totalMinutes < best.totalMinutes ? e : best)),
  );
  pick("comfort", (pool) => {
    const withinBudget = pool.filter(
      (e) => e.totalMinutes <= fastestTotal + preference.maxExtraMinutes,
    );
    const eligible = withinBudget.length > 0 ? withinBudget : pool;
    return eligible.reduce((best, e) =>
      e.prediction.comfortScore > best.prediction.comfortScore ? e : best,
    );
  });
  pick("balanced", (pool) =>
    pool.reduce((best, e) =>
      blendedScore(e, preference) < blendedScore(best, preference) ? e : best,
    ),
  );

  const results: RankedRoute[] = [];
  for (const [candidate, type] of assigned) {
    const evaluatedEntry = evaluated.find((e) => e.candidate === candidate);
    if (!evaluatedEntry) {
      continue;
    }
    const span = candidateSpan(candidate);
    results.push({
      type,
      candidate,
      arrivalTime: span.arrivalTime,
      totalMinutes: evaluatedEntry.totalMinutes,
      diffFromFastestMinutes: evaluatedEntry.totalMinutes - fastestTotal,
      transferCount: candidate.legs.length - 1,
      prediction: evaluatedEntry.prediction,
    });
  }

  const order: Record<RankedRouteType, number> = {
    fastest: 0,
    balanced: 1,
    comfort: 2,
  };
  return ok(results.sort((a, b) => order[a.type] - order[b.type]));
}
