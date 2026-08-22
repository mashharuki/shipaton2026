import { type AppError, createAppError, err, ok, type Result } from "shared";

const MINUTES_PER_BUCKET = 15;
const MINUTES_PER_DAY = 24 * 60;

// "HH:mm" clock-time helpers shared by route-ranker.ts (5.4) and
// use-route-detail.ts (5.5) -- both work entirely on "HH:mm" strings with
// no date context (a train's departure time isn't tied to "today"), so
// shared's own Date-based toTimeBucket()/toDayType() don't apply here.

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Congestion/correction profiles are keyed by a 15-minute bucket
// (packages/shared's timeBucketSchema: HH:00/15/30/45), not the exact
// departure time.
export function floorToTimeBucket(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const bucketMinutes =
    Math.floor(minutes / MINUTES_PER_BUCKET) * MINUTES_PER_BUCKET;
  return `${String(hours).padStart(2, "0")}:${String(bucketMinutes).padStart(2, "0")}`;
}

// 6.2: date-bucket key for usage-limiter's daily search counter -- same
// `toISOString().slice(0, 10)` convention backend's feedback-aggregator.ts
// uses for its own date bucketing.
export function todayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * departureTime/arrivalTime are date-less "HH:mm" pairs, so a plain
 * subtraction goes negative across midnight (e.g. 23:50 -> 00:10). A
 * negative difference is treated as an overnight crossing and normalized
 * by adding 24h back; a difference of exactly 0 is rejected as invalid
 * input (unrecoverably ambiguous -- same-time boarding/alighting has no
 * duration to distribute across segments). Shared by every
 * CongestionStrategy implementation that needs a leg's total minutes from
 * its departure/arrival clock times (modeled-strategy.ts, measured-strategy.ts).
 */
export function resolveTripMinutes(
  departureTime: string,
  arrivalTime: string,
): Result<number, AppError> {
  const rawMinutes = minutesOfDay(arrivalTime) - minutesOfDay(departureTime);
  if (rawMinutes === 0) {
    return err(
      createAppError(
        "validation_error",
        "arrivalTime must differ from departureTime",
      ),
    );
  }
  return ok(rawMinutes < 0 ? rawMinutes + MINUTES_PER_DAY : rawMinutes);
}
