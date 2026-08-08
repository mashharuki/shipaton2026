import { getJson, setJson } from "@/lib/kv-store";

// 1.5: kv-store flag (same small-persisted-value convention as
// preference-store.ts/usage-limiter.ts) gating whether app/_layout.tsx
// routes a cold start to /onboarding or straight to the (tabs) home screen.
const ONBOARDING_COMPLETED_KEY = "onboarding_completed";

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await getJson<boolean>(ONBOARDING_COMPLETED_KEY);
  return value === true;
}

export async function completeOnboarding(): Promise<void> {
  await setJson(ONBOARDING_COMPLETED_KEY, true);
}
