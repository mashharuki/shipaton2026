import { describe, expect, it } from "vitest";
import {
  congestionDatasetPayloadSchema,
  correctionDatasetPayloadSchema,
  createDatasetResponseSchema,
  timetableDatasetPayloadSchema,
  tripSchema,
} from "../../src/schemas/dataset.schema";

describe("timetableDatasetPayloadSchema", () => {
  it("should accept a payload whose trips each carry their own stopTimes", () => {
    const payload = {
      schemaVersion: 1,
      stations: [
        {
          id: "STA_SHINJUKU",
          railwayId: "RAIL_CHUO",
          nameJa: "新宿",
          nameEn: "Shinjuku",
          seq: 0,
        },
        {
          id: "STA_TOKYO",
          railwayId: "RAIL_CHUO",
          nameJa: "東京",
          nameEn: "Tokyo",
          seq: 1,
        },
      ],
      trips: [
        {
          tripId: "TRAIN_0732",
          dayType: "weekday",
          carCount: 10,
          stopTimes: [
            {
              stopId: "STA_SHINJUKU",
              stopSequence: 0,
              arrivalTime: "07:32",
              departureTime: "07:32",
            },
            {
              stopId: "STA_TOKYO",
              stopSequence: 1,
              arrivalTime: "07:48",
              departureTime: "07:48",
            },
          ],
        },
      ],
    };

    expect(() => timetableDatasetPayloadSchema.parse(payload)).not.toThrow();
  });

  it("should reject a trip whose stopTimes have duplicate stopSequence values", () => {
    const trip = {
      tripId: "TRAIN_BAD",
      dayType: "weekday",
      carCount: 10,
      stopTimes: [
        {
          stopId: "STA_SHINJUKU",
          stopSequence: 0,
          arrivalTime: "07:32",
          departureTime: "07:32",
        },
        {
          stopId: "STA_TOKYO",
          stopSequence: 0,
          arrivalTime: "07:48",
          departureTime: "07:48",
        },
      ],
    };

    expect(() => tripSchema.parse(trip)).toThrow();
  });

  it("should reject a trip with no stopTimes", () => {
    const trip = {
      tripId: "TRAIN_EMPTY",
      dayType: "weekday",
      carCount: 10,
      stopTimes: [],
    };

    expect(() => tripSchema.parse(trip)).toThrow();
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
