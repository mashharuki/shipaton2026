import {
  type AppError,
  createAppError,
  err,
  parseToResult,
  type Result,
} from "shared";
import type { z } from "zod";

const DEFAULT_TIMEOUT_MS = 8000;

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

function isAbortError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "AbortError";
}

// 15.1/15.5: normalizes offline detection, timeout, and HTTP errors into the
// shared ApiError code vocabulary so every screen can render error state the
// same way regardless of failure origin.
export async function apiRequest<T>(
  url: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<Result<T, AppError>> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.body
        ? { "Content-Type": "application/json", ...options.headers }
        : options.headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (cause) {
    if (isAbortError(cause)) {
      return err(createAppError("timeout", "Request timed out", cause));
    }
    return err(createAppError("offline", "Network request failed", cause));
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    return err(
      createAppError(
        "http_error",
        `Request failed with status ${response.status}`,
      ),
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    return err(
      createAppError("validation_error", "Invalid response body", cause),
    );
  }

  return parseToResult(schema, json);
}
