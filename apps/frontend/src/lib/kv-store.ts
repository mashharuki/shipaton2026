import { Storage } from "expo-sqlite/kv-store";

// design.md: "kv-store" for small persisted values (onboarding_completed,
// preferences, usage_counter:{date}, recent_searches, locale, theme) --
// backed by expo-sqlite's AsyncStorage-compatible SQLite-backed store
// (`expo-sqlite/kv-store`, distinct from the app's main SQLite tables in
// lib/db.ts). Exposed as the exact shape zustand's `persist` middleware
// expects (getItem/setItem/removeItem returning Promise<string|null>/
// Promise<void>), so feature stores can pass it straight to
// `createJSONStorage(() => kvStore)`.
export const kvStore = Storage;

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await kvStore.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await kvStore.setItem(key, JSON.stringify(value));
}
