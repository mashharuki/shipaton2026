import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { serializeSqliteOpen } from "./sqlite-open-gate";

const DATABASE_NAME = "seatsignal.db";

export type DbBindValue = string | number | null;

// Minimal structural subset of expo-sqlite's SQLiteDatabase -- letting
// dataset-repository.ts depend on this instead of the concrete class means
// tests can inject an in-memory fake instead of a real native SQLite
// connection (expo-sqlite requires the native runtime and can't run under
// this project's Vitest config, same limitation as react-native itself).
export type DbPort = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: DbBindValue[]): Promise<void>;
  getFirstAsync<T>(source: string, params?: DbBindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params?: DbBindValue[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: () => Promise<void>): Promise<void>;
};

// expo-sqlite: `withExclusiveTransactionAsync` "is not supported on web" --
// it throws that exact message immediately (before running `task`) rather
// than returning a platform-specific implementation. Confirmed live in a
// browser. Reacting to the real error instead of branching on Platform.OS
// keeps this file free of a react-native import -- lib/db.ts is pulled in
// by many test files that mock only `expo-sqlite` (not `react-native`),
// per push-registration.test.ts's own precedent. Plain BEGIN/COMMIT/
// ROLLBACK via execAsync works on web (only the wrapper method doesn't);
// this app's own module-level singletons (getDb()'s `dbPromise`,
// dataset-store.ts's own callers) already ensure only one caller ever
// touches the connection at a time on web's single JS thread, so the extra
// OS-level exclusivity the native wrapper adds isn't needed to replicate.
const WEB_UNSUPPORTED_MESSAGE =
  "withExclusiveTransactionAsync is not supported on web";

async function withPortableExclusiveTransaction(
  db: SQLiteDatabase,
  task: () => Promise<void>,
): Promise<void> {
  await db.execAsync("BEGIN;");
  try {
    await task();
    await db.execAsync("COMMIT;");
  } catch (cause) {
    await db.execAsync("ROLLBACK;");
    throw cause;
  }
}

function toDbPort(db: SQLiteDatabase): DbPort {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: async (source, params = []) => {
      await db.runAsync(source, params);
    },
    getFirstAsync: (source, params = []) => db.getFirstAsync(source, params),
    getAllAsync: (source, params = []) => db.getAllAsync(source, params),
    withExclusiveTransactionAsync: async (task) => {
      try {
        await db.withExclusiveTransactionAsync(task);
      } catch (cause) {
        if (
          !(cause instanceof Error) ||
          cause.message !== WEB_UNSUPPORTED_MESSAGE
        ) {
          throw cause;
        }
        await withPortableExclusiveTransaction(db, task);
      }
    },
  };
}

// 4.3: single migrations list, applied with CREATE TABLE IF NOT EXISTS so
// re-running on every app start is a no-op once the schema exists (no
// migration-version bookkeeping needed yet -- revisit if a column ever
// needs to change shape, not just gain a new table).
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS datasets_meta (
    name TEXT PRIMARY KEY NOT NULL,
    version TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    synced_at INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY NOT NULL,
    railway_id TEXT NOT NULL,
    name_ja TEXT NOT NULL,
    name_en TEXT NOT NULL,
    seq INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS train_timetables (
    train_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    dep_time TEXT NOT NULL,
    arr_time TEXT NOT NULL,
    car_count INTEGER NOT NULL,
    day_type TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS congestion_profile (
    railway_id TEXT NOT NULL,
    leg_key TEXT NOT NULL,
    time_bucket TEXT NOT NULL,
    day_type TEXT NOT NULL,
    car_number INTEGER NOT NULL,
    load_score REAL NOT NULL,
    sample_n INTEGER NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS correction_stats (
    railway_id TEXT NOT NULL,
    leg_key TEXT NOT NULL,
    time_bucket TEXT NOT NULL,
    day_type TEXT NOT NULL,
    delta_score REAL NOT NULL,
    sample_n INTEGER NOT NULL
  );`,
  // 7.3/11.x: ride history, stored on-device only (16.5 -- deletion is 9.2's
  // job, not built here). `feedback_json` is null until the rider actually
  // submits a feedback answer for this trip. `route_type`/
  // `predicted_standing_minutes` (8.3, weekly-report inputs) were added
  // directly to this CREATE TABLE rather than via a later `ALTER TABLE ADD
  // COLUMN` -- confirmed live in a browser that `ALTER TABLE ... ADD COLUMN
  // IF NOT EXISTS` throws `NoModificationAllowedError` against expo-sqlite's
  // web (IndexedDB-backed) implementation and silently stalls every
  // downstream migration/screen. No shipped users exist yet to preserve an
  // old on-device schema for, so a plain `CREATE TABLE IF NOT EXISTS` (the
  // one pattern already proven to work on both native and web everywhere
  // else in this file) is the correct fix, not just the simpler one.
  `CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY NOT NULL,
    route_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    route_type TEXT,
    predicted_standing_minutes REAL,
    feedback_json TEXT
  );`,
  // 9.1-9.6: commuter routes saved for one-tap re-search. `weekdays_json` is a
  // JSON array (mirrors shared's WEEKDAYS enum) rather than a join table --
  // this is a small, always-fully-replaced list, same simplification as
  // congestion_profile's full-replace sync.
  `CREATE TABLE IF NOT EXISTS saved_routes (
    id TEXT PRIMARY KEY NOT NULL,
    from_station_id TEXT NOT NULL,
    to_station_id TEXT NOT NULL,
    weekdays_json TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    comfort_priority TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
];

let dbPromise: Promise<DbPort> | null = null;

async function migrate(db: DbPort): Promise<void> {
  await db.withExclusiveTransactionAsync(async () => {
    for (const statement of MIGRATIONS) {
      await db.execAsync(statement);
    }
  });
}

// Lazily opens (once per process) and migrates the app's single SQLite
// database, shared by every feature that needs local storage.
export function getDb(): Promise<DbPort> {
  if (dbPromise) {
    return dbPromise;
  }
  const promise = serializeSqliteOpen(() =>
    openDatabaseAsync(DATABASE_NAME),
  ).then(async (db) => {
    const port = toDbPort(db);
    await migrate(port);
    return port;
  });
  dbPromise = promise;
  return promise;
}
