import { describe, expect, it, vi } from "vitest";

// Same expo-sqlite/kv-store mocking precedent as preference-store.test.ts.
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
  DEFAULT_DATA_SHARING_SCOPE,
  usePrivacySettingsStore,
} from "@/features/settings/privacy-settings-store";

describe("usePrivacySettingsStore", () => {
  it("should default data sharing scope to standard", () => {
    expect(DEFAULT_DATA_SHARING_SCOPE).toBe("standard");
    expect(usePrivacySettingsStore.getState().dataSharingScope).toBe(
      "standard",
    );
  });

  it("should update the data sharing scope via setDataSharingScope", () => {
    usePrivacySettingsStore.getState().setDataSharingScope("minimal");

    expect(usePrivacySettingsStore.getState().dataSharingScope).toBe("minimal");
  });
});
