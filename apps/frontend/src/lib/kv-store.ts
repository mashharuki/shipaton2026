import { Storage } from "expo-sqlite/kv-store";

import { serializeSqliteOpen } from "./sqlite-open-gate";

// design.md: "kv-store" for small persisted values (onboarding_completed,
// preferences, usage_counter:{date}, recent_searches, locale, theme) --
// backed by expo-sqlite's AsyncStorage-compatible SQLite-backed store
// (`expo-sqlite/kv-store`, distinct from the app's main SQLite tables in
// lib/db.ts). Exposed as the exact shape zustand's `persist` middleware
// expects (getItem/setItem/removeItem returning Promise<string|null>/
// Promise<void>), so feature stores can pass it straight to
// `createJSONStorage(() => kvStore)`.
let opened = false;

// 10.2: every kv-store consumer -- zustand's `createJSONStorage(() =>
// kvStore)` (preference-store.ts, usage-limiter.ts, privacy-settings-store.ts,
// push-registration.ts) and getJson/setJson below (onboarding-store.ts,
// recent-searches.ts) -- goes through this wrapper rather than the raw
// `Storage` instance, so the very first call is serialized against
// lib/db.ts's own first `openDatabaseAsync` call (see sqlite-open-gate.ts
// for why that matters on web). `opened` latches permanently once the
// first call has *succeeded* -- on failure it stays false, so a retry
// still goes through the gate instead of racing a concurrent retry of its
// own.
function gated<T>(op: () => Promise<T>): Promise<T> {
  if (opened) {
    return op();
  }
  return serializeSqliteOpen(op).then((result) => {
    opened = true;
    return result;
  });
}

export const kvStore = {
  getItem: (key: string) => gated(() => Storage.getItem(key)),
  setItem: (key: string, value: string) =>
    gated(() => Storage.setItem(key, value)),
  removeItem: (key: string) => gated(() => Storage.removeItem(key)),
};

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await kvStore.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await kvStore.setItem(key, JSON.stringify(value));
}
