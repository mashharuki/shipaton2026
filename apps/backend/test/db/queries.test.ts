import { applyD1Migrations, type D1Migration, env } from "cloudflare:test";
import { isErr, isOk } from "shared";
import { beforeAll, describe, expect, it } from "vitest";
import {
  deletePushRegistration,
  getCorrectionStats,
  getMetric,
  insertAnalyticsEvent,
  insertFeedback,
  listAnalyticsEventsSince,
  listFeedbackForAggregation,
  listPushRegistrationsForWindow,
  upsertCorrectionStats,
  upsertMetric,
  upsertPushRegistration,
} from "../../src/db/queries";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("feedback queries", () => {
  it("writes a feedback row and reads it back for aggregation", async () => {
    const insertResult = await insertFeedback(env.DB, {
      id: "feedback-1",
      tripId: "trip-1",
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:30",
      dayType: "weekday",
      seatedOutcome: "seated_from_middle",
      seatedStationId: "STA_YOTSUYA",
      vsExpected: "as_expected",
      predictedStandingMin: 6,
      createdAt: "2026-08-04T07:30:00.000Z",
    });
    expect(isOk(insertResult)).toBe(true);

    const listResult = await listFeedbackForAggregation(env.DB, {
      railwayId: "RAIL_CHUO",
      sinceIso: "2026-08-01T00:00:00.000Z",
    });
    expect(isOk(listResult)).toBe(true);
    if (isOk(listResult)) {
      expect(listResult.data).toEqual([
        {
          id: "feedback-1",
          tripId: "trip-1",
          railwayId: "RAIL_CHUO",
          legKey: "STA_SHINJUKU-STA_TOKYO",
          timeBucket: "07:30",
          dayType: "weekday",
          seatedOutcome: "seated_from_middle",
          seatedStationId: "STA_YOTSUYA",
          vsExpected: "as_expected",
          predictedStandingMin: 6,
          createdAt: "2026-08-04T07:30:00.000Z",
        },
      ]);
    }
  });

  it("returns an err Result for a constraint violation instead of throwing", async () => {
    const result = await insertFeedback(env.DB, {
      id: "feedback-invalid",
      tripId: "trip-2",
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:30",
      // biome-ignore lint/suspicious/noExplicitAny: intentionally invalid to exercise the CHECK constraint
      dayType: "not_a_day_type" as any,
      seatedOutcome: "stood_whole_trip",
      seatedStationId: null,
      vsExpected: null,
      predictedStandingMin: null,
      createdAt: "2026-08-04T07:30:00.000Z",
    });
    expect(isErr(result)).toBe(true);
  });
});

describe("correction_stats queries", () => {
  it("upserts and reads a correction stats row by composite key", async () => {
    const key = {
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:30",
      dayType: "weekday" as const,
    };
    await upsertCorrectionStats(env.DB, {
      ...key,
      deltaScore: -0.05,
      sampleN: 12,
      computedAt: "2026-08-04T00:00:00.000Z",
    });

    const upserted = await upsertCorrectionStats(env.DB, {
      ...key,
      deltaScore: -0.08,
      sampleN: 20,
      computedAt: "2026-08-05T00:00:00.000Z",
    });
    expect(isOk(upserted)).toBe(true);

    const result = await getCorrectionStats(env.DB, key);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({
        ...key,
        deltaScore: -0.08,
        sampleN: 20,
        computedAt: "2026-08-05T00:00:00.000Z",
      });
    }
  });
});

describe("metrics queries", () => {
  it("upserts and reads a metric row by date", async () => {
    await upsertMetric(env.DB, {
      date: "2026-08-04",
      railwayId: "RAIL_CHUO",
      maeStandingMin: 6.5,
      n: 42,
    });

    const result = await getMetric(env.DB, "2026-08-04");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({
        date: "2026-08-04",
        railwayId: "RAIL_CHUO",
        maeStandingMin: 6.5,
        n: 42,
      });
    }
  });

  it("returns null for a date with no recorded metric", async () => {
    const result = await getMetric(env.DB, "1999-01-01");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toBeNull();
    }
  });
});

describe("analytics_events queries", () => {
  it("writes an event and reads it back since a timestamp", async () => {
    await insertAnalyticsEvent(env.DB, {
      id: "event-1",
      name: "route_selected",
      propsJson: JSON.stringify({
        railwayId: "RAIL_CHUO",
        routeType: "comfort",
      }),
      sessionId: "session-1",
      createdAt: "2026-08-04T07:31:00.000Z",
    });

    const result = await listAnalyticsEventsSince(
      env.DB,
      "2026-08-01T00:00:00.000Z",
    );
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toContainEqual({
        id: "event-1",
        name: "route_selected",
        propsJson: JSON.stringify({
          railwayId: "RAIL_CHUO",
          routeType: "comfort",
        }),
        sessionId: "session-1",
        createdAt: "2026-08-04T07:31:00.000Z",
      });
    }
  });
});

describe("push_registrations queries", () => {
  it("upserts, lists by notify window, and deletes a registration", async () => {
    await upsertPushRegistration(env.DB, {
      id: "push-1",
      expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
      lastSentDate: null,
    });

    const windowResult = await listPushRegistrationsForWindow(env.DB, "07:45");
    expect(isOk(windowResult)).toBe(true);
    if (isOk(windowResult)) {
      expect(windowResult.data).toContainEqual(
        expect.objectContaining({
          id: "push-1",
          weekdays: ["mon", "tue", "wed", "thu", "fri"],
        }),
      );
    }

    const deleteResult = await deletePushRegistration(env.DB, "push-1");
    expect(isOk(deleteResult)).toBe(true);

    const afterDelete = await listPushRegistrationsForWindow(env.DB, "07:45");
    expect(isOk(afterDelete)).toBe(true);
    if (isOk(afterDelete)) {
      expect(afterDelete.data).toEqual([]);
    }
  });
});
