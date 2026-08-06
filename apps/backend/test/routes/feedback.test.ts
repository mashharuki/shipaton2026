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
    "http://localhost/v1/feedback",
    authed({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const validPayload = {
  seatedOutcome: "seated_from_middle" as const,
  seatedStationId: "STA_YOTSUYA",
  tripId: "6f9a2b3e-4b7a-4a4b-8b2b-9b6b1e2e3f4a",
  railwayId: "RAIL_CHUO",
  legKey: "STA_SHINJUKU-STA_TOKYO",
  boardedAt: "07:30",
  vsExpected: "as_expected" as const,
  predictedStandingMin: 6,
};

describe("POST /v1/feedback", () => {
  it("saves a valid anonymous feedback payload", async () => {
    const res = await post(validPayload);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const { results } = await env.DB.prepare(
      "SELECT * FROM feedback WHERE trip_id = ?",
    )
      .bind(validPayload.tripId)
      .all<Record<string, unknown>>();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      trip_id: validPayload.tripId,
      railway_id: "RAIL_CHUO",
      leg_key: "STA_SHINJUKU-STA_TOKYO",
      time_bucket: "07:30",
      seated_outcome: "seated_from_middle",
      seated_station_id: "STA_YOTSUYA",
      vs_expected: "as_expected",
      predicted_standing_min: 6,
    });
    // No client-supplied identifier beyond the trip-scoped anonymous ID, and
    // no location field exists on the row at all (16.2, 16.4).
    expect(Object.keys(results[0]).sort()).toEqual(
      [
        "id",
        "trip_id",
        "railway_id",
        "leg_key",
        "time_bucket",
        "day_type",
        "seated_outcome",
        "seated_station_id",
        "vs_expected",
        "predicted_standing_min",
        "created_at",
      ].sort(),
    );
  });

  it("rejects a payload carrying an identifier field outside the contract", async () => {
    const before = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM feedback",
    ).first<{ c: number }>();

    const res = await post({
      ...validPayload,
      tripId: "b3e6f9a2-4b7a-4a4b-8b2b-9b6b1e2e3f4b",
      userId: "user-1",
    });
    expect(res.status).toBe(400);

    const after = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM feedback",
    ).first<{
      c: number;
    }>();
    expect(after?.c).toBe(before?.c);
  });

  it("rejects a payload carrying a location field outside the contract", async () => {
    const before = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM feedback",
    ).first<{ c: number }>();

    const res = await post({
      ...validPayload,
      tripId: "c4f709b3-5c8b-4b5c-9c3c-0c7c2f3f4c5d",
      lat: 35.6895,
      lng: 139.6917,
    });
    expect(res.status).toBe(400);

    const after = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM feedback",
    ).first<{
      c: number;
    }>();
    expect(after?.c).toBe(before?.c);
  });
});
