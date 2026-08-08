import { describe, expect, it, vi } from "vitest";

// Same expo-sqlite/kv-store mocking precedent as preference-store.test.ts /
// push-registration.test.ts: the real module transitively imports
// react-native and can't be parsed under this project's Vite-based Vitest
// pipeline.
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

import {
  completeOnboarding,
  hasCompletedOnboarding,
} from "@/features/onboarding/onboarding-store";

describe("hasCompletedOnboarding", () => {
  it("should be false before onboarding has ever been completed", async () => {
    await expect(hasCompletedOnboarding()).resolves.toBe(false);
  });

  it("should be true after completeOnboarding() has been called", async () => {
    await completeOnboarding();

    await expect(hasCompletedOnboarding()).resolves.toBe(true);
  });
});
