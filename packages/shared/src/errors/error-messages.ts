import type { ErrorCode } from "./error-codes";

export const ERROR_MESSAGE_KEYS: Record<ErrorCode, string> = {
  offline: "errors.offline",
  timeout: "errors.timeout",
  http_error: "errors.httpError",
  validation_error: "errors.validation",
  dataset_missing: "errors.datasetMissing",
  out_of_area: "errors.outOfArea",
  insufficient_data: "errors.insufficientData",
  license_incompatible: "errors.licenseIncompatible",
  unknown: "errors.unknown",
};

export function getErrorMessageKey(code: ErrorCode): string {
  return ERROR_MESSAGE_KEYS[code];
}
