import type {
  AppError,
  ComfortEstimate,
  ComfortSegment,
  OccupancyObservation,
  OccupancyStatus,
  Result,
} from "shared";
import {
  createAppError,
  err,
  isErr,
  ok,
  PREDICTION_FACTOR_MESSAGE_KEYS,
  seatProbabilityForOccupancyStatus,
} from "shared";

import { resolveTripMinutes } from "@/lib/clock-time";
import type { CongestionStrategy, EstimateInput } from "./types";

export type MeasuredStrategyDeps = {
  /**
   * Real-time observations for any number of trips -- filtered internally
   * to `input.tripId`. Not scoped to one trip by the caller so a single
   * fetched GTFS-RT payload (which covers many trips at once) can be handed
   * straight to this strategy without pre-splitting it.
   */
  observations: OccupancyObservation[];
};

/**
 * M4 (design doc §5.4/§8, docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md):
 * Sydney TfNSW adapter's estimation half. Converts real per-carriage
 * occupancy observations into the same `ComfortEstimate` contract
 * ModeledStrategy produces, so downstream code (`deriveBoardingAdvice`,
 * `route-detail.tsx`) needs no Sydney-specific branch -- proving the
 * output-side contract (design principle 3) actually holds for a second,
 * structurally unrelated region.
 *
 * Unlike ModeledStrategy, this never applies `input.delayMinutes` as a
 * separate correction: a real-time observation already reflects whatever
 * delay is currently happening (it's not a scheduled-time estimate to
 * correct), so adding a delay factor on top would double-count it.
 */
export function createMeasuredStrategy(
  deps: MeasuredStrategyDeps,
): CongestionStrategy {
  const { observations } = deps;

  function stopOrderForTrip(tripId: string): {
    stopIds: string[];
    byStop: Map<string, OccupancyObservation[]>;
  } {
    const tripObservations = observations
      .filter(
        (observation) =>
          observation.tripId === tripId &&
          observation.stopSequence !== undefined,
      )
      .sort((a, b) => (a.stopSequence as number) - (b.stopSequence as number));

    const stopIds: string[] = [];
    const byStop = new Map<string, OccupancyObservation[]>();
    for (const observation of tripObservations) {
      const list = byStop.get(observation.stopId) ?? [];
      if (list.length === 0) {
        stopIds.push(observation.stopId);
      }
      list.push(observation);
      byStop.set(observation.stopId, list);
    }
    return { stopIds, byStop };
  }

  /**
   * A matched stop with no occupancy-status reading at all returns
   * `undefined` rather than a guessed neutral value -- the caller treats
   * that as insufficient_data instead of this function fabricating
   * precision the observations don't have.
   */
  function averageSeatProbability(
    stopObservations: OccupancyObservation[],
  ): number | undefined {
    const statuses = stopObservations
      .map((observation) => observation.occupancyStatus)
      .filter((status): status is OccupancyStatus => status !== undefined);
    if (statuses.length === 0) {
      return undefined;
    }
    const probabilities = statuses.map(seatProbabilityForOccupancyStatus);
    return probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
  }

  function buildByCarriage(
    matchedStopIds: string[],
    byStop: Map<string, OccupancyObservation[]>,
  ): ComfortEstimate["byCarriage"] {
    const probabilitiesByCarriage = new Map<number, number[]>();
    for (const stopId of matchedStopIds) {
      for (const observation of byStop.get(stopId) ?? []) {
        if (
          observation.carriageNumber === undefined ||
          observation.occupancyStatus === undefined
        ) {
          continue;
        }
        const list =
          probabilitiesByCarriage.get(observation.carriageNumber) ?? [];
        list.push(
          seatProbabilityForOccupancyStatus(observation.occupancyStatus),
        );
        probabilitiesByCarriage.set(observation.carriageNumber, list);
      }
    }

    if (probabilitiesByCarriage.size === 0) {
      // No region-specific carriage field observed -- degrade by omission,
      // same as ModeledStrategy when boarding advice can't be derived
      // (design principle 5: this is what optional `byCarriage` means).
      return undefined;
    }

    return [...probabilitiesByCarriage.entries()]
      .map(([carriageNumber, probabilities]) => ({
        carriageNumber,
        seatProbability:
          probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length,
      }))
      .sort((a, b) => a.carriageNumber - b.carriageNumber);
  }

  return {
    provenance: "measured",

    estimate(input: EstimateInput): Result<ComfortEstimate, AppError> {
      if (!input.tripId) {
        return err(
          createAppError(
            "validation_error",
            "MeasuredStrategy requires tripId",
          ),
        );
      }

      const tripMinutesResult = resolveTripMinutes(
        input.departureTime,
        input.arrivalTime,
      );
      if (isErr(tripMinutesResult)) {
        return tripMinutesResult;
      }
      const tripMinutes = tripMinutesResult.data;

      const { stopIds, byStop } = stopOrderForTrip(input.tripId);
      if (stopIds.length === 0) {
        return err(
          createAppError(
            "insufficient_data",
            `No sequenced observations for trip ${input.tripId}`,
          ),
        );
      }

      const fromIndex = stopIds.indexOf(input.fromStationId);
      const toIndex = stopIds.indexOf(input.toStationId);
      if (fromIndex === -1 || toIndex === -1) {
        return err(
          createAppError(
            "insufficient_data",
            "Boarding/alighting stop was not observed for this trip",
          ),
        );
      }
      if (fromIndex >= toIndex) {
        return err(
          createAppError(
            "validation_error",
            "fromStationId must precede toStationId in this trip's observed stop sequence",
          ),
        );
      }

      const matchedStopIds = stopIds.slice(fromIndex, toIndex + 1);
      const segmentCount = matchedStopIds.length - 1;
      const minutesPerSegment = tripMinutes / segmentCount;

      const segments: ComfortSegment[] = [];
      for (let i = 0; i < segmentCount; i++) {
        // Segment i departs matchedStopIds[i] -- its seatProbability is the
        // occupancy reading at that departure stop, mirroring
        // ModeledStrategy.buildSegments' "value in effect at the stop the
        // segment starts from" convention.
        const seatProbability = averageSeatProbability(
          byStop.get(matchedStopIds[i]) ?? [],
        );
        if (seatProbability === undefined) {
          return err(
            createAppError(
              "insufficient_data",
              `No occupancy_status observed at stop ${matchedStopIds[i]} for trip ${input.tripId}`,
            ),
          );
        }
        segments.push({
          fromStopId: matchedStopIds[i],
          toStopId: matchedStopIds[i + 1],
          minutes: minutesPerSegment,
          seatProbability,
        });
      }

      // ESM formula (design doc §5.5) -- replaces the continuous
      // loadScore-plus-corrections formula ModeledStrategy still uses,
      // because ordinal occupancy_status can't be summed with correction
      // deltas the way a continuous score can (P5).
      const standingMinutes = segments.reduce(
        (sum, segment) => sum + segment.minutes * (1 - segment.seatProbability),
        0,
      );
      const seatedMinutes = Math.max(0, tripMinutes - standingMinutes);
      const comfortScore = Math.min(
        1,
        Math.max(0, 1 - standingMinutes / tripMinutes),
      );
      const overallSeatProbability =
        segments.reduce((sum, s) => sum + s.seatProbability, 0) /
        segments.length;

      return ok({
        segments,
        byCarriage: buildByCarriage(matchedStopIds, byStop),
        provenance: "measured",
        standingMinutes: { point: standingMinutes },
        seatedMinutes,
        seatProbability: overallSeatProbability,
        confidence: "high",
        sampleSizeHint: String(
          matchedStopIds.reduce(
            (sum, stopId) => sum + (byStop.get(stopId)?.length ?? 0),
            0,
          ),
        ),
        factors: [
          {
            kind: "base_profile",
            contribution: standingMinutes,
            messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.base_profile,
          },
        ],
        comfortScore,
      });
    },
  };
}
