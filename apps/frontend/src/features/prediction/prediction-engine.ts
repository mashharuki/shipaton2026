import {
  type AppError,
  confidenceForSampleSize,
  createAppError,
  err,
  ok,
  type Result,
  scorePrediction,
} from "shared";

import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
} from "@/features/dataset/dataset-store";
import type {
  BoardingAdvice,
  CarComparison,
  PredictionResult,
  PredictLegQuery,
  RecommendBoardingQuery,
} from "./types";

// Fixture data (and, pre-launch, real production data -- correction.json
// ships empty per 2.3's note) has no per-intermediate-station granularity:
// congestion profiles are keyed by the whole boarding-to-alighting leg, not
// sub-legs. Rather than fabricate false precision, this interpolates a
// small, documented, monotonically-increasing step per station traveled
// (further along the route => more chances someone ahead of you already
// got off), starting from the leg's own seatProbability.
const PER_STATION_PROBABILITY_STEP = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// 5.1/5.2/5.6: connects DatasetRepository-fetched congestion/correction data
// (passed in, not fetched here -- keeps this a pure, deterministic function
// per design.md's Invariants: "同一入力＋同一データセット版 → 同一出力")
// to shared's scorePrediction() for the standingMinutes/confidence/factors
// formula shared with the backend, then derives the remaining
// PredictionResult fields (seatProbability, seatedMinutes, comfortScore,
// perStationSeatProbability) that scorePrediction() doesn't own.
export function predictLeg(
  congestion: CongestionDatasetPayload,
  correction: CorrectionDatasetPayload,
  query: PredictLegQuery,
): Result<PredictionResult, AppError> {
  const matchingProfiles = congestion.profiles.filter(
    (profile) =>
      profile.railwayId === query.railwayId &&
      profile.legKey === query.legKey &&
      profile.timeBucket === query.timeBucket &&
      profile.dayType === query.dayType,
  );

  if (matchingProfiles.length === 0) {
    // 5.7: no data to explain a prediction from at all -- distinct from
    // 15.3's `dataset_missing` (dataset never synced), which is caught
    // upstream by DatasetRepository before this function is ever called.
    return err(
      createAppError(
        "insufficient_data",
        "No congestion profile matches this leg/time/day",
      ),
    );
  }

  const baseLoadScore =
    matchingProfiles.reduce((sum, profile) => sum + profile.loadScore, 0) /
    matchingProfiles.length;
  const sampleSize = matchingProfiles.reduce(
    (sum, profile) => sum + profile.sampleSize,
    0,
  );

  const correctionEntry = correction.stats.find(
    (stat) =>
      stat.railwayId === query.railwayId &&
      stat.legKey === query.legKey &&
      stat.timeBucket === query.timeBucket &&
      stat.dayType === query.dayType,
  );

  const scored = scorePrediction({
    baseLoadScore,
    sampleSize,
    feedbackCorrection: correctionEntry
      ? { deltaScore: correctionEntry.deltaScore }
      : undefined,
    delayMinutes: query.delayMinutes,
  });

  const standingPoint =
    "point" in scored.standingMinutes
      ? scored.standingMinutes.point
      : (scored.standingMinutes.rangeMin + scored.standingMinutes.rangeMax) / 2;
  const seatProbability = clamp01(1 - baseLoadScore);
  const seatedMinutes = Math.max(0, query.tripMinutes - standingPoint);
  const comfortScore = clamp01(1 - standingPoint / query.tripMinutes);

  const perStationSeatProbability = query.intermediateStationIds.map(
    (stationId, index) => ({
      stationId,
      probability: clamp01(
        seatProbability + (index + 1) * PER_STATION_PROBABILITY_STEP,
      ),
    }),
  );

  return ok({
    standingMinutes: scored.standingMinutes,
    seatedMinutes,
    seatProbability,
    perStationSeatProbability,
    confidence: scored.confidence,
    sampleSizeHint: scored.sampleSizeHint,
    factors: scored.factors,
    comfortScore,
  });
}

const BOARDING_REASON_MESSAGE_KEY = "routeDetail.reason.lowestCongestion";

// 6.1/6.3: recommends the car with the lowest average congestion for this
// leg/time/day, using the same car-level profiles predictLeg() averages
// away for its leg-level estimate. Car granularity only -- the congestion
// dataset schema (congestionProfileEntrySchema) has a carNumber field but
// no door-level field, so there is nothing finer to report even if we
// wanted to (matches design.md's "号車単位の粒度のみ扱う").
export function recommendBoarding(
  congestion: CongestionDatasetPayload,
  query: RecommendBoardingQuery,
): Result<BoardingAdvice, AppError> {
  const matchingProfiles = congestion.profiles.filter(
    (profile) =>
      profile.railwayId === query.railwayId &&
      profile.legKey === query.legKey &&
      profile.timeBucket === query.timeBucket &&
      profile.dayType === query.dayType,
  );

  if (matchingProfiles.length === 0) {
    return err(
      createAppError(
        "insufficient_data",
        "No congestion profile matches this leg/time/day",
      ),
    );
  }

  const carComparisons: CarComparison[] = matchingProfiles
    .map((profile) => ({
      carNumber: profile.carNumber,
      loadScore: profile.loadScore,
      seatProbability: clamp01(1 - profile.loadScore),
    }))
    .sort((a, b) => a.carNumber - b.carNumber);

  const recommended = carComparisons.reduce((best, car) =>
    car.loadScore < best.loadScore ? car : best,
  );
  const sampleSize = matchingProfiles.reduce(
    (sum, profile) => sum + profile.sampleSize,
    0,
  );
  const carCount = Math.max(...carComparisons.map((car) => car.carNumber));

  return ok({
    recommendedCarNumber: recommended.carNumber,
    carCount,
    carComparisons,
    confidence: confidenceForSampleSize(sampleSize),
    reasonMessageKey: BOARDING_REASON_MESSAGE_KEY,
  });
}
