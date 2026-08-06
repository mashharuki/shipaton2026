import { applyD1Migrations, type D1Migration, env } from "cloudflare:test";
import { isErr, isOk } from "shared";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runAggregateFeedback } from "../../src/cron/aggregate-feedback";
import { getCorrectionStats, insertFeedback } from "../../src/db/queries";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const RAILWAY_ID = "RAIL_CHUO";
const CELL_A = {
  railwayId: RAILWAY_ID,
  legKey: "STA_A-STA_B",
  timeBucket: "07:30",
  dayType: "weekday" as const,
};
const CELL_B = {
  railwayId: RAILWAY_ID,
  legKey: "STA_C-STA_D",
  timeBucket: "18:00",
  dayType: "weekday" as const,
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM feedback").run();
  await env.DB.prepare("DELETE FROM correction_stats").run();
  await env.DB.prepare("DELETE FROM metrics").run();
});

async function seedFeedback(
  cell: typeof CELL_A,
  count: number,
  vsExpected:
    | "less_crowded_than_expected"
    | "as_expected"
    | "more_crowded_than_expected",
  createdAt: string,
  idPrefix: string,
) {
  for (let i = 0; i < count; i++) {
    const result = await insertFeedback(env.DB, {
      id: `${idPrefix}-${i}`,
      tripId: `trip-${idPrefix}-${i}`,
      railwayId: cell.railwayId,
      legKey: cell.legKey,
      timeBucket: cell.timeBucket,
      dayType: cell.dayType,
      seatedOutcome: "seated_from_middle",
      seatedStationId: "STA_MID",
      vsExpected,
      predictedStandingMin: 8,
      createdAt,
    });
    expect(isOk(result)).toBe(true);
  }
}

describe("runAggregateFeedback", () => {
  it("aggregates correction stats, records MAE, excludes small cells, and deletes expired feedback", async () => {
    const now = new Date("2026-08-04T18:00:00.000Z");

    // Cell A: 5 rows (meets the n>=5 threshold) -- 2 more-crowded, 2
    // as-expected, 1 less-crowded => average delta = (0.1+0.1+0+0-0.1)/5.
    await seedFeedback(
      CELL_A,
      2,
      "more_crowded_than_expected",
      "2026-08-04T07:30:00.000Z",
      "cell-a-more",
    );
    await seedFeedback(
      CELL_A,
      2,
      "as_expected",
      "2026-08-04T07:31:00.000Z",
      "cell-a-as",
    );
    await seedFeedback(
      CELL_A,
      1,
      "less_crowded_than_expected",
      "2026-08-04T07:32:00.000Z",
      "cell-a-less",
    );

    // Cell B: only 3 rows -- below the n>=5 threshold, must be excluded.
    await seedFeedback(
      CELL_B,
      3,
      "as_expected",
      "2026-08-04T18:00:00.000Z",
      "cell-b",
    );

    // Expired row in Cell A's own cell, well past the 90-day retention
    // window -- must not count toward Cell A's sample and must be deleted.
    const expiredResult = await insertFeedback(env.DB, {
      id: "expired-1",
      tripId: "trip-expired-1",
      railwayId: CELL_A.railwayId,
      legKey: CELL_A.legKey,
      timeBucket: CELL_A.timeBucket,
      dayType: CELL_A.dayType,
      seatedOutcome: "stood_whole_trip",
      seatedStationId: null,
      vsExpected: "more_crowded_than_expected",
      predictedStandingMin: 10,
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    expect(isOk(expiredResult)).toBe(true);

    const result = await runAggregateFeedback(env.DB, now);
    expect(isOk(result)).toBe(true);
    if (isErr(result)) {
      return;
    }
    expect(result.data).toEqual({
      cellsWritten: 1,
      metricWritten: true,
      feedbackDeleted: 1,
    });

    const cellA = await getCorrectionStats(env.DB, CELL_A);
    expect(isOk(cellA)).toBe(true);
    if (isOk(cellA)) {
      expect(cellA.data?.sampleN).toBe(5);
      expect(cellA.data?.deltaScore).toBeCloseTo(0.02, 5);
      expect(cellA.data?.computedAt).toBe(now.toISOString());
    }

    const cellB = await getCorrectionStats(env.DB, CELL_B);
    expect(isOk(cellB)).toBe(true);
    if (isOk(cellB)) {
      expect(cellB.data).toBeNull();
    }

    const metric = await env.DB.prepare("SELECT * FROM metrics WHERE date = ?")
      .bind("2026-08-04")
      .first<{ n: number; mae_standing_min: number }>();
    expect(metric?.n).toBe(8);
    expect(metric?.mae_standing_min).toBeGreaterThan(0);

    const expiredRow = await env.DB.prepare(
      "SELECT * FROM feedback WHERE id = ?",
    )
      .bind("expired-1")
      .first();
    expect(expiredRow).toBeNull();

    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM feedback",
    ).first<{ c: number }>();
    expect(remaining?.c).toBe(8);
  });

  it("is idempotent -- rerunning produces the same correction_stats and does not duplicate rows", async () => {
    const now = new Date("2026-08-04T18:00:00.000Z");
    await seedFeedback(
      CELL_A,
      5,
      "as_expected",
      "2026-08-04T07:30:00.000Z",
      "idem",
    );

    const first = await runAggregateFeedback(env.DB, now);
    const second = await runAggregateFeedback(env.DB, now);
    expect(isOk(first)).toBe(true);
    expect(isOk(second)).toBe(true);

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM correction_stats",
    ).first<{ c: number }>();
    expect(count?.c).toBe(1);
  });

  it("writes no metric when there is no feedback in the retention window", async () => {
    const now = new Date("2026-08-04T18:00:00.000Z");

    const result = await runAggregateFeedback(env.DB, now);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({
        cellsWritten: 0,
        metricWritten: false,
        feedbackDeleted: 0,
      });
    }
  });
});
