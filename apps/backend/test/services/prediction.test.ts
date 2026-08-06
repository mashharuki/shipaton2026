import { describe, expect, it } from "vitest";
import {
  buildNotificationPrediction,
  type CongestionProfileEntry,
  type CorrectionCell,
} from "../../src/services/prediction";

const LEG = "STA_SHINJUKU-STA_TOKYO";

function congestion(
  timeBucket: string,
  loadScore: number,
  carNumber = 1,
): CongestionProfileEntry {
  return {
    legKey: LEG,
    timeBucket,
    dayType: "weekday",
    carNumber,
    loadScore,
    sampleSize: 10,
  };
}

function correction(timeBucket: string, deltaScore: number): CorrectionCell {
  return {
    legKey: LEG,
    timeBucket,
    dayType: "weekday",
    deltaScore,
    sampleN: 10,
  };
}

describe("buildNotificationPrediction", () => {
  it("does not notify when no correction cell exists for the current bucket", () => {
    const result = buildNotificationPrediction({
      legKey: LEG,
      dayType: "weekday",
      timeBucket: "07:30",
      congestionProfiles: [congestion("07:30", 0.5)],
      correctionCells: [],
    });

    expect(result.shouldNotify).toBe(false);
    expect(result.alternative).toBeNull();
    expect(result.reasonFactor).toBeNull();
  });

  it("does not notify when the correction delta is zero or negative (not more crowded than usual)", () => {
    const result = buildNotificationPrediction({
      legKey: LEG,
      dayType: "weekday",
      timeBucket: "07:30",
      congestionProfiles: [congestion("07:30", 0.5)],
      correctionCells: [correction("07:30", -0.1)],
    });

    expect(result.shouldNotify).toBe(false);
  });

  it("notifies with a feedback_correction reason when the delta is positive", () => {
    const result = buildNotificationPrediction({
      legKey: LEG,
      dayType: "weekday",
      timeBucket: "07:30",
      congestionProfiles: [congestion("07:30", 0.5)],
      correctionCells: [correction("07:30", 0.1)],
    });

    expect(result.shouldNotify).toBe(true);
    expect(result.reasonFactor).toBe("feedback_correction");
    expect(result.prediction.factors.map((f) => f.kind)).toContain(
      "feedback_correction",
    );
  });

  it("recommends the least-crowded other bucket for the same leg as the alternative", () => {
    const result = buildNotificationPrediction({
      legKey: LEG,
      dayType: "weekday",
      timeBucket: "07:30",
      congestionProfiles: [
        congestion("07:30", 0.8),
        congestion("07:00", 0.4),
        congestion("08:00", 0.6),
        // Different leg -- must not be considered as an alternative.
        {
          legKey: "STA_OTHER-STA_LEG",
          timeBucket: "07:15",
          dayType: "weekday",
          carNumber: 1,
          loadScore: 0.1,
          sampleSize: 10,
        },
      ],
      correctionCells: [correction("07:30", 0.1)],
    });

    expect(result.alternative).toEqual({
      timeBucket: "07:00",
      standingMinutesSaved: 12, // (0.8 - 0.4) * 30
    });
  });

  it("returns no alternative when no other bucket is less crowded", () => {
    const result = buildNotificationPrediction({
      legKey: LEG,
      dayType: "weekday",
      timeBucket: "07:30",
      congestionProfiles: [congestion("07:30", 0.3), congestion("08:00", 0.9)],
      correctionCells: [correction("07:30", 0.1)],
    });

    expect(result.alternative).toBeNull();
  });
});
