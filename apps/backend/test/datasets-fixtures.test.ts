import {
  congestionDatasetPayloadSchema,
  correctionDatasetPayloadSchema,
  timetableDatasetPayloadSchema,
} from "shared";
import { describe, expect, it } from "vitest";
import congestionFixture from "../fixtures/datasets/congestion.json";
import correctionFixture from "../fixtures/datasets/correction.json";
import timetableFixture from "../fixtures/datasets/timetable.json";

/**
 * Regression guard for the fixtures generate-datasets.ts writes (task 2.3
 * completion condition: generated+pushed payloads pass contract-schema
 * validation). generate-datasets.ts itself validates via `.parse()` at
 * generation time; this test re-validates the *committed* JSON so drift
 * (a hand-edit, a schema change) is caught by `pnpm --filter backend test`
 * without needing to re-run the Node-only generator script.
 */
describe("dataset fixtures match the contract schema", () => {
  it("timetable.json: payload conforms to timetableDatasetPayloadSchema", () => {
    expect(timetableFixture.version).toBe("4");
    expect(() =>
      timetableDatasetPayloadSchema.parse(timetableFixture.payload),
    ).not.toThrow();
  });

  it("congestion.json: payload conforms to congestionDatasetPayloadSchema", () => {
    expect(congestionFixture.version).toBe("4");
    expect(() =>
      congestionDatasetPayloadSchema.parse(congestionFixture.payload),
    ).not.toThrow();
  });

  it("correction.json: payload conforms to correctionDatasetPayloadSchema (empty seed)", () => {
    expect(correctionFixture.version).toBe("4");
    const parsed = correctionDatasetPayloadSchema.parse(
      correctionFixture.payload,
    );
    expect(parsed.stats).toEqual([]);
  });

  it("timetable and congestion cover exactly one railway/corridor (single-line MVP scope)", () => {
    const railwayIds = new Set(
      timetableFixture.payload.stations.map((s) => s.railwayId),
    );
    expect(railwayIds.size).toBe(1);
  });
});

describe("congestion fixture leg coverage", () => {
  it("covers every forward station pair in the timetable", () => {
    const stations = [...timetableFixture.payload.stations].sort(
      (a, b) => a.seq - b.seq,
    );
    const expectedLegKeys = new Set<string>();
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        expectedLegKeys.add(`${stations[i].id}-${stations[j].id}`);
      }
    }

    const actualLegKeys = new Set(
      congestionFixture.payload.profiles.map((p) => p.legKey),
    );

    expect(actualLegKeys).toEqual(expectedLegKeys);
  });

  it("gives every legKey the same complete timeBucket x carNumber matrix", () => {
    // The set-equality check above only proves every legKey is present --
    // it would still pass if a regression silently dropped some
    // timeBucket/carNumber combinations for one leg while keeping others
    // full. Derive the expected combination set from the data itself
    // (rather than hardcoding the generator's current 10 buckets x 10 cars)
    // so this stays correct if those counts ever change.
    const profiles = congestionFixture.payload.profiles;
    const allTimeBuckets = new Set(profiles.map((p) => p.timeBucket));
    const allCarNumbers = new Set(profiles.map((p) => p.carNumber));
    const expectedCombos = new Set<string>();
    for (const timeBucket of allTimeBuckets) {
      for (const carNumber of allCarNumbers) {
        expectedCombos.add(`${timeBucket}|${carNumber}`);
      }
    }

    const combosByLegKey = new Map<string, Set<string>>();
    for (const profile of profiles) {
      const combos = combosByLegKey.get(profile.legKey) ?? new Set<string>();
      combos.add(`${profile.timeBucket}|${profile.carNumber}`);
      combosByLegKey.set(profile.legKey, combos);
    }

    for (const [legKey, combos] of combosByLegKey) {
      expect(combos, `legKey ${legKey} combo set`).toEqual(expectedCombos);
      expect(
        [...profiles].filter((p) => p.legKey === legKey).length,
        `legKey ${legKey} entry count (guards against duplicate entries)`,
      ).toBe(expectedCombos.size);
    }
  });
});
