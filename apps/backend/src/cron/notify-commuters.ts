import {
  type AppError,
  type DayType,
  err,
  isErr,
  ok,
  type PredictionFactorKind,
  type Result,
  toAppError,
} from "shared";
import {
  listAllPushRegistrations,
  listCorrectionStatsForLeg,
  markPushRegistrationSent,
  type PushRegistrationRow,
} from "../db/queries";
import {
  type AlternativeCandidate,
  buildNotificationPrediction,
  type CongestionProfileEntry,
} from "../services/prediction";
import {
  type ExpoPushMessage,
  sendExpoPushNotifications,
} from "../services/push-sender";

// Single-line MVP scope (matches services/odpt-client.ts's ODPT_RAILWAY_IDS --
// push_registrations has no railwayId column because there is only ever one).
const RAILWAY_ID = "RAIL_CHUO";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WINDOW_MINUTES = 5;
const WEEKDAY_CODES = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export type NotifyCommutersSummary = {
  windowMatched: number;
  notified: number;
  skippedAlreadySent: number;
};

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Deliberately uses explicit UTC getters (never getHours()/getDay()) so the
 * result is identical under both the Workers runtime (always UTC) and a
 * plain Node test runner (local-timezone dependent) -- unlike the coarser
 * weekday/weekend split in shared's toDayType (fine for 3.3's use), this
 * batch's window match is precise to the minute and cannot tolerate that
 * ambiguity. JST is UTC+9 (a whole number of hours), so shifting the
 * timestamp before reading UTC fields yields JST wall-clock time without
 * needing a timezone database.
 */
function toJstWallClock(now: Date): {
  minutesOfDay: number;
  weekday: (typeof WEEKDAY_CODES)[number];
  dateKey: string;
} {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  return {
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: WEEKDAY_CODES[
      shifted.getUTCDay()
    ] as (typeof WEEKDAY_CODES)[number],
    dateKey: shifted.toISOString().slice(0, 10),
  };
}

function minutesOfDayFromHHMM(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function bucketFromHHMM(hhmm: string): string {
  const minutes = minutesOfDayFromHHMM(hhmm);
  const bucketMinutes = Math.floor(minutes / 15) * 15;
  return `${pad(Math.floor(bucketMinutes / 60) % 24)}:${pad(bucketMinutes % 60)}`;
}

function jstDayType(weekday: (typeof WEEKDAY_CODES)[number]): DayType {
  return weekday === "sun" || weekday === "sat" ? "weekend" : "weekday";
}

/**
 * Window extraction (design.md: "notifyAt - leadMinutes ウィンドウ該当を抽出").
 * leadMinutes varies per registration, so each row's own target minute is
 * computed and checked against the current 5-minute tick window rather than
 * matched via a single SQL value (see listAllPushRegistrations's note).
 */
export function isInNotifyWindow(
  registration: Pick<
    PushRegistrationRow,
    "weekdays" | "notifyAt" | "leadMinutes"
  >,
  now: Date,
): boolean {
  const { minutesOfDay, weekday } = toJstWallClock(now);
  if (!registration.weekdays.includes(weekday)) {
    return false;
  }

  const windowStart = minutesOfDay - (minutesOfDay % WINDOW_MINUTES);
  const windowEnd = windowStart + WINDOW_MINUTES;
  const targetMinutes = ((minutesOfDayFromHHMM(registration.notifyAt) -
    registration.leadMinutes +
    1440) %
    1440) as number;

  return targetMinutes >= windowStart && targetMinutes < windowEnd;
}

type StoredDataset = { version: string; payload: unknown };

async function loadCongestionProfiles(
  kv: KVNamespace,
): Promise<Result<CongestionProfileEntry[], AppError>> {
  try {
    const raw = await kv.get("dataset:congestion");
    if (raw === null) {
      return ok([]);
    }
    const stored = JSON.parse(raw) as StoredDataset;
    const payload = stored.payload as { profiles?: CongestionProfileEntry[] };
    return ok(payload.profiles ?? []);
  } catch (cause) {
    return err(toAppError(cause));
  }
}

const NOTIFICATION_COPY = {
  ja: {
    title: "混雑が増える見込みです",
    withAlternative: (alt: AlternativeCandidate) =>
      `${alt.timeBucket}台の便なら、約${alt.standingMinutesSaved}分立ち時間を削減できそうです`,
    withoutAlternative: "通常より混雑が予測されます",
  },
  en: {
    title: "Your usual train looks busier than normal",
    withAlternative: (alt: AlternativeCandidate) =>
      `Taking the ${alt.timeBucket} departure could save about ${alt.standingMinutesSaved} min of standing time`,
    withoutAlternative: "Expect more crowding than usual today",
  },
} as const;

// Only "feedback_correction" is reachable today (buildNotificationPrediction
// only sets shouldNotify -- and therefore reasonFactor -- from a positive
// correction_stats delta; see prediction.ts). No weather/event dataset
// exists anywhere in this codebase yet, so Requirement 10.3's "雨・イベント
// 等" reason text cannot be produced from real data -- this is the one
// concrete "vs. normal" signal the batch actually has, phrased for users.
const REASON_COPY: Record<PredictionFactorKind, { ja: string; en: string }> = {
  base_profile: {
    ja: "通常の混雑傾向によるものです",
    en: "Based on typical crowding patterns",
  },
  day_type: {
    ja: "曜日の傾向によるものです",
    en: "Based on day-of-week patterns",
  },
  weather: {
    ja: "天候の影響が予測されます",
    en: "Weather is expected to affect crowding",
  },
  event: {
    ja: "周辺イベントの影響が予測されます",
    en: "A nearby event is expected to affect crowding",
  },
  feedback_correction: {
    ja: "最近の乗車報告で混雑が多めに報告されています",
    en: "Recent rider reports indicate more crowding than usual",
  },
  delay: { ja: "運行の遅延が予測されます", en: "Delays are expected" },
};

function buildPushMessage(
  registration: PushRegistrationRow,
  alternative: AlternativeCandidate | null,
  reasonFactor: PredictionFactorKind,
): ExpoPushMessage {
  const copy = NOTIFICATION_COPY[registration.locale];
  const reason = REASON_COPY[reasonFactor][registration.locale];
  const summary = alternative
    ? copy.withAlternative(alternative)
    : copy.withoutAlternative;
  const body =
    registration.locale === "ja"
      ? `${summary}（${reason}）`
      : `${summary} (${reason})`;
  return {
    to: registration.expoPushToken,
    title: copy.title,
    body,
    data: {
      registrationId: registration.id,
      fromStationId: registration.fromStationId,
      toStationId: registration.toStationId,
      alternative,
      reasonFactor,
    },
  };
}

/**
 * Cron batch (design.md: `notify-commuters`, every 5 minutes). Extracts registrations
 * whose (notifyAt - leadMinutes) falls in the current 5-minute window,
 * scores each leg with the shared prediction function fed by the KV
 * congestion dataset + D1 correction_stats, and sends an Expo push only when
 * the correction signal indicates above-normal crowding (see
 * services/prediction.ts's buildNotificationPrediction for why that's the
 * only available "increase" signal). Dedup uses a JST date-keyed
 * last_sent_date, matching task 3.4/3.6's existing pattern.
 */
export async function runNotifyCommuters(
  db: D1Database,
  kv: KVNamespace,
  now: Date = new Date(),
): Promise<Result<NotifyCommutersSummary, AppError>> {
  const { dateKey: todayKey } = toJstWallClock(now);

  const registrationsResult = await listAllPushRegistrations(db);
  if (isErr(registrationsResult)) {
    return registrationsResult;
  }

  const congestionResult = await loadCongestionProfiles(kv);
  if (isErr(congestionResult)) {
    return congestionResult;
  }
  const congestionProfiles = congestionResult.data;

  const matched = registrationsResult.data.filter((registration) =>
    isInNotifyWindow(registration, now),
  );

  const { weekday } = toJstWallClock(now);
  const dayType = jstDayType(weekday);

  let skippedAlreadySent = 0;
  const toSend: {
    registration: PushRegistrationRow;
    alternative: AlternativeCandidate | null;
    reasonFactor: PredictionFactorKind;
  }[] = [];

  for (const registration of matched) {
    if (registration.lastSentDate === todayKey) {
      skippedAlreadySent++;
      continue;
    }

    const legKey = `${registration.fromStationId}-${registration.toStationId}`;
    const timeBucket = bucketFromHHMM(registration.notifyAt);

    const correctionResult = await listCorrectionStatsForLeg(db, {
      railwayId: RAILWAY_ID,
      legKey,
      dayType,
    });
    if (isErr(correctionResult)) {
      return correctionResult;
    }

    const prediction = buildNotificationPrediction({
      legKey,
      dayType,
      timeBucket,
      congestionProfiles,
      correctionCells: correctionResult.data.map((cell) => ({
        legKey: cell.legKey,
        timeBucket: cell.timeBucket,
        dayType: cell.dayType,
        deltaScore: cell.deltaScore,
        sampleN: cell.sampleN,
      })),
    });

    if (!prediction.shouldNotify || prediction.reasonFactor === null) {
      continue;
    }

    toSend.push({
      registration,
      alternative: prediction.alternative,
      reasonFactor: prediction.reasonFactor,
    });
  }

  if (toSend.length > 0) {
    const sendResult = await sendExpoPushNotifications(
      toSend.map(({ registration, alternative, reasonFactor }) =>
        buildPushMessage(registration, alternative, reasonFactor),
      ),
    );
    if (isErr(sendResult)) {
      return sendResult;
    }

    for (const { registration } of toSend) {
      const markResult = await markPushRegistrationSent(db, {
        id: registration.id,
        sentDate: todayKey,
      });
      if (isErr(markResult)) {
        return markResult;
      }
    }
  }

  return ok({
    windowMatched: matched.length,
    notified: toSend.length,
    skippedAlreadySent,
  });
}
