import type {
  DayType,
  PredictionConfidence,
  PredictionFactor,
  StandingMinutesEstimate,
} from "shared";

// design.md's PredictionEngine Service Interface (PredictionResult) --
// seatedMinutes/seatProbability/perStationSeatProbability/comfortScore are
// derived here (not part of shared's scorePrediction(), which only owns the
// standingMinutes/confidence/factors formula shared with the backend).
export type PredictionResult = {
  standingMinutes: StandingMinutesEstimate;
  seatedMinutes: number;
  seatProbability: number;
  perStationSeatProbability: ReadonlyArray<{
    stationId: string;
    probability: number;
  }>;
  confidence: PredictionConfidence;
  sampleSizeHint: string;
  factors: ReadonlyArray<PredictionFactor>;
  comfortScore: number;
};

export type PredictLegQuery = {
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: DayType;
  tripMinutes: number;
  // Stations strictly between boarding and alighting, in travel order --
  // used to build perStationSeatProbability (6.2). Empty for a direct hop
  // between adjacent stops.
  intermediateStationIds: string[];
  delayMinutes?: number;
};

export type CarComparison = {
  carNumber: number;
  loadScore: number;
  seatProbability: number;
};

// design.md 6.1-6.4's BoardingAdvice: car-level granularity only (6.3) --
// no per-door field exists anywhere in this type or its congestion-profile
// input (the dataset schema itself has no door-level field to report).
export type BoardingAdvice = {
  recommendedCarNumber: number;
  carCount: number;
  carComparisons: ReadonlyArray<CarComparison>;
  confidence: PredictionConfidence;
  reasonMessageKey: string;
};

export type RecommendBoardingQuery = {
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: DayType;
};
