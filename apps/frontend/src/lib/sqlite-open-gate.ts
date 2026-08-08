// 10.2: expo-sqlite's web backend (OPFS/wa-sqlite) routes every database
// through one module-level shared Worker (expo-sqlite/web/SQLiteModule.ts's
// `worker` singleton, common to every `openDatabaseAsync` call regardless
// of which database file). Confirmed live in a browser: this app opens two
// *separate* databases at boot -- lib/db.ts's "seatsignal.db" (dataset
// sync) and expo-sqlite/kv-store's own "ExpoSQLiteStorage" (onboarding
// flag, preferences, usage limiter, ...) -- and when both first-ever opens
// land on that shared worker concurrently, the OPFS access-handle pool
// (wa-sqlite's AccessHandlePoolVFS) races and throws
// `NoModificationAllowedError: createSyncAccessHandle`, crashing the whole
// app. Reproduced with `expo-sqlite@57.0.1` (current latest stable) even
// under a fresh, isolated browser context with no other tabs open -- a
// platform bug, not an app logic bug, and native SQLite has no such
// shared-worker/OPFS constraint to race in the first place.
//
// The fix here is deliberately narrow: every *first-ever* open of an
// expo-sqlite database on this platform chains onto this one promise
// instead of racing the others, so the shared worker only ever has one
// open in flight at a time during the boot window. Once open, each
// database's own caller-side singleton (lib/db.ts's `dbPromise`,
// kv-store.ts's `ensureKvStoreOpen`) skips this gate entirely -- it only
// matters for first-open ordering, not steady-state reads/writes.
let chain: Promise<unknown> = Promise.resolve();

export function serializeSqliteOpen<T>(open: () => Promise<T>): Promise<T> {
  const result = chain.then(open, open);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
