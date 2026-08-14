import type {
  DayType,
  PredictionConfidence,
  PredictionFactor,
  StandingMinutesEstimate,
} from "shared";

// ModeledStrategy が shared の ComfortEstimate へ変換するための中間表現。
// アプリの他の層はこの型を見ない -- 混雑推定の契約は ComfortEstimate であり、
// この型は prediction-engine.ts と modeled-strategy.ts の間だけで閉じている。
// seatedMinutes/seatProbability/perStationSeatProbability/comfortScore は
// ここで導出される（shared の scorePrediction() は backend と共有する
// standingMinutes/confidence/factors の算出式だけを持つ）。
export type LegPrediction = {
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
