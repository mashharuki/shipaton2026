import type {
  DayType,
  SEATED_OUTCOMES,
  VS_EXPECTED_OUTCOMES,
  WEEKDAYS,
} from "shared";
import { type AppError, err, ok, type Result, toAppError } from "shared";

type SeatedOutcome = (typeof SEATED_OUTCOMES)[number];
type VsExpected = (typeof VS_EXPECTED_OUTCOMES)[number];
type Weekday = (typeof WEEKDAYS)[number];
type Locale = "ja" | "en";

export type FeedbackRow = {
  id: string;
  tripId: string;
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: DayType;
  seatedOutcome: SeatedOutcome;
  seatedStationId: string | null;
  vsExpected: VsExpected | null;
  predictedStandingMin: number | null;
  createdAt: string;
};

export type CorrectionStatsRow = {
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: DayType;
  deltaScore: number;
  sampleN: number;
  computedAt: string;
};

export type MetricRow = {
  date: string;
  railwayId: string;
  maeStandingMin: number;
  n: number;
};

export type AnalyticsEventRow = {
  id: string;
  name: string;
  propsJson: string;
  sessionId: string;
  createdAt: string;
};

export type PushRegistrationRow = {
  id: string;
  expoPushToken: string;
  fromStationId: string;
  toStationId: string;
  weekdays: Weekday[];
  notifyAt: string;
  leadMinutes: number;
  locale: Locale;
  lastSentDate: string | null;
};

async function runQuery<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<Result<T, AppError>> {
  try {
    return ok(await run());
  } catch (cause) {
    const appError = toAppError(cause);
    return err({ ...appError, message: `${operation}: ${appError.message}` });
  }
}

function toFeedbackRow(raw: Record<string, unknown>): FeedbackRow {
  return {
    id: raw.id as string,
    tripId: raw.trip_id as string,
    railwayId: raw.railway_id as string,
    legKey: raw.leg_key as string,
    timeBucket: raw.time_bucket as string,
    dayType: raw.day_type as DayType,
    seatedOutcome: raw.seated_outcome as SeatedOutcome,
    seatedStationId: (raw.seated_station_id as string | null) ?? null,
    vsExpected: (raw.vs_expected as VsExpected | null) ?? null,
    predictedStandingMin: (raw.predicted_standing_min as number | null) ?? null,
    createdAt: raw.created_at as string,
  };
}

export async function insertFeedback(
  db: D1Database,
  feedback: FeedbackRow,
): Promise<Result<void, AppError>> {
  return runQuery("insertFeedback", async () => {
    await db
      .prepare(
        `INSERT INTO feedback (
          id, trip_id, railway_id, leg_key, time_bucket, day_type,
          seated_outcome, seated_station_id, vs_expected,
          predicted_standing_min, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        feedback.id,
        feedback.tripId,
        feedback.railwayId,
        feedback.legKey,
        feedback.timeBucket,
        feedback.dayType,
        feedback.seatedOutcome,
        feedback.seatedStationId,
        feedback.vsExpected,
        feedback.predictedStandingMin,
        feedback.createdAt,
      )
      .run();
  });
}

export async function listFeedbackForAggregation(
  db: D1Database,
  params: { railwayId: string; sinceIso: string },
): Promise<Result<FeedbackRow[], AppError>> {
  return runQuery("listFeedbackForAggregation", async () => {
    const { results } = await db
      .prepare(
        "SELECT * FROM feedback WHERE railway_id = ? AND created_at >= ? ORDER BY created_at ASC",
      )
      .bind(params.railwayId, params.sinceIso)
      .all<Record<string, unknown>>();
    return results.map(toFeedbackRow);
  });
}

// Unlike listFeedbackForAggregation, not scoped to a single railwayId --
// the daily aggregation batch (task 3.4) recomputes correction_stats across
// every railway/leg/bucket/day-type cell in one full pass.
export async function listFeedbackSince(
  db: D1Database,
  sinceIso: string,
): Promise<Result<FeedbackRow[], AppError>> {
  return runQuery("listFeedbackSince", async () => {
    const { results } = await db
      .prepare(
        "SELECT * FROM feedback WHERE created_at >= ? ORDER BY created_at ASC",
      )
      .bind(sinceIso)
      .all<Record<string, unknown>>();
    return results.map(toFeedbackRow);
  });
}

export async function deleteExpiredFeedback(
  db: D1Database,
  cutoffIso: string,
): Promise<Result<number, AppError>> {
  return runQuery("deleteExpiredFeedback", async () => {
    const result = await db
      .prepare("DELETE FROM feedback WHERE created_at < ?")
      .bind(cutoffIso)
      .run();
    return result.meta.changes ?? 0;
  });
}

function toCorrectionStatsRow(
  raw: Record<string, unknown>,
): CorrectionStatsRow {
  return {
    railwayId: raw.railway_id as string,
    legKey: raw.leg_key as string,
    timeBucket: raw.time_bucket as string,
    dayType: raw.day_type as DayType,
    deltaScore: raw.delta_score as number,
    sampleN: raw.sample_n as number,
    computedAt: raw.computed_at as string,
  };
}

export async function upsertCorrectionStats(
  db: D1Database,
  stats: CorrectionStatsRow,
): Promise<Result<void, AppError>> {
  return runQuery("upsertCorrectionStats", async () => {
    await db
      .prepare(
        `INSERT INTO correction_stats (
          railway_id, leg_key, time_bucket, day_type, delta_score, sample_n, computed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (railway_id, leg_key, time_bucket, day_type)
        DO UPDATE SET delta_score = excluded.delta_score,
                      sample_n = excluded.sample_n,
                      computed_at = excluded.computed_at`,
      )
      .bind(
        stats.railwayId,
        stats.legKey,
        stats.timeBucket,
        stats.dayType,
        stats.deltaScore,
        stats.sampleN,
        stats.computedAt,
      )
      .run();
  });
}

// Full-recompute idempotency (task 3.4: "全量再計算") -- cells that no
// longer meet the sample-size threshold must not linger from a previous
// run, so the aggregation batch clears the table before repopulating it.
export async function deleteAllCorrectionStats(
  db: D1Database,
): Promise<Result<void, AppError>> {
  return runQuery("deleteAllCorrectionStats", async () => {
    await db.prepare("DELETE FROM correction_stats").run();
  });
}

export async function getCorrectionStats(
  db: D1Database,
  key: {
    railwayId: string;
    legKey: string;
    timeBucket: string;
    dayType: DayType;
  },
): Promise<Result<CorrectionStatsRow | null, AppError>> {
  return runQuery("getCorrectionStats", async () => {
    const row = await db
      .prepare(
        "SELECT * FROM correction_stats WHERE railway_id = ? AND leg_key = ? AND time_bucket = ? AND day_type = ?",
      )
      .bind(key.railwayId, key.legKey, key.timeBucket, key.dayType)
      .first<Record<string, unknown>>();
    return row ? toCorrectionStatsRow(row) : null;
  });
}

// notify-commuters (task 3.7) needs every time-bucket cell for a leg -- both
// to test the current bucket for a positive delta and to compare it against
// other buckets for an alternative-departure recommendation.
export async function listCorrectionStatsForLeg(
  db: D1Database,
  key: { railwayId: string; legKey: string; dayType: DayType },
): Promise<Result<CorrectionStatsRow[], AppError>> {
  return runQuery("listCorrectionStatsForLeg", async () => {
    const { results } = await db
      .prepare(
        "SELECT * FROM correction_stats WHERE railway_id = ? AND leg_key = ? AND day_type = ?",
      )
      .bind(key.railwayId, key.legKey, key.dayType)
      .all<Record<string, unknown>>();
    return results.map(toCorrectionStatsRow);
  });
}

function toMetricRow(raw: Record<string, unknown>): MetricRow {
  return {
    date: raw.date as string,
    railwayId: raw.railway_id as string,
    maeStandingMin: raw.mae_standing_min as number,
    n: raw.n as number,
  };
}

export async function upsertMetric(
  db: D1Database,
  metric: MetricRow,
): Promise<Result<void, AppError>> {
  return runQuery("upsertMetric", async () => {
    await db
      .prepare(
        `INSERT INTO metrics (date, railway_id, mae_standing_min, n)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (date)
        DO UPDATE SET railway_id = excluded.railway_id,
                      mae_standing_min = excluded.mae_standing_min,
                      n = excluded.n`,
      )
      .bind(metric.date, metric.railwayId, metric.maeStandingMin, metric.n)
      .run();
  });
}

export async function getMetric(
  db: D1Database,
  date: string,
): Promise<Result<MetricRow | null, AppError>> {
  return runQuery("getMetric", async () => {
    const row = await db
      .prepare("SELECT * FROM metrics WHERE date = ?")
      .bind(date)
      .first<Record<string, unknown>>();
    return row ? toMetricRow(row) : null;
  });
}

function toAnalyticsEventRow(raw: Record<string, unknown>): AnalyticsEventRow {
  return {
    id: raw.id as string,
    name: raw.name as string,
    propsJson: raw.props_json as string,
    sessionId: raw.session_id as string,
    createdAt: raw.created_at as string,
  };
}

export async function insertAnalyticsEvent(
  db: D1Database,
  event: AnalyticsEventRow,
): Promise<Result<void, AppError>> {
  return runQuery("insertAnalyticsEvent", async () => {
    await db
      .prepare(
        "INSERT INTO analytics_events (id, name, props_json, session_id, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        event.id,
        event.name,
        event.propsJson,
        event.sessionId,
        event.createdAt,
      )
      .run();
  });
}

export async function listAnalyticsEventsSince(
  db: D1Database,
  sinceIso: string,
): Promise<Result<AnalyticsEventRow[], AppError>> {
  return runQuery("listAnalyticsEventsSince", async () => {
    const { results } = await db
      .prepare(
        "SELECT * FROM analytics_events WHERE created_at >= ? ORDER BY created_at ASC",
      )
      .bind(sinceIso)
      .all<Record<string, unknown>>();
    return results.map(toAnalyticsEventRow);
  });
}

function toPushRegistrationRow(
  raw: Record<string, unknown>,
): PushRegistrationRow {
  return {
    id: raw.id as string,
    expoPushToken: raw.expo_push_token as string,
    fromStationId: raw.from_station_id as string,
    toStationId: raw.to_station_id as string,
    weekdays: JSON.parse(raw.weekdays as string) as Weekday[],
    notifyAt: raw.notify_at as string,
    leadMinutes: raw.lead_minutes as number,
    locale: raw.locale as Locale,
    lastSentDate: (raw.last_sent_date as string | null) ?? null,
  };
}

export async function upsertPushRegistration(
  db: D1Database,
  registration: PushRegistrationRow,
): Promise<Result<void, AppError>> {
  return runQuery("upsertPushRegistration", async () => {
    await db
      .prepare(
        `INSERT INTO push_registrations (
          id, expo_push_token, from_station_id, to_station_id, weekdays,
          notify_at, lead_minutes, locale, last_sent_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id)
        DO UPDATE SET expo_push_token = excluded.expo_push_token,
                      from_station_id = excluded.from_station_id,
                      to_station_id = excluded.to_station_id,
                      weekdays = excluded.weekdays,
                      notify_at = excluded.notify_at,
                      lead_minutes = excluded.lead_minutes,
                      locale = excluded.locale,
                      last_sent_date = excluded.last_sent_date`,
      )
      .bind(
        registration.id,
        registration.expoPushToken,
        registration.fromStationId,
        registration.toStationId,
        JSON.stringify(registration.weekdays),
        registration.notifyAt,
        registration.leadMinutes,
        registration.locale,
        registration.lastSentDate,
      )
      .run();
  });
}

export async function deletePushRegistration(
  db: D1Database,
  id: string,
): Promise<Result<number, AppError>> {
  return runQuery("deletePushRegistration", async () => {
    const result = await db
      .prepare("DELETE FROM push_registrations WHERE id = ?")
      .bind(id)
      .run();
    return result.meta.changes ?? 0;
  });
}

export async function listPushRegistrationsForWindow(
  db: D1Database,
  notifyAt: string,
): Promise<Result<PushRegistrationRow[], AppError>> {
  return runQuery("listPushRegistrationsForWindow", async () => {
    const { results } = await db
      .prepare("SELECT * FROM push_registrations WHERE notify_at = ?")
      .bind(notifyAt)
      .all<Record<string, unknown>>();
    return results.map(toPushRegistrationRow);
  });
}

// notify-commuters (task 3.7) evaluates every registration's own
// (notifyAt - leadMinutes) window on each 5-minute tick -- since leadMinutes
// varies per row, that can't be expressed as a single `notify_at = ?` match,
// so the batch fetches the (small, MVP-scale) full table and filters in app
// code (see cron/notify-commuters.ts's `isInNotifyWindow`).
export async function listAllPushRegistrations(
  db: D1Database,
): Promise<Result<PushRegistrationRow[], AppError>> {
  return runQuery("listAllPushRegistrations", async () => {
    const { results } = await db
      .prepare("SELECT * FROM push_registrations")
      .all<Record<string, unknown>>();
    return results.map(toPushRegistrationRow);
  });
}

export async function markPushRegistrationSent(
  db: D1Database,
  params: { id: string; sentDate: string },
): Promise<Result<void, AppError>> {
  return runQuery("markPushRegistrationSent", async () => {
    await db
      .prepare("UPDATE push_registrations SET last_sent_date = ? WHERE id = ?")
      .bind(params.sentDate, params.id)
      .run();
  });
}
