const MINUTES_PER_BUCKET = 15;

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
