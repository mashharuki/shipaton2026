// design.md names http://localhost:8787 (wrangler dev) as the local backend
// server; EXPO_PUBLIC_* is Expo's convention for values meant to ship in the
// client bundle (same pattern 4.1 used for EXPO_PUBLIC_SENTRY_DSN).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

// backend/src/middleware/api-key.ts requires this on every /v1/* request
// (design.md line 507: MVP-scope app-shared key, not a per-user secret --
// same key ships in every client build, matching apps/backend/.dev.vars'
// API_SHARED_KEY for local dev). Empty by default so a misconfigured build
// fails requests with a clear 401 rather than silently using a guessed value.
export const API_SHARED_KEY = process.env.EXPO_PUBLIC_API_SHARED_KEY ?? "";

// 6.1: RevenueCat public SDK keys -- one per store, per RevenueCat's own
// convention (not a secret; safe to embed in the client bundle, same as any
// other EXPO_PUBLIC_* value here). Empty by default so a misconfigured build
// fails at Purchases.configure() with a clear auth error rather than
// silently pointing at the wrong project.
export const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
export const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";
// Test Store key: used only inside Expo Go (see purchases-client.ts) where a
// real app_store/play_store key throws "Invalid API key" instead of falling
// back to Preview API Mode.
export const REVENUECAT_TEST_STORE_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_API_KEY ?? "";
