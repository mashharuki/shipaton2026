export const STANDING_MINUTES_SCALE = 30;

export const DELAY_TO_STANDING_MINUTES_RATIO = 1;

export const CONFIDENCE_SAMPLE_THRESHOLDS = {
  low: 5,
  medium: 20,
} as const;

export const RANGE_CONFIDENCE_LEVELS = ["low"] as const;

export const RANGE_SPREAD_RATIO = 0.3;

export const PREDICTION_FACTOR_MESSAGE_KEYS = {
  base_profile: "prediction.factor.baseProfile",
  day_type: "prediction.factor.dayType",
  weather: "prediction.factor.weather",
  event: "prediction.factor.event",
  feedback_correction: "prediction.factor.feedbackCorrection",
  delay: "prediction.factor.delay",
} as const;
