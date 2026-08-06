import type {
  congestionDatasetPayloadSchema,
  correctionDatasetPayloadSchema,
  timetableDatasetPayloadSchema,
} from "shared";
import type { z } from "zod";

import type { DbPort } from "@/lib/db";

export type TimetableDatasetPayload = z.infer<
  typeof timetableDatasetPayloadSchema
>;
export type CongestionDatasetPayload = z.infer<
  typeof congestionDatasetPayloadSchema
>;
export type CorrectionDatasetPayload = z.infer<
  typeof correctionDatasetPayloadSchema
>;

export type DatasetMetaRow = {
  version: string;
  schemaVersion: number;
};

// Typed storage port that `dataset-repository.ts` depends on instead of raw
// SQL -- keeps the sync/version/missing-data *decisions* (the part this
// task's completion condition actually needs verified) free of SQL strings,
// so they stay Vitest-testable with a plain in-memory fake. This adapter
// (the SQL itself) is the untested, thin, native-runtime-only half.
export type DatasetStore = {
  getMeta(
    name: "timetable" | "congestion" | "correction",
  ): Promise<DatasetMetaRow | null>;
  replaceTimetable(
    version: string,
    payload: TimetableDatasetPayload,
  ): Promise<void>;
  replaceCongestion(
    version: string,
    payload: CongestionDatasetPayload,
  ): Promise<void>;
  replaceCorrection(
    version: string,
    payload: CorrectionDatasetPayload,
  ): Promise<void>;
  getTimetable(): Promise<TimetableDatasetPayload>;
  getCongestion(): Promise<CongestionDatasetPayload>;
  getCorrection(): Promise<CorrectionDatasetPayload>;
};

type StationRow = {
  id: string;
  railwayId: string;
  nameJa: string;
  nameEn: string;
  seq: number;
};

type TrainTimetableRow = {
  trainId: string;
  stationId: string;
  departureTime: string;
  arrivalTime: string;
  carCount: number;
  dayType: "weekday" | "weekend";
};

type CongestionProfileRow = {
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: "weekday" | "weekend";
  carNumber: number;
  loadScore: number;
  sampleSize: number;
};

type CorrectionStatsRow = {
  railwayId: string;
  legKey: string;
  timeBucket: string;
  dayType: "weekday" | "weekend";
  deltaScore: number;
  sampleSize: number;
};

async function upsertMeta(
  db: DbPort,
  name: string,
  version: string,
  schemaVersion: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO datasets_meta (name, version, schema_version, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       version = excluded.version,
       schema_version = excluded.schema_version,
       synced_at = excluded.synced_at;`,
    [name, version, schemaVersion, Date.now()],
  );
}

// Backed by the real expo-sqlite connection (via DbPort). Full replace on
// every sync per design.md: "データ量が小さいため差分適用は行わない".
export function createSqliteDatasetStore(db: DbPort): DatasetStore {
  return {
    async getMeta(name) {
      const row = await db.getFirstAsync<{
        version: string;
        schema_version: number;
      }>("SELECT version, schema_version FROM datasets_meta WHERE name = ?;", [
        name,
      ]);
      return row
        ? { version: row.version, schemaVersion: row.schema_version }
        : null;
    },

    async replaceTimetable(version, payload) {
      await db.withExclusiveTransactionAsync(async () => {
        await db.runAsync("DELETE FROM stations;");
        await db.runAsync("DELETE FROM train_timetables;");
        for (const station of payload.stations) {
          await db.runAsync(
            "INSERT INTO stations (id, railway_id, name_ja, name_en, seq) VALUES (?, ?, ?, ?, ?);",
            [
              station.id,
              station.railwayId,
              station.nameJa,
              station.nameEn,
              station.seq,
            ],
          );
        }
        for (const entry of payload.trainTimetables) {
          await db.runAsync(
            "INSERT INTO train_timetables (train_id, station_id, dep_time, arr_time, car_count, day_type) VALUES (?, ?, ?, ?, ?, ?);",
            [
              entry.trainId,
              entry.stationId,
              entry.departureTime,
              entry.arrivalTime,
              entry.carCount,
              entry.dayType,
            ],
          );
        }
        await upsertMeta(db, "timetable", version, payload.schemaVersion);
      });
    },

    async replaceCongestion(version, payload) {
      await db.withExclusiveTransactionAsync(async () => {
        await db.runAsync("DELETE FROM congestion_profile;");
        for (const profile of payload.profiles) {
          await db.runAsync(
            "INSERT INTO congestion_profile (railway_id, leg_key, time_bucket, day_type, car_number, load_score, sample_n) VALUES (?, ?, ?, ?, ?, ?, ?);",
            [
              profile.railwayId,
              profile.legKey,
              profile.timeBucket,
              profile.dayType,
              profile.carNumber,
              profile.loadScore,
              profile.sampleSize,
            ],
          );
        }
        await upsertMeta(db, "congestion", version, payload.schemaVersion);
      });
    },

    async replaceCorrection(version, payload) {
      await db.withExclusiveTransactionAsync(async () => {
        await db.runAsync("DELETE FROM correction_stats;");
        for (const stat of payload.stats) {
          await db.runAsync(
            "INSERT INTO correction_stats (railway_id, leg_key, time_bucket, day_type, delta_score, sample_n) VALUES (?, ?, ?, ?, ?, ?);",
            [
              stat.railwayId,
              stat.legKey,
              stat.timeBucket,
              stat.dayType,
              stat.deltaScore,
              stat.sampleSize,
            ],
          );
        }
        await upsertMeta(db, "correction", version, payload.schemaVersion);
      });
    },

    async getTimetable() {
      const meta = await db.getFirstAsync<{ schema_version: number }>(
        "SELECT schema_version FROM datasets_meta WHERE name = 'timetable';",
      );
      const stations = await db.getAllAsync<StationRow>(
        "SELECT id, railway_id as railwayId, name_ja as nameJa, name_en as nameEn, seq FROM stations;",
      );
      const trainTimetables = await db.getAllAsync<TrainTimetableRow>(
        "SELECT train_id as trainId, station_id as stationId, dep_time as departureTime, arr_time as arrivalTime, car_count as carCount, day_type as dayType FROM train_timetables;",
      );
      return {
        schemaVersion: meta?.schema_version ?? 1,
        stations,
        trainTimetables,
      };
    },

    async getCongestion() {
      const meta = await db.getFirstAsync<{ schema_version: number }>(
        "SELECT schema_version FROM datasets_meta WHERE name = 'congestion';",
      );
      const profiles = await db.getAllAsync<CongestionProfileRow>(
        "SELECT railway_id as railwayId, leg_key as legKey, time_bucket as timeBucket, day_type as dayType, car_number as carNumber, load_score as loadScore, sample_n as sampleSize FROM congestion_profile;",
      );
      return { schemaVersion: meta?.schema_version ?? 1, profiles };
    },

    async getCorrection() {
      const meta = await db.getFirstAsync<{ schema_version: number }>(
        "SELECT schema_version FROM datasets_meta WHERE name = 'correction';",
      );
      const stats = await db.getAllAsync<CorrectionStatsRow>(
        "SELECT railway_id as railwayId, leg_key as legKey, time_bucket as timeBucket, day_type as dayType, delta_score as deltaScore, sample_n as sampleSize FROM correction_stats;",
      );
      return { schemaVersion: meta?.schema_version ?? 1, stats };
    },
  };
}
