import { describe, expect, it } from "vitest";

import { clampRatio } from "@/components/ui/rule-bar-math";

describe("clampRatio", () => {
  it("should return the value unchanged when already within [0, 1]", () => {
    expect(clampRatio(0.42)).toBe(0.42);
  });

  it("should clamp values below 0 to 0", () => {
    expect(clampRatio(-0.2)).toBe(0);
  });

  it("should clamp values above 1 to 1", () => {
    expect(clampRatio(1.5)).toBe(1);
  });

  it("should treat boundary values as-is", () => {
    expect(clampRatio(0)).toBe(0);
    expect(clampRatio(1)).toBe(1);
  });

  it("should return 0 for NaN input instead of propagating NaN", () => {
    expect(clampRatio(Number.NaN)).toBe(0);
  });
});
