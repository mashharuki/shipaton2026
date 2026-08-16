import { isErr, isOk } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCongestionData,
  getCorrectionData,
  getTimetableData,
  syncDatasets,
} from "@/features/dataset/dataset-repository";
import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
  DatasetMetaRow,
  DatasetStore,
  TimetableDatasetPayload,
} from "@/features/dataset/dataset-store";

type FakeStore = DatasetStore & {
  replaceCalls: { timetable: number; congestion: number; correction: number };
};

function createFakeStore(): FakeStore {
  const meta: Partial<
    Record<"timetable" | "congestion" | "correction", DatasetMetaRow>
  > = {};
  let timetable: TimetableDatasetPayload = {
    schemaVersion: 1,
    stations: [],
    trips: [],
  };
  let congestion: CongestionDatasetPayload = { schemaVersion: 1, profiles: [] };
  let correction: CorrectionDatasetPayload = { schemaVersion: 1, stats: [] };
  const replaceCalls = { timetable: 0, congestion: 0, correction: 0 };

  return {
    replaceCalls,
    async getMeta(name) {
      return meta[name] ?? null;
    },
    async replaceTimetable(version, payload) {
      replaceCalls.timetable += 1;
      timetable = payload;
      meta.timetable = { version, schemaVersion: payload.schemaVersion };
    },
    async replaceCongestion(version, payload) {
      replaceCalls.congestion += 1;
      congestion = payload;
      meta.congestion = { version, schemaVersion: payload.schemaVersion };
    },
    async replaceCorrection(version, payload) {
      replaceCalls.correction += 1;
      correction = payload;
      meta.correction = { version, schemaVersion: payload.schemaVersion };
    },
    async getTimetable() {
      return timetable;
    },
    async getCongestion() {
      return congestion;
    },
    async getCorrection() {
      return correction;
    },
  };
}

const emptyCongestion: CongestionDatasetPayload = {
  schemaVersion: 1,
  profiles: [],
};
const emptyCorrection: CorrectionDatasetPayload = {
  schemaVersion: 1,
  stats: [],
};

function timetableWith(
  stationId: string,
  schemaVersion = 1,
): TimetableDatasetPayload {
  return {
    schemaVersion,
    stations: [
      {
        id: stationId,
        railwayId: "RAIL_CHUO",
        nameJa: "駅",
        nameEn: "Station",
        seq: 0,
      },
    ],
    trips: [],
  };
}

function mockFetchServing(
  version: string,
  timetablePayload: TimetableDatasetPayload,
) {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("/v1/datasets/timetable")) {
      return new Response(
        JSON.stringify({ version, payload: timetablePayload }),
        { status: 200 },
      );
    }
    if (url.includes("/v1/datasets/congestion")) {
      return new Response(
        JSON.stringify({ version, payload: emptyCongestion }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ version, payload: emptyCorrection }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
}

function mockFetchOffline() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(
      new TypeError("Network request failed"),
    ) as unknown as typeof fetch;
}

function mockFetchNotModified(version: string) {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ version, notModified: true }), {
      status: 200,
    }),
  ) as unknown as typeof fetch;
}

describe("dataset-repository", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return dataset_missing when the timetable has never been synced", async () => {
    const store = createFakeStore();

    const result = await getTimetableData(store);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("dataset_missing");
    }
  });

  it("should store and serve the timetable after a successful sync", async () => {
    const store = createFakeStore();
    mockFetchServing("v1", timetableWith("STA_A"));

    await syncDatasets(store);
    const result = await getTimetableData(store);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.stations).toEqual([
        expect.objectContaining({ id: "STA_A" }),
      ]);
    }
  });

  it("should keep serving previously synced data when a sync attempt fails (airplane mode)", async () => {
    const store = createFakeStore();
    mockFetchServing("v1", timetableWith("STA_A"));
    await syncDatasets(store);

    mockFetchOffline();
    await syncDatasets(store);

    const result = await getTimetableData(store);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.stations).toEqual([
        expect.objectContaining({ id: "STA_A" }),
      ]);
    }
  });

  it("should reject an unsupported schemaVersion and keep serving existing data (forward compatibility)", async () => {
    const store = createFakeStore();
    mockFetchServing("v1", timetableWith("STA_A"));
    await syncDatasets(store);

    mockFetchServing("v2", timetableWith("STA_B", 999));
    await syncDatasets(store);

    const result = await getTimetableData(store);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.stations).toEqual([
        expect.objectContaining({ id: "STA_A" }),
      ]);
    }
    expect(store.replaceCalls.timetable).toBe(1);
  });

  it("should replace stored data when a new dataset version is fetched", async () => {
    const store = createFakeStore();
    mockFetchServing("v1", timetableWith("STA_A"));
    await syncDatasets(store);

    mockFetchServing("v2", timetableWith("STA_B"));
    await syncDatasets(store);

    const result = await getTimetableData(store);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.stations).toEqual([
        expect.objectContaining({ id: "STA_B" }),
      ]);
    }
    expect(store.replaceCalls.timetable).toBe(2);
  });

  it("should not replace stored data when the server reports notModified", async () => {
    const store = createFakeStore();
    mockFetchServing("v1", timetableWith("STA_A"));
    await syncDatasets(store);

    mockFetchNotModified("v1");
    await syncDatasets(store);

    expect(store.replaceCalls.timetable).toBe(1);
  });

  it("should return dataset_missing for congestion/correction before sync, like timetable", async () => {
    const store = createFakeStore();

    const congestionResult = await getCongestionData(store);
    const correctionResult = await getCorrectionData(store);

    expect(isErr(congestionResult) && congestionResult.error.code).toBe(
      "dataset_missing",
    );
    expect(isErr(correctionResult) && correctionResult.error.code).toBe(
      "dataset_missing",
    );
  });
});
