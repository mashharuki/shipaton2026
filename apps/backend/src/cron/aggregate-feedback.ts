import {
  type AppError,
  FEEDBACK_RETENTION_DAYS,
  isErr,
  ok,
  type Result,
} from "shared";
import {
  deleteAllCorrectionStats,
  deleteExpiredFeedback,
  listFeedbackSince,
  upsertCorrectionStats,
  upsertMetric,
} from "../db/queries";
import {
  aggregateCorrectionStats,
  computeMae,
} from "../services/feedback-aggregator";

export type AggregateFeedbackSummary = {
  cellsWritten: number;
  metricWritten: boolean;
  feedbackDeleted: number;
};

/**
 * Daily batch (design.md: `aggregate-feedback`, 03:00 JST cron). Full
 * recompute, in this order: gather feedback within the retention window ->
 * clear + rebuild correction_stats (n>=5 only) -> record the day's MAE ->
 * delete feedback past the retention window. Deletion runs last so the
 * aggregation step itself never has to reason about rows that are about to
 * disappear.
 */
export async function runAggregateFeedback(
  db: D1Database,
  now: Date = new Date(),
): Promise<Result<AggregateFeedbackSummary, AppError>> {
  const cutoffIso = new Date(
    now.getTime() - FEEDBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rowsResult = await listFeedbackSince(db, cutoffIso);
  if (isErr(rowsResult)) {
    return rowsResult;
  }
  const rows = rowsResult.data;

  const clearResult = await deleteAllCorrectionStats(db);
  if (isErr(clearResult)) {
    return clearResult;
  }

  const computedAt = now.toISOString();
  const cells = aggregateCorrectionStats(rows);
  for (const cell of cells) {
    const upsertResult = await upsertCorrectionStats(db, {
      ...cell,
      computedAt,
    });
    if (isErr(upsertResult)) {
      return upsertResult;
    }
  }

  const mae = computeMae(rows);
  if (mae) {
    // The 03:00 JST cron trigger fires at 18:00 UTC the *previous* UTC
    // calendar day, so `now`'s UTC date already equals the JST day being
    // summarized for this specific schedule (wrangler.jsonc) -- no
    // timezone conversion needed here.
    const metricResult = await upsertMetric(db, {
      date: now.toISOString().slice(0, 10),
      railwayId: mae.railwayId,
      maeStandingMin: mae.maeStandingMin,
      n: mae.n,
    });
    if (isErr(metricResult)) {
      return metricResult;
    }
  }

  const deleteResult = await deleteExpiredFeedback(db, cutoffIso);
  if (isErr(deleteResult)) {
    return deleteResult;
  }

  return ok({
    cellsWritten: cells.length,
    metricWritten: mae !== null,
    feedbackDeleted: deleteResult.data,
  });
}
