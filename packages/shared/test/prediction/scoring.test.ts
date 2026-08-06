import { describe, expect, it } from "vitest";
import {
  confidenceForSampleSize,
  scorePrediction,
} from "../../src/prediction/scoring";

describe("scorePrediction determinism", () => {
  it("should return identical output for identical input across repeated calls", () => {
    const input = {
      baseLoadScore: 0.5,
      sampleSize: 25,
      dayTypeAdjustment: 0.1,
      weatherAdjustment: 0.05,
      feedbackCorrection: { deltaScore: -0.05 },
      delayMinutes: 3,
    };

    const first = scorePrediction({ ...input });
    const second = scorePrediction({ ...input });

    expect(first).toEqual(second);
  });

  it("should sum every named term into a high-confidence point estimate (golden)", () => {
    const result = scorePrediction({
      baseLoadScore: 0.5,
      sampleSize: 25,
      dayTypeAdjustment: 0.1,
      weatherAdjustment: 0.05,
      feedbackCorrection: { deltaScore: -0.05 },
      delayMinutes: 3,
    });

    expect(result).toEqual({
      standingMinutes: { point: 21 },
      confidence: "high",
      sampleSizeHint: "20+",
      factors: [
        {
          kind: "base_profile",
          contribution: 15,
          messageKey: "prediction.factor.baseProfile",
        },
        {
          kind: "day_type",
          contribution: 3,
          messageKey: "prediction.factor.dayType",
        },
        {
          kind: "weather",
          contribution: 1.5,
          messageKey: "prediction.factor.weather",
        },
        {
          kind: "feedback_correction",
          contribution: -1.5,
          messageKey: "prediction.factor.feedbackCorrection",
        },
        {
          kind: "delay",
          contribution: 3,
          messageKey: "prediction.factor.delay",
        },
      ],
    });
  });
});

describe("scorePrediction confidence threshold crossing", () => {
  it("should switch from a range to a point estimate exactly at the low/medium sample-size boundary", () => {
    const belowThreshold = scorePrediction({
      baseLoadScore: 0.5,
      sampleSize: 4,
    });
    const atThreshold = scorePrediction({ baseLoadScore: 0.5, sampleSize: 5 });

    expect(belowThreshold.confidence).toBe("low");
    expect(belowThreshold.standingMinutes).toEqual({
      rangeMin: 10.5,
      rangeMax: 19.5,
    });

    expect(atThreshold.confidence).toBe("medium");
    expect(atThreshold.standingMinutes).toEqual({ point: 15 });
  });

  it("should report a matching sampleSizeHint on each side of every threshold", () => {
    expect(
      scorePrediction({ baseLoadScore: 0.1, sampleSize: 3 }).sampleSizeHint,
    ).toBe("<5");
    expect(
      scorePrediction({ baseLoadScore: 0.1, sampleSize: 5 }).sampleSizeHint,
    ).toBe("5-19");
    expect(
      scorePrediction({ baseLoadScore: 0.1, sampleSize: 19 }).sampleSizeHint,
    ).toBe("5-19");
    expect(
      scorePrediction({ baseLoadScore: 0.1, sampleSize: 20 }).sampleSizeHint,
    ).toBe("20+");
  });

  it("should clamp a negative total to zero rather than a negative standing-minute estimate", () => {
    const result = scorePrediction({
      baseLoadScore: 0,
      sampleSize: 25,
      feedbackCorrection: { deltaScore: -1 },
    });
    expect(result.standingMinutes).toEqual({ point: 0 });
  });
});

describe("scorePrediction factor inclusion", () => {
  it("should only include the base_profile factor when no optional data is supplied", () => {
    const result = scorePrediction({ baseLoadScore: 0.4, sampleSize: 10 });
    expect(result.factors).toEqual([
      {
        kind: "base_profile",
        contribution: 12,
        messageKey: "prediction.factor.baseProfile",
      },
    ]);
  });

  it("should omit the delay factor when delayMinutes is zero", () => {
    const result = scorePrediction({
      baseLoadScore: 0.4,
      sampleSize: 10,
      delayMinutes: 0,
    });
    expect(result.factors.some((factor) => factor.kind === "delay")).toBe(
      false,
    );
  });

  it("should include the delay factor only when delayMinutes is positive", () => {
    const result = scorePrediction({
      baseLoadScore: 0.4,
      sampleSize: 10,
      delayMinutes: 5,
    });
    expect(result.factors).toContainEqual({
      kind: "delay",
      contribution: 5,
      messageKey: "prediction.factor.delay",
    });
  });

  it("should include a feedback_correction factor with a zero contribution when data was actually supplied", () => {
    const result = scorePrediction({
      baseLoadScore: 0.4,
      sampleSize: 10,
      feedbackCorrection: { deltaScore: 0 },
    });
    expect(result.factors).toContainEqual({
      kind: "feedback_correction",
      contribution: 0,
      messageKey: "prediction.factor.feedbackCorrection",
    });
  });
});

describe("confidenceForSampleSize", () => {
  it("should match scorePrediction's own low/medium/high thresholds exactly", () => {
    expect(confidenceForSampleSize(4)).toBe("low");
    expect(confidenceForSampleSize(5)).toBe("medium");
    expect(confidenceForSampleSize(19)).toBe("medium");
    expect(confidenceForSampleSize(20)).toBe("high");
  });
});
