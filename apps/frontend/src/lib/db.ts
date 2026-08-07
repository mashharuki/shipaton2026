import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

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

function toDbPort(db: SQLiteDatabase): DbPort {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: async (source, params = []) => {
      await db.runAsync(source, params);
    },
    getFirstAsync: (source, params = []) => db.getFirstAsync(source, params),
    getAllAsync: (source, params = []) => db.getAllAsync(source, params),
    withExclusiveTransactionAsync: (task) =>
      db.withExclusiveTransactionAsync(task),
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
  // submits a feedback answer for this trip.
  `CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY NOT NULL,
    route_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
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
  const promise = openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    const port = toDbPort(db);
    await migrate(port);
    return port;
  });
  dbPromise = promise;
  return promise;
}
