import { describe, expect, it } from "vitest";
import {
  congestionDatasetPayloadSchema,
  correctionDatasetPayloadSchema,
  createDatasetResponseSchema,
  timetableDatasetPayloadSchema,
} from "../../src/schemas/dataset.schema";

describe("timetableDatasetPayloadSchema", () => {
  const validPayload = {
    schemaVersion: 1,
    stations: [
      {
        id: "STA_SHINJUKU",
        railwayId: "RAIL_CHUO",
        nameJa: "新宿",
        nameEn: "Shinjuku",
        seq: 3,
      },
    ],
    trainTimetables: [
      {
        trainId: "TRAIN_0732",
        stationId: "STA_SHINJUKU",
        departureTime: "07:32",
        arrivalTime: "07:31",
        carCount: 10,
        dayType: "weekday",
      },
    ],
  };

  it("should accept a representative timetable payload", () => {
    expect(timetableDatasetPayloadSchema.safeParse(validPayload).success).toBe(
      true,
    );
  });

  it("should reject an unknown top-level field", () => {
    const result = timetableDatasetPayloadSchema.safeParse({
      ...validPayload,
      extra: "field",
    });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid dayType value", () => {
    const invalid = {
      ...validPayload,
      trainTimetables: [
        { ...validPayload.trainTimetables[0], dayType: "holiday" },
      ],
    };
    expect(timetableDatasetPayloadSchema.safeParse(invalid).success).toBe(
      false,
    );
  });
});

describe("congestionDatasetPayloadSchema", () => {
  const validPayload = {
    schemaVersion: 1,
    profiles: [
      {
        railwayId: "RAIL_CHUO",
        legKey: "STA_SHINJUKU-STA_TOKYO",
        timeBucket: "07:30",
        dayType: "weekday",
        carNumber: 3,
        loadScore: 0.62,
        sampleSize: 48,
      },
    ],
  };

  it("should accept a representative congestion payload", () => {
    expect(congestionDatasetPayloadSchema.safeParse(validPayload).success).toBe(
      true,
    );
  });

  it("should reject a time bucket not aligned to 15 minutes", () => {
    const invalid = {
      ...validPayload,
      profiles: [{ ...validPayload.profiles[0], timeBucket: "07:31" }],
    };
    expect(congestionDatasetPayloadSchema.safeParse(invalid).success).toBe(
      false,
    );
  });

  it("should reject a loadScore outside the 0..1 range", () => {
    const invalid = {
      ...validPayload,
      profiles: [{ ...validPayload.profiles[0], loadScore: 1.5 }],
    };
    expect(congestionDatasetPayloadSchema.safeParse(invalid).success).toBe(
      false,
    );
  });
});

describe("correctionDatasetPayloadSchema", () => {
  const validPayload = {
    schemaVersion: 1,
    stats: [
      {
        railwayId: "RAIL_CHUO",
        legKey: "STA_SHINJUKU-STA_TOKYO",
        timeBucket: "07:30",
        dayType: "weekday",
        deltaScore: -0.05,
        sampleSize: 12,
      },
    ],
  };

  it("should accept a representative correction stats payload", () => {
    expect(correctionDatasetPayloadSchema.safeParse(validPayload).success).toBe(
      true,
    );
  });

  it("should reject an unknown field inside a stats entry", () => {
    const invalid = {
      ...validPayload,
      stats: [{ ...validPayload.stats[0], userId: "should-not-exist" }],
    };
    expect(correctionDatasetPayloadSchema.safeParse(invalid).success).toBe(
      false,
    );
  });
});

describe("createDatasetResponseSchema", () => {
  const responseSchema = createDatasetResponseSchema(
    correctionDatasetPayloadSchema,
  );

  it("should accept a notModified response", () => {
    expect(
      responseSchema.safeParse({ version: "4", notModified: true }).success,
    ).toBe(true);
  });

  it("should accept a response carrying a payload", () => {
    expect(
      responseSchema.safeParse({
        version: "5",
        payload: { schemaVersion: 1, stats: [] },
      }).success,
    ).toBe(true);
  });

  it("should reject a response with neither notModified nor payload", () => {
    expect(responseSchema.safeParse({ version: "5" }).success).toBe(false);
  });
});
