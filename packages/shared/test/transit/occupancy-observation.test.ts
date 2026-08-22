import { describe, expect, it } from "vitest";
import {
  isOccupancyStatus,
  OCCUPANCY_STATUSES,
  seatProbabilityForOccupancyStatus,
} from "../../src/transit/occupancy-observation";

describe("isOccupancyStatus", () => {
  it("accepts every value in OCCUPANCY_STATUSES", () => {
    for (const status of OCCUPANCY_STATUSES) {
      expect(isOccupancyStatus(status)).toBe(true);
    }
  });

  it("rejects an unrelated string", () => {
    expect(isOccupancyStatus("SOMEWHAT_BUSY")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isOccupancyStatus(3)).toBe(false);
    expect(isOccupancyStatus(null)).toBe(false);
    expect(isOccupancyStatus(undefined)).toBe(false);
  });
});

describe("seatProbabilityForOccupancyStatus", () => {
  it("returns 1 for EMPTY and 0 for FULL (the two ordinal extremes)", () => {
    expect(seatProbabilityForOccupancyStatus("EMPTY")).toBe(1);
    expect(seatProbabilityForOccupancyStatus("FULL")).toBe(0);
  });

  it("is monotonically non-increasing across the ordinal scale", () => {
    const probabilities = OCCUPANCY_STATUSES.map((status) =>
      seatProbabilityForOccupancyStatus(status),
    );
    for (let i = 1; i < probabilities.length; i++) {
      expect(probabilities[i]).toBeLessThanOrEqual(probabilities[i - 1]);
    }
  });

  it("returns a value in [0, 1] for every status", () => {
    for (const status of OCCUPANCY_STATUSES) {
      const probability = seatProbabilityForOccupancyStatus(status);
      expect(probability).toBeGreaterThanOrEqual(0);
      expect(probability).toBeLessThanOrEqual(1);
    }
  });
});
