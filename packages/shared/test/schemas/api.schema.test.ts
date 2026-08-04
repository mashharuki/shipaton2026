import { describe, expect, it } from "vitest";
import {
  errorResponseSchema,
  feedbackPayloadSchema,
  getDatasetParamsSchema,
  getTrainStatusParamsSchema,
  okResponseSchema,
  pushRegistrationRequestSchema,
  trainStatusResponseSchema,
} from "../../src/schemas/api.schema";

describe("errorResponseSchema", () => {
  it("should accept a known error code", () => {
    expect(
      errorResponseSchema.safeParse({ error: { code: "offline" } }).success,
    ).toBe(true);
  });

  it("should reject an unknown error code", () => {
    expect(
      errorResponseSchema.safeParse({ error: { code: "not_a_code" } }).success,
    ).toBe(false);
  });
});

describe("okResponseSchema", () => {
  it("should accept the literal ok response", () => {
    expect(okResponseSchema.safeParse({ ok: true }).success).toBe(true);
  });

  it("should reject ok: false", () => {
    expect(okResponseSchema.safeParse({ ok: false }).success).toBe(false);
  });
});

describe("getDatasetParamsSchema", () => {
  it("should accept a known dataset name", () => {
    expect(
      getDatasetParamsSchema.safeParse({ name: "congestion" }).success,
    ).toBe(true);
  });

  it("should reject an unknown dataset name", () => {
    expect(getDatasetParamsSchema.safeParse({ name: "weather" }).success).toBe(
      false,
    );
  });
});

describe("getTrainStatusParamsSchema", () => {
  it("should reject a payload carrying unrelated fields such as coordinates", () => {
    const result = getTrainStatusParamsSchema.safeParse({
      railwayId: "RAIL_CHUO",
      lat: 35.6,
      lng: 139.7,
    });
    expect(result.success).toBe(false);
  });
});

describe("trainStatusResponseSchema", () => {
  it("should accept a representative response", () => {
    const result = trainStatusResponseSchema.safeParse({
      status: "delayed",
      delayMinutes: 5,
      fetchedAt: "2026-08-04T07:00:00.000Z",
      stale: false,
    });
    expect(result.success).toBe(true);
  });

  it("should reject a negative delayMinutes value", () => {
    const result = trainStatusResponseSchema.safeParse({
      status: "delayed",
      delayMinutes: -1,
      fetchedAt: "2026-08-04T07:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("feedbackPayloadSchema", () => {
  const base = {
    tripId: "6f9a2b3e-4b7a-4a4b-8b2b-9b6b1e2e3f4a",
    railwayId: "RAIL_CHUO",
    legKey: "STA_SHINJUKU-STA_TOKYO",
    boardedAt: "07:30",
  };

  it("should accept a seated_from_start payload without a seated station", () => {
    const result = feedbackPayloadSchema.safeParse({
      ...base,
      seatedOutcome: "seated_from_start",
    });
    expect(result.success).toBe(true);
  });

  it("should accept a seated_from_middle payload with a seated station", () => {
    const result = feedbackPayloadSchema.safeParse({
      ...base,
      seatedOutcome: "seated_from_middle",
      seatedStationId: "STA_YOTSUYA",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a seated_from_middle payload missing the seated station", () => {
    const result = feedbackPayloadSchema.safeParse({
      ...base,
      seatedOutcome: "seated_from_middle",
    });
    expect(result.success).toBe(false);
  });

  it("should reject a payload carrying a location field", () => {
    const result = feedbackPayloadSchema.safeParse({
      ...base,
      seatedOutcome: "seated_from_start",
      lat: 35.6,
      lng: 139.7,
    });
    expect(result.success).toBe(false);
  });

  it("should reject an exact clock time in place of a 15-minute bucket", () => {
    const result = feedbackPayloadSchema.safeParse({
      ...base,
      seatedOutcome: "seated_from_start",
      boardedAt: "07:32",
    });
    expect(result.success).toBe(false);
  });
});

describe("pushRegistrationRequestSchema", () => {
  const validPayload = {
    expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    fromStationId: "STA_SHINJUKU",
    toStationId: "STA_TOKYO",
    weekdays: ["mon", "tue", "wed", "thu", "fri"],
    notifyAt: "07:45",
    leadMinutes: 20,
    locale: "ja",
  };

  it("should accept a representative registration", () => {
    expect(pushRegistrationRequestSchema.safeParse(validPayload).success).toBe(
      true,
    );
  });

  it("should reject a leadMinutes value outside the 15..30 window", () => {
    const result = pushRegistrationRequestSchema.safeParse({
      ...validPayload,
      leadMinutes: 60,
    });
    expect(result.success).toBe(false);
  });

  it("should reject an empty weekdays array", () => {
    const result = pushRegistrationRequestSchema.safeParse({
      ...validPayload,
      weekdays: [],
    });
    expect(result.success).toBe(false);
  });

  it("should reject an unsupported locale", () => {
    const result = pushRegistrationRequestSchema.safeParse({
      ...validPayload,
      locale: "fr",
    });
    expect(result.success).toBe(false);
  });
});
