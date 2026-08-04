const MINUTES_PER_BUCKET = 15;

export type DayType = "weekday" | "weekend";

export function toTimeBucket(date: Date): string {
  const hours = date.getHours();
  const bucketMinutes =
    Math.floor(date.getMinutes() / MINUTES_PER_BUCKET) * MINUTES_PER_BUCKET;
  return `${pad(hours)}:${pad(bucketMinutes)}`;
}

export function toDayType(date: Date): DayType {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6 ? "weekend" : "weekday";
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
