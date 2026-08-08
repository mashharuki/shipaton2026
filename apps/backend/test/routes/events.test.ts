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

// 10.1: "一連の操作後、D1 上の SQL で「起動→検索→閲覧→選択→乗車→フィードバック
// →Paywall→購入」のファネルが再構成できる" -- this exercises the exact event
// names now wired at each frontend trigger point (onboarding.tsx,
// use-route-search.ts, results.tsx, coach-store.ts, feedback.tsx,
// use-paywall-gate.ts, paywall.tsx) end-to-end through the real /v1/events
// route and asserts the funnel is reconstructable with a plain SQL query.
describe("funnel reconstruction (10.1)", () => {
  it("reconstructs a full free->paywall->purchase funnel for one session via SQL", async () => {
    const sessionId = "funnel-session-purchase";
    const t = (offsetSeconds: number) =>
      new Date(1738560000000 + offsetSeconds * 1000).toISOString();

    const res = await post({
      events: [
        makeEvent(sessionId, {
          name: "onboarding_completed",
          props: {},
          occurredAt: t(0),
        }),
        makeEvent(sessionId, {
          name: "search_started",
          props: { timeBucket: "07:30" },
          occurredAt: t(1),
        }),
        makeEvent(sessionId, {
          name: "search_completed",
          props: { timeBucket: "07:30" },
          occurredAt: t(2),
        }),
        makeEvent(sessionId, {
          name: "route_selected",
          props: {
            routeType: "comfort",
            diffFromFastestMinutes: 4,
            confidence: "high",
            planType: "free",
          },
          occurredAt: t(3),
        }),
        makeEvent(sessionId, { name: "trip_started", occurredAt: t(4) }),
        makeEvent(sessionId, {
          name: "feedback_submitted",
          occurredAt: t(5),
        }),
        makeEvent(sessionId, {
          name: "paywall_shown",
          props: { paywallTrigger: "search_limit" },
          occurredAt: t(6),
        }),
        makeEvent(sessionId, {
          name: "purchase_completed",
          props: { planType: "pro" },
          occurredAt: t(7),
        }),
      ],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 8 });

    // The funnel query a real operator would run: every stage's event name,
    // in the order it happened, for one session.
    const { results } = await env.DB.prepare(
      "SELECT name FROM analytics_events WHERE session_id = ? ORDER BY created_at ASC",
    )
      .bind(sessionId)
      .all<{ name: string }>();

    expect(results.map((row) => row.name)).toEqual([
      "onboarding_completed",
      "search_started",
      "search_completed",
      "route_selected",
      "trip_started",
      "feedback_submitted",
      "paywall_shown",
      "purchase_completed",
    ]);

    // 17.2: props survive the round trip so the funnel can be sliced by
    // route type / paywall trigger / plan, not just counted.
    const routeSelected = await env.DB.prepare(
      "SELECT props_json FROM analytics_events WHERE session_id = ? AND name = 'route_selected'",
    )
      .bind(sessionId)
      .first<{ props_json: string }>();
    expect(JSON.parse(routeSelected?.props_json ?? "{}")).toEqual({
      routeType: "comfort",
      diffFromFastestMinutes: 4,
      confidence: "high",
      planType: "free",
    });
  });

  it("reconstructs a trial-start funnel distinctly from a direct purchase", async () => {
    const sessionId = "funnel-session-trial";

    const res = await post({
      events: [
        makeEvent(sessionId, {
          name: "paywall_shown",
          props: { paywallTrigger: "pro_feature" },
          occurredAt: "2026-08-04T07:30:00.000Z",
        }),
        makeEvent(sessionId, {
          name: "trial_started",
          props: { planType: "pro" },
          occurredAt: "2026-08-04T07:30:01.000Z",
        }),
      ],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 2 });

    const { results } = await env.DB.prepare(
      "SELECT name FROM analytics_events WHERE session_id = ? ORDER BY created_at ASC",
    )
      .bind(sessionId)
      .all<{ name: string }>();

    expect(results.map((row) => row.name)).toEqual([
      "paywall_shown",
      "trial_started",
    ]);
  });

  it("counts restore/failure outcomes per paywall trigger across sessions", async () => {
    const res = await post({
      events: [
        makeEvent("funnel-session-restore", {
          name: "purchase_restored",
          props: { planType: "pro" },
          occurredAt: "2026-08-04T08:00:00.000Z",
        }),
        makeEvent("funnel-session-failed", {
          name: "purchase_failed",
          props: {},
          occurredAt: "2026-08-04T08:00:01.000Z",
        }),
      ],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accepted: 2 });

    const { results } = await env.DB.prepare(
      `SELECT name, COUNT(*) AS c FROM analytics_events
       WHERE session_id IN ('funnel-session-restore', 'funnel-session-failed')
       GROUP BY name ORDER BY name`,
    ).all<{ name: string; c: number }>();

    expect(results).toEqual([
      { name: "purchase_failed", c: 1 },
      { name: "purchase_restored", c: 1 },
    ]);
  });
});
