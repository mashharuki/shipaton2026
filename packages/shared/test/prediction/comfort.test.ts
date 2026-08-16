import { describe, expect, it } from "vitest";

import {
  COMFORT_PROVENANCES,
  isComfortProvenance,
} from "../../src/prediction/comfort";

describe("isComfortProvenance", () => {
  it("should return true when the value is a known provenance", () => {
    for (const provenance of COMFORT_PROVENANCES) {
      expect(isComfortProvenance(provenance)).toBe(true);
    }
  });

  it("should return false when the value is an unknown string", () => {
    expect(isComfortProvenance("guessed")).toBe(false);
  });

  it("should return false when the value is not a string", () => {
    expect(isComfortProvenance(undefined)).toBe(false);
    expect(isComfortProvenance(3)).toBe(false);
  });

  it("should list measured and modeled as distinct provenances", () => {
    expect(COMFORT_PROVENANCES).toContain("measured");
    expect(COMFORT_PROVENANCES).toContain("modeled");
  });
});
