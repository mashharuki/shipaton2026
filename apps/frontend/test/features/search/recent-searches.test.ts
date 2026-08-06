import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same expo-sqlite/kv-store Flow-parse wall as preference-store.test.ts --
// mocked so the real (native-runtime-only) module is never loaded.
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
  addRecentSearch,
  getRecentSearches,
} from "@/features/search/recent-searches";

describe("recent searches", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  afterEach(() => {
    memoryStore.clear();
  });

  it("should return an empty list before any search has been saved", async () => {
    expect(await getRecentSearches()).toEqual([]);
  });

  it("should save a search and make it retrievable, most recent first", async () => {
    await addRecentSearch({ fromStationId: "STA_A", toStationId: "STA_B" });
    await addRecentSearch({ fromStationId: "STA_C", toStationId: "STA_D" });

    const recent = await getRecentSearches();
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({
      fromStationId: "STA_C",
      toStationId: "STA_D",
    });
    expect(recent[1]).toMatchObject({
      fromStationId: "STA_A",
      toStationId: "STA_B",
    });
  });

  it("should move a repeated search to the front instead of duplicating it", async () => {
    await addRecentSearch({ fromStationId: "STA_A", toStationId: "STA_B" });
    await addRecentSearch({ fromStationId: "STA_C", toStationId: "STA_D" });
    await addRecentSearch({ fromStationId: "STA_A", toStationId: "STA_B" });

    const recent = await getRecentSearches();
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({
      fromStationId: "STA_A",
      toStationId: "STA_B",
    });
  });

  it("should cap the list at 5 entries, dropping the oldest", async () => {
    for (let i = 0; i < 6; i++) {
      await addRecentSearch({
        fromStationId: `STA_${i}`,
        toStationId: "STA_DEST",
      });
    }

    const recent = await getRecentSearches();
    expect(recent).toHaveLength(5);
    expect(recent.map((s) => s.fromStationId)).not.toContain("STA_0");
    expect(recent[0]?.fromStationId).toBe("STA_5");
  });
});
