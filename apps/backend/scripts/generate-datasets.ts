/**
 * Generates the 3 MVP dataset payloads (timetable / congestion / correction)
 * for the single target line+corridor (design.md scope guardrail: 1 line, no
 * transfers, 5-10 stations) and writes them as committed dev/test/E2E
 * fixtures under fixtures/datasets/. Each payload is validated against the
 * shared contract schema (packages/shared/src/schemas/dataset.schema.ts)
 * before being written -- an invalid payload is a bug in this script and
 * should throw, not be swallowed (code-style.md: throw for programmer
 * errors).
 *
 * Run: pnpm --filter backend run generate:datasets
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  congestionDatasetPayloadSchema,
  type congestionProfileEntrySchema,
  correctionDatasetPayloadSchema,
  type DayType,
  type stationSchema,
  timetableDatasetPayloadSchema,
  type trainTimetableEntrySchema,
} from "shared";
import type { z } from "zod";

type StationEntry = Omit<z.infer<typeof stationSchema>, "railwayId">;
type TrainTimetableEntry = z.infer<typeof trainTimetableEntrySchema>;
type CongestionProfileEntry = z.infer<typeof congestionProfileEntrySchema>;

const RAILWAY_ID = "RAIL_CHUO";
const SCHEMA_VERSION = 1;
const DATASET_VERSION = "1";

// Real JR Chuo Rapid stops between Shinjuku and Tokyo -- fixture station
// identifiers, not live operational data.
const STATIONS: StationEntry[] = [
  { id: "STA_SHINJUKU", nameJa: "新宿", nameEn: "Shinjuku", seq: 0 },
  { id: "STA_YOTSUYA", nameJa: "四ツ谷", nameEn: "Yotsuya", seq: 1 },
  { id: "STA_OCHANOMIZU", nameJa: "御茶ノ水", nameEn: "Ochanomizu", seq: 2 },
  { id: "STA_KANDA", nameJa: "神田", nameEn: "Kanda", seq: 3 },
  { id: "STA_TOKYO", nameJa: "東京", nameEn: "Tokyo", seq: 4 },
];

// Minutes from Shinjuku departure to each station's arrival/departure.
const LEG_OFFSETS_MIN: ReadonlyArray<{ arr: number; dep: number }> = [
  { arr: 0, dep: 0 }, // Shinjuku (origin)
  { arr: 5, dep: 6 }, // Yotsuya
  { arr: 10, dep: 11 }, // Ochanomizu
  { arr: 13, dep: 14 }, // Kanda
  { arr: 16, dep: 16 }, // Tokyo (terminus)
];

const CAR_COUNT = 10;
const WEEKDAY_MORNING_DEPARTURES = [
  "07:00",
  "07:15",
  "07:30",
  "07:45",
  "08:00",
];
const WEEKDAY_EVENING_DEPARTURES = [
  "18:00",
  "18:15",
  "18:30",
  "18:45",
  "19:00",
];
// MVP scope is weekday rush only (red-team scope guardrail, requirements.md
// 5.8 "全提供時間帯" -- congestion coverage below must match every departure
// window offered here; no weekend departures are seeded since weekend is out
// of the approved "1路線・乗換なし・5〜10駅・平日朝夕" cut.

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(wrapped / 60)
    .toString()
    .padStart(2, "0");
  const mm = (wrapped % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildTimetable(): TrainTimetableEntry[] {
  const entries: TrainTimetableEntry[] = [];
  const departureSets: Array<{ departures: string[]; dayType: DayType }> = [
    { departures: WEEKDAY_MORNING_DEPARTURES, dayType: "weekday" },
    { departures: WEEKDAY_EVENING_DEPARTURES, dayType: "weekday" },
  ];

  for (const { departures, dayType } of departureSets) {
    for (const departure of departures) {
      const trainId = `TRAIN_${dayType.toUpperCase()}_${departure.replace(":", "")}`;
      for (let i = 0; i < STATIONS.length; i++) {
        const { arr, dep } = LEG_OFFSETS_MIN[i];
        entries.push({
          trainId,
          stationId: STATIONS[i].id,
          arrivalTime: addMinutes(departure, arr),
          departureTime: addMinutes(departure, dep),
          carCount: CAR_COUNT,
          dayType,
        });
      }
    }
  }
  return entries;
}

/**
 * Synthetic placeholder load curve (front cars least crowded) -- NOT real
 * measurements. sampleSize is 0 throughout: this is a pre-launch seed with
 * no observed data yet, so confidence must read as low (scorePrediction
 * treats sampleSize < CONFIDENCE_SAMPLE_THRESHOLDS.low as "low"), never a
 * false point estimate.
 *
 * Covers every weekday departure window the timetable dataset offers
 * (morning + evening) -- requirements.md 5.8 requires profile-based
 * prediction across "対象区間の全提供時間帯", not just a subset of it.
 */
function buildCongestionProfiles(): CongestionProfileEntry[] {
  const legKey = `${STATIONS[0].id}-${STATIONS[STATIONS.length - 1].id}`;
  const profiles: CongestionProfileEntry[] = [];
  const timeBuckets = [
    ...WEEKDAY_MORNING_DEPARTURES,
    ...WEEKDAY_EVENING_DEPARTURES,
  ];
  for (const timeBucket of timeBuckets) {
    for (let carNumber = 1; carNumber <= CAR_COUNT; carNumber++) {
      profiles.push({
        railwayId: RAILWAY_ID,
        legKey,
        timeBucket,
        dayType: "weekday",
        carNumber,
        loadScore: Math.min(1, 0.3 + (carNumber - 1) * 0.07),
        sampleSize: 0,
      });
    }
  }
  return profiles;
}

function main() {
  const timetablePayload = timetableDatasetPayloadSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    stations: STATIONS.map((s) => ({ ...s, railwayId: RAILWAY_ID })),
    trainTimetables: buildTimetable(),
  });

  const congestionPayload = congestionDatasetPayloadSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    profiles: buildCongestionProfiles(),
  });

  // No feedback exists pre-launch (design.md cold-start reality) -- an
  // honest empty seed, not fabricated correction data.
  const correctionPayload = correctionDatasetPayloadSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    stats: [],
  });

  const fixturesDir = join(import.meta.dirname, "..", "fixtures", "datasets");
  mkdirSync(fixturesDir, { recursive: true });

  const write = (name: string, payload: unknown) => {
    const filePath = join(fixturesDir, `${name}.json`);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(
      filePath,
      `${JSON.stringify({ version: DATASET_VERSION, payload }, null, 2)}\n`,
    );
    console.log(`wrote ${filePath}`);
  };

  write("timetable", timetablePayload);
  write("congestion", congestionPayload);
  write("correction", correctionPayload);
}

main();
