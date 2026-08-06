import {
  applyD1Migrations,
  type D1Migration,
  env,
  SELF,
} from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const API_KEY = "test-shared-key";

function authed(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...init.headers, "x-api-key": API_KEY },
  };
}

function post(body: unknown) {
  return SELF.fetch(
    "http://localhost/v1/events",
    authed({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function makeEvent(sessionId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: "route_selected",
    props: { railwayId: "RAIL_CHUO", routeType: "comfort" },
    sessionId,
    occurredAt: "2026-08-04T07:30:00.000Z",
    ...overrides,
  };
}

async function eventCount(): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM analytics_events",
  ).first<{ c: number }>();
  return row?.c ?? 0;
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("POST /v1/events", () => {
  it("saves a batch and returns the accepted count", async () => {
    const before = await eventCount();

    const res = await post({
      events: [
        makeEvent("session-a"),
        makeEvent("session-a", { name: "search_started" }),
        makeEvent("session-b", { name: "paywall_shown" }),
      ],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 3 });
    expect(await eventCount()).toBe(before + 3);
  });

  it("returns 413 and saves nothing when the batch exceeds 20 events", async () => {
    const before = await eventCount();

    const res = await post({
      events: Array.from({ length: 21 }, (_, i) => makeEvent(`session-${i}`)),
    });

    expect(res.status).toBe(413);
    expect(await eventCount()).toBe(before);
  });

  it("rejects an event carrying a field outside the props contract", async () => {
    const before = await eventCount();

    const res = await post({
      events: [
        makeEvent("session-c", {
          props: { railwayId: "RAIL_CHUO", lat: 35.6895, lng: 139.6917 },
        }),
      ],
    });

    expect(res.status).toBe(400);
    expect(await eventCount()).toBe(before);
  });
});
