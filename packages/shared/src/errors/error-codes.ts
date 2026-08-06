export const ERROR_CODES = [
  "offline",
  "timeout",
  "http_error",
  "validation_error",
  "dataset_missing",
  "unknown",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
