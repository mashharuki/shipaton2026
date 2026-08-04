import {
  CONFIDENCE_SAMPLE_THRESHOLDS,
  DELAY_TO_STANDING_MINUTES_RATIO,
  PREDICTION_FACTOR_MESSAGE_KEYS,
  RANGE_CONFIDENCE_LEVELS,
  RANGE_SPREAD_RATIO,
  STANDING_MINUTES_SCALE,
} from "../constants/prediction";

export type PredictionFactorKind =
  | "base_profile"
  | "day_type"
  | "weather"
  | "event"
  | "feedback_correction"
  | "delay";

export type PredictionFactor = {
  kind: PredictionFactorKind;
  contribution: number;
  messageKey: string;
};

export type PredictionConfidence = "low" | "medium" | "high";

export type StandingMinutesEstimate =
  | { point: number }
  | { rangeMin: number; rangeMax: number };

export type ScorePredictionInput = {
  baseLoadScore: number;
  sampleSize: number;
  dayTypeAdjustment?: number;
  weatherAdjustment?: number;
  eventAdjustment?: number;
  feedbackCorrection?: { deltaScore: number };
  delayMinutes?: number;
};

export type ScorePredictionResult = {
  standingMinutes: StandingMinutesEstimate;
  confidence: PredictionConfidence;
  sampleSizeHint: string;
  factors: PredictionFactor[];
};

export function scorePrediction(
  input: ScorePredictionInput,
): ScorePredictionResult {
  const factors = buildFactors(input);
  const totalMinutes = Math.max(
    0,
    factors.reduce((sum, factor) => sum + factor.contribution, 0),
  );
  const confidence = confidenceForSampleSize(input.sampleSize);

  return {
    standingMinutes: toStandingMinutesEstimate(totalMinutes, confidence),
    confidence,
    sampleSizeHint: sampleSizeHintFor(input.sampleSize),
    factors,
  };
}

function buildFactors(input: ScorePredictionInput): PredictionFactor[] {
  const factors: PredictionFactor[] = [
    {
      kind: "base_profile",
      contribution: input.baseLoadScore * STANDING_MINUTES_SCALE,
      messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.base_profile,
    },
  ];

  if (input.dayTypeAdjustment !== undefined) {
    factors.push({
      kind: "day_type",
      contribution: input.dayTypeAdjustment * STANDING_MINUTES_SCALE,
      messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.day_type,
    });
  }

  if (input.weatherAdjustment !== undefined) {
    factors.push({
      kind: "weather",
      contribution: input.weatherAdjustment * STANDING_MINUTES_SCALE,
      messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.weather,
    });
  }

  if (input.eventAdjustment !== undefined) {
    factors.push({
      kind: "event",
      contribution: input.eventAdjustment * STANDING_MINUTES_SCALE,
      messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.event,
    });
  }

  if (input.feedbackCorrection !== undefined) {
    factors.push({
      kind: "feedback_correction",
      contribution:
        input.feedbackCorrection.deltaScore * STANDING_MINUTES_SCALE,
      messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.feedback_correction,
    });
  }

  if (input.delayMinutes !== undefined && input.delayMinutes > 0) {
    factors.push({
      kind: "delay",
      contribution: input.delayMinutes * DELAY_TO_STANDING_MINUTES_RATIO,
      messageKey: PREDICTION_FACTOR_MESSAGE_KEYS.delay,
    });
  }

  return factors;
}

function confidenceForSampleSize(sampleSize: number): PredictionConfidence {
  if (sampleSize < CONFIDENCE_SAMPLE_THRESHOLDS.low) {
    return "low";
  }
  if (sampleSize < CONFIDENCE_SAMPLE_THRESHOLDS.medium) {
    return "medium";
  }
  return "high";
}

function sampleSizeHintFor(sampleSize: number): string {
  if (sampleSize < CONFIDENCE_SAMPLE_THRESHOLDS.low) {
    return `<${CONFIDENCE_SAMPLE_THRESHOLDS.low}`;
  }
  if (sampleSize < CONFIDENCE_SAMPLE_THRESHOLDS.medium) {
    return `${CONFIDENCE_SAMPLE_THRESHOLDS.low}-${CONFIDENCE_SAMPLE_THRESHOLDS.medium - 1}`;
  }
  return `${CONFIDENCE_SAMPLE_THRESHOLDS.medium}+`;
}

function toStandingMinutesEstimate(
  totalMinutes: number,
  confidence: PredictionConfidence,
): StandingMinutesEstimate {
  if (!(RANGE_CONFIDENCE_LEVELS as readonly string[]).includes(confidence)) {
    return { point: totalMinutes };
  }
  return {
    rangeMin: Math.max(0, totalMinutes * (1 - RANGE_SPREAD_RATIO)),
    rangeMax: totalMinutes * (1 + RANGE_SPREAD_RATIO),
  };
}
