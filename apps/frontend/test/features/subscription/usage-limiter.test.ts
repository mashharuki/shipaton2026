import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same expo-sqlite/kv-store mocking convention as
// test/features/preferences/preference-store.test.ts.
const memoryStore = new Map<string, string>();
vi.mock("expo-sqlite/kv-store", () => ({
  Storage: {
    getItem: async (key: string) => memoryStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: async (key: string) => {
      memoryStore.delete(key);
    },
  },
}));

beforeEach(() => {
  memoryStore.clear();
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-06T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usage-limiter", () => {
  it("should count 0 searches before any recordSearch call", async () => {
    const { getSearchCountToday, hasReachedDailySearchLimit } = await import(
      "@/features/subscription/usage-limiter"
    );
    expect(getSearchCountToday()).toBe(0);
    expect(hasReachedDailySearchLimit()).toBe(false);
  });

  it("should allow the first 3 searches and reach the limit on the 4th", async () => {
    const {
      useUsageLimiterStore,
      getSearchCountToday,
      hasReachedDailySearchLimit,
    } = await import("@/features/subscription/usage-limiter");

    for (let i = 0; i < 3; i++) {
      expect(hasReachedDailySearchLimit()).toBe(false);
      useUsageLimiterStore.getState().recordSearch();
    }

    expect(getSearchCountToday()).toBe(3);
    expect(hasReachedDailySearchLimit()).toBe(true);
  });

  it("should reset the counter when the date changes", async () => {
    const { useUsageLimiterStore, getSearchCountToday } = await import(
      "@/features/subscription/usage-limiter"
    );

    useUsageLimiterStore.getState().recordSearch();
    useUsageLimiterStore.getState().recordSearch();
    expect(getSearchCountToday()).toBe(2);

    vi.setSystemTime(new Date("2026-08-07T10:00:00Z"));
    expect(getSearchCountToday()).toBe(0);

    useUsageLimiterStore.getState().recordSearch();
    expect(getSearchCountToday()).toBe(1);
  });

  it("should reflect a persisted count after a simulated cold restart, once hydration is awaited", async () => {
    const before = await import("@/features/subscription/usage-limiter");
    before.useUsageLimiterStore.getState().recordSearch();
    before.useUsageLimiterStore.getState().recordSearch();
    before.useUsageLimiterStore.getState().recordSearch();
    // flush the microtask-based kv-store write persist triggers after set()
    await Promise.resolve();
    await Promise.resolve();
    expect(memoryStore.get("usage_counter")).toBeDefined();

    // simulate an app restart: fresh module instance, same kv-store backing
    vi.resetModules();
    const after = await import("@/features/subscription/usage-limiter");

    await after.ensureUsageLimiterHydrated();

    expect(after.getSearchCountToday()).toBe(3);
    expect(after.hasReachedDailySearchLimit()).toBe(true);
  });
});
