import { describe, expect, it, vi } from "vitest";

// expo-sqlite/kv-store transitively imports expo-modules-core -> react-native,
// which can't be parsed under this project's Vitest/Vite pipeline (Flow
// syntax -- same wall documented for expo-crypto in 4.5's Implementation
// Note). Mocking means the real module is never loaded/parsed; the store's
// own logic (state shape, defaults, updates) is what this file verifies.
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
  DEFAULT_PREFERENCE,
  usePreferenceStore,
} from "@/features/preferences/preference-store";

describe("usePreferenceStore", () => {
  it("should default to a balanced preference with no physical/body fields", () => {
    expect(DEFAULT_PREFERENCE).toEqual({
      speedComfortBalance: "balance",
      maxExtraMinutes: 15,
      transferTolerance: "medium",
      walkingTolerance: "medium",
    });
    expect(Object.keys(DEFAULT_PREFERENCE).sort()).toEqual([
      "maxExtraMinutes",
      "speedComfortBalance",
      "transferTolerance",
      "walkingTolerance",
    ]);
  });

  it("should update the current preference via setPreference, merging with the existing value", () => {
    usePreferenceStore
      .getState()
      .setPreference({ speedComfortBalance: "comfort" });

    const { preference } = usePreferenceStore.getState();
    expect(preference.speedComfortBalance).toBe("comfort");
    // untouched fields are preserved, not reset to defaults
    expect(preference.maxExtraMinutes).toBe(DEFAULT_PREFERENCE.maxExtraMinutes);
  });

  it("should accept independent partial updates for each preference field", () => {
    usePreferenceStore.getState().setPreference({ maxExtraMinutes: 25 });
    usePreferenceStore.getState().setPreference({ transferTolerance: "low" });
    usePreferenceStore.getState().setPreference({ walkingTolerance: "high" });

    const { preference } = usePreferenceStore.getState();
    expect(preference.maxExtraMinutes).toBe(25);
    expect(preference.transferTolerance).toBe("low");
    expect(preference.walkingTolerance).toBe("high");
  });
});
