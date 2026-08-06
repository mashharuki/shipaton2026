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
