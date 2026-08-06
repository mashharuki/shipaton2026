import { isErr, isOk } from "shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiRequest } from "@/lib/api-client";

const payloadSchema = z.object({ value: z.number() });

describe("apiRequest", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("should return the parsed payload when the response is ok and schema-valid", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

    const result = await apiRequest("https://api.example.com/x", payloadSchema);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({ value: 1 });
    }
  });

  it("should return an offline error when fetch rejects with a network failure", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(
        new TypeError("Network request failed"),
      ) as unknown as typeof fetch;

    const result = await apiRequest("https://api.example.com/x", payloadSchema);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("offline");
    }
  });

  it("should return a timeout error when the request is aborted after the timeout elapses", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortError = new Error("Aborted");
            abortError.name = "AbortError";
            reject(abortError);
          });
        }),
    ) as unknown as typeof fetch;

    const resultPromise = apiRequest(
      "https://api.example.com/x",
      payloadSchema,
      {
        timeoutMs: 1000,
      },
    );
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("timeout");
    }
  });

  it("should return an http_error when the response status is not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "unknown" } }), {
        status: 500,
      }),
    ) as unknown as typeof fetch;

    const result = await apiRequest("https://api.example.com/x", payloadSchema);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("http_error");
    }
  });

  it("should return a validation_error when the response body does not match the schema", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: "not-a-number" }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

    const result = await apiRequest("https://api.example.com/x", payloadSchema);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });

  it("should return a validation_error when the response body is not valid JSON", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("not json", { status: 200 }),
      ) as unknown as typeof fetch;

    const result = await apiRequest("https://api.example.com/x", payloadSchema);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("validation_error");
    }
  });
});
