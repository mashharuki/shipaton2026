import {
  applyD1Migrations,
  createExecutionContext,
  createScheduledController,
  type D1Migration,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { isOk } from "shared";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  insertFeedback,
  upsertCorrectionStats,
  upsertPushRegistration,
} from "../src/db/queries";
import worker from "../src/index";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const RAILWAY_ID = "RAIL_CHUO";
const AGGREGATE_CRON = "0 18 * * *";
const NOTIFY_CRON = "*/5 * * * *";

// JST 2026-08-05 (Wed) 07:25 == UTC 2026-08-04T22:25:00.000Z, matching
// test/cron/notify-commuters.test.ts's own fixture time.
const NOTIFY_NOW = new Date("2026-08-04T22:25:00.000Z");

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM feedback").run();
  await env.DB.prepare("DELETE FROM correction_stats").run();
  await env.DB.prepare("DELETE FROM metrics").run();
  await env.DB.prepare("DELETE FROM push_registrations").run();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Invokes worker.scheduled() directly (not via SELF) -- SELF is a
// service-binding-style Fetcher whose calls cross an RPC boundary, and the
// ScheduledController from createScheduledController() carries an internal
// loopback stub that can't be structured-cloned across it
// (DataCloneError). createExecutionContext()/waitOnExecutionContext() is
// the pattern vitest-pool-workers documents for testing scheduled handlers
// in-isolate instead.
async function runScheduled(cron: string, scheduledTime: number) {
  const ctx = createExecutionContext();
  await worker.scheduled(
    createScheduledController({ cron, scheduledTime }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
}

// 2.2/3.4/3.7 (unresolved-gap resolution): proves index.ts's `scheduled`
// export actually routes wrangler.jsonc's two configured cron expressions
// to the right batch against real D1/KV bindings -- runAggregateFeedback
// and runNotifyCommuters' own logic is already covered by
// test/cron/*.test.ts, so this file only asserts on dispatch + the
// scheduledTime -> `now` wiring, not the batches' internal behavior.
describe("scheduled", () => {
  it(`dispatches "${AGGREGATE_CRON}" to runAggregateFeedback`, async () => {
    for (let i = 0; i < 5; i++) {
      const result = await insertFeedback(env.DB, {
        id: `sched-agg-${i}`,
        tripId: `trip-sched-agg-${i}`,
        railwayId: RAILWAY_ID,
        legKey: "STA_A-STA_B",
        timeBucket: "07:30",
        dayType: "weekday",
        seatedOutcome: "seated_from_middle",
        seatedStationId: "STA_MID",
        vsExpected: "more_crowded_than_expected",
        predictedStandingMin: 8,
        createdAt: "2026-08-04T07:30:00.000Z",
      });
      expect(isOk(result)).toBe(true);
    }

    await runScheduled(
      AGGREGATE_CRON,
      new Date("2026-08-04T18:00:00.000Z").getTime(),
    );

    const cell = await env.DB.prepare(
      "SELECT sample_n FROM correction_stats WHERE railway_id = ? AND leg_key = ? AND time_bucket = ? AND day_type = ?",
    )
      .bind(RAILWAY_ID, "STA_A-STA_B", "07:30", "weekday")
      .first<{ sample_n: number }>();
    expect(cell?.sample_n).toBe(5);

    const metric = await env.DB.prepare("SELECT n FROM metrics WHERE date = ?")
      .bind("2026-08-04")
      .first<{ n: number }>();
    expect(metric?.n).toBe(5);
  });

  it(`dispatches "${NOTIFY_CRON}" to runNotifyCommuters`, async () => {
    await upsertPushRegistration(env.DB, {
      id: "sched-notify-1",
      expoPushToken: "ExponentPushToken[xxx]",
      fromStationId: "STA_A",
      toStationId: "STA_B",
      weekdays: ["wed"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
      lastSentDate: null,
    });
    await upsertCorrectionStats(env.DB, {
      railwayId: RAILWAY_ID,
      legKey: "STA_A-STA_B",
      timeBucket: "07:45",
      dayType: "weekday",
      deltaScore: 0.1,
      sampleN: 8,
      computedAt: NOTIFY_NOW.toISOString(),
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ data: [{ status: "ok" }] }),
      );

    await runScheduled(NOTIFY_CRON, NOTIFY_NOW.getTime());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const row = await env.DB.prepare(
      "SELECT last_sent_date FROM push_registrations WHERE id = ?",
    )
      .bind("sched-notify-1")
      .first<{ last_sent_date: string }>();
    expect(row?.last_sent_date).toBe("2026-08-05");
  });

  it("does not throw for a cron expression with no registered handler", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runScheduled("0 0 * * 0", NOTIFY_NOW.getTime()),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no handler for cron "0 0 * * 0"'),
    );
  });
});
