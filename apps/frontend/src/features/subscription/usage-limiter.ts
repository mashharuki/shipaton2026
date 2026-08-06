import { FREE_DAILY_SEARCH_LIMIT } from "shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { todayDateString } from "@/lib/clock-time";
import { kvStore } from "@/lib/kv-store";

// 12.1/12.2: date-bucketed daily search counter. Persisted via kv-store (same
// pattern as preference-store.ts) so the count survives an app restart within
// the same day. A new date automatically means a fresh count -- no explicit
// "reset" action exists, matching design.md's stated risk (kv-store `date +
// count` counters have low tamper resistance -- accepted for MVP).
type UsageLimiterState = {
  date: string;
  count: number;
};

type UsageLimiterStore = UsageLimiterState & {
  recordSearch: () => void;
};

export const useUsageLimiterStore = create<UsageLimiterStore>()(
  persist(
    (set, get) => ({
      date: "",
      count: 0,
      recordSearch: () => {
        const today = todayDateString();
        const current = get();
        set(
          current.date === today
            ? { count: current.count + 1 }
            : { date: today, count: 1 },
        );
      },
    }),
    {
      name: "usage_counter",
      storage: createJSONStorage(() => kvStore),
    },
  ),
);

export function getSearchCountToday(): number {
  const state = useUsageLimiterStore.getState();
  return state.date === todayDateString() ? state.count : 0;
}

export function hasReachedDailySearchLimit(): boolean {
  return getSearchCountToday() >= FREE_DAILY_SEARCH_LIMIT;
}

// zustand's `persist` rehydrates from kv-store asynchronously in the
// background; a synchronous getSearchCountToday()/hasReachedDailySearchLimit()
// call made before that resolves would see the pre-hydration default
// ({date: "", count: 0}) and silently under-count a returning user who
// already used up today's searches. Callers that need a trustworthy count
// (initSubscriptionGate) must await this once before relying on the
// synchronous reads above -- distinct from design.md's already-accepted
// tamper-resistance risk (a user editing local storage), this is a startup
// race that would otherwise let a 4th search through for free.
export async function ensureUsageLimiterHydrated(): Promise<void> {
  await useUsageLimiterStore.persist.rehydrate();
}
