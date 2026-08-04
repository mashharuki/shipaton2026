import { ERROR_CODES, type ErrorCode } from "./error-codes";

export type AppError = {
  code: ErrorCode;
  message: string;
  cause?: unknown;
};

export function createAppError(
  code: ErrorCode,
  message: string,
  cause?: unknown,
): AppError {
  return cause === undefined ? { code, message } : { code, message, cause };
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === "string" &&
    (ERROR_CODES as readonly string[]).includes(candidate.code) &&
    typeof candidate.message === "string"
  );
}

export function toAppError(value: unknown): AppError {
  if (isAppError(value)) {
    return value;
  }
  if (value instanceof Error) {
    return createAppError("unknown", value.message, value);
  }
  return createAppError("unknown", "Unknown error", value);
}
