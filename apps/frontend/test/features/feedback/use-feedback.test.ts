import { feedbackPayloadSchema } from "shared";
import { describe, expect, it } from "vitest";

import { buildFeedbackPayload } from "@/features/feedback/use-feedback";

const context = {
  tripId: "6f9a2b3e-4b7a-4a4b-8b2b-9b6b1e2e3f4a",
  railwayId: "RAIL_CHUO",
  legKey: "STA_SHINJUKU-STA_TOKYO",
  boardedAt: "07:30",
};

describe("buildFeedbackPayload", () => {
  it("should build a seated_from_start payload with no seatedStationId field", () => {
    const payload = buildFeedbackPayload(context, {
      seatedOutcome: "seated_from_start",
    });

    expect(payload).not.toHaveProperty("seatedStationId");
    expect(payload).not.toHaveProperty("vsExpected");
    expect(payload).not.toHaveProperty("predictedStandingMin");
    expect(feedbackPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("should build a seated_from_middle payload including the seated station", () => {
    const payload = buildFeedbackPayload(context, {
      seatedOutcome: "seated_from_middle",
      seatedStationId: "STA_YOTSUYA",
    });

    expect(payload).toMatchObject({
      seatedOutcome: "seated_from_middle",
      seatedStationId: "STA_YOTSUYA",
    });
    expect(feedbackPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("should build a stood_whole_trip payload", () => {
    const payload = buildFeedbackPayload(context, {
      seatedOutcome: "stood_whole_trip",
    });

    expect(feedbackPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("should include the optional vsExpected answer only when provided", () => {
    const withAnswer = buildFeedbackPayload(
      context,
      { seatedOutcome: "stood_whole_trip" },
      "more_crowded_than_expected",
    );
    expect(withAnswer).toMatchObject({
      vsExpected: "more_crowded_than_expected",
    });

    const withoutAnswer = buildFeedbackPayload(context, {
      seatedOutcome: "stood_whole_trip",
    });
    expect(withoutAnswer).not.toHaveProperty("vsExpected");
  });

  it("should include the optional predictedStandingMin only when provided", () => {
    const payload = buildFeedbackPayload(
      context,
      { seatedOutcome: "seated_from_start" },
      undefined,
      6,
    );
    expect(payload).toMatchObject({ predictedStandingMin: 6 });
  });

  it("should never include identifier or location fields beyond the schema's own shape", () => {
    const payload = buildFeedbackPayload(context, {
      seatedOutcome: "seated_from_start",
    });
    expect(Object.keys(payload).sort()).toEqual(
      ["boardedAt", "legKey", "railwayId", "seatedOutcome", "tripId"].sort(),
    );
  });
});
