export const ERROR_CODES = [
  "offline",
  "timeout",
  "http_error",
  "validation_error",
  "dataset_missing",
  "out_of_area",
  "insufficient_data",
  "license_incompatible",
  "unknown",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
