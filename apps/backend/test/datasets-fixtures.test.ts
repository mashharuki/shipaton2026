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
    expect(timetableFixture.version).toBe("1");
    expect(() =>
      timetableDatasetPayloadSchema.parse(timetableFixture.payload),
    ).not.toThrow();
  });

  it("congestion.json: payload conforms to congestionDatasetPayloadSchema", () => {
    expect(congestionFixture.version).toBe("1");
    expect(() =>
      congestionDatasetPayloadSchema.parse(congestionFixture.payload),
    ).not.toThrow();
  });

  it("correction.json: payload conforms to correctionDatasetPayloadSchema (empty seed)", () => {
    expect(correctionFixture.version).toBe("1");
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
    const legKeys = new Set(
      congestionFixture.payload.profiles.map((p) => p.legKey),
    );
    expect(legKeys.size).toBe(1);
  });
});
