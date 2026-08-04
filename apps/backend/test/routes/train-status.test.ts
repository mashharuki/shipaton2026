import { env, SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_KEY = "test-shared-key";

function authed(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...init.headers, "x-api-key": API_KEY },
  };
}

function odptResponse(entries: unknown[]): Response {
  return new Response(JSON.stringify(entries), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(async () => {
  // KV state is not test-isolated in this project's pool config, so each
  // test clears the keys it depends on rather than assuming a clean slate.
  await env.STATUS_CACHE.delete("train-status:fresh:RAIL_CHUO");
  await env.STATUS_CACHE.delete("train-status:last:RAIL_CHUO");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /v1/train-status/:railwayId", () => {
  it("fetches from ODPT on a cache miss and caches the fresh result", async () => {
    // Constructed inside the mock implementation (not via mockResolvedValue
    // with a pre-built Response) so the Response is created within the
    // request's own IoContext -- Workers throws "Cannot perform I/O on
    // behalf of a different request" reading the body of one built earlier
    // in the outer test context.
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      odptResponse([
        { "odpt:trainInformationStatus": { ja: "平常運転", en: "Normal" } },
      ]),
    );

    const res = await SELF.fetch(
      "http://localhost/v1/train-status/RAIL_CHUO",
      authed(),
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      status: string;
      delayMinutes: number;
      stale?: boolean;
    }>();
    expect(body.status).toBe("normal");
    expect(body.delayMinutes).toBe(0);
    expect(body.stale).toBeUndefined();

    const cached = await env.STATUS_CACHE.get("train-status:fresh:RAIL_CHUO");
    expect(cached).not.toBeNull();
  });

  it("returns the cached value without calling ODPT again on a cache hit", async () => {
    await env.STATUS_CACHE.put(
      "train-status:fresh:RAIL_CHUO",
      JSON.stringify({
        status: "delayed",
        delayMinutes: 5,
        fetchedAt: "2026-08-04T07:00:00.000Z",
      }),
      { expirationTtl: 60 },
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await SELF.fetch(
      "http://localhost/v1/train-status/RAIL_CHUO",
      authed(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "delayed",
      delayMinutes: 5,
      fetchedAt: "2026-08-04T07:00:00.000Z",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to the last known value with stale:true when ODPT is unreachable", async () => {
    await env.STATUS_CACHE.put(
      "train-status:last:RAIL_CHUO",
      JSON.stringify({
        status: "normal",
        delayMinutes: 0,
        fetchedAt: "2026-08-04T06:00:00.000Z",
      }),
    );
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const res = await SELF.fetch(
      "http://localhost/v1/train-status/RAIL_CHUO",
      authed(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "normal",
      delayMinutes: 0,
      fetchedAt: "2026-08-04T06:00:00.000Z",
      stale: true,
    });
  });

  it("returns 502 when ODPT is unreachable and there is no cached fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const res = await SELF.fetch(
      "http://localhost/v1/train-status/RAIL_CHUO",
      authed(),
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: { code: "http_error" } });
  });

  it("returns 404 for a railway outside the MVP scope without calling ODPT", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await SELF.fetch(
      "http://localhost/v1/train-status/RAIL_UNKNOWN",
      authed(),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "http_error" } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
