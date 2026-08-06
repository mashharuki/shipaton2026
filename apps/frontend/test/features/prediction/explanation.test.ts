import type { PredictionFactor } from "shared";
import { describe, expect, it } from "vitest";

import { explainPrediction } from "@/features/prediction/explanation";

describe("explainPrediction", () => {
  it("should return exactly the message keys of the contributed factors, in order (5.6)", () => {
    const factors: PredictionFactor[] = [
      {
        kind: "base_profile",
        contribution: 12,
        messageKey: "prediction.factor.baseProfile",
      },
      { kind: "delay", contribution: 3, messageKey: "prediction.factor.delay" },
    ];

    expect(explainPrediction(factors)).toEqual([
      "prediction.factor.baseProfile",
      "prediction.factor.delay",
    ]);
  });

  it("should return an empty explanation when there are no contributing factors", () => {
    expect(explainPrediction([])).toEqual([]);
  });
});
