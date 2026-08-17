import { z } from "zod";

export const DAY_TYPES = ["weekday", "weekend"] as const;
export const dayTypeSchema = z.enum(DAY_TYPES).meta({
  description: "曜日種別",
  example: "weekday",
});

export const clockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .meta({ description: "時刻（HH:mm）", example: "07:32" });

export const timeBucketSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/)
  .meta({
    description: "15 分粒度の時間帯バケット（HH:mm）",
    example: "07:30",
  });

export const DATASET_NAMES = ["timetable", "congestion", "correction"] as const;
export const datasetNameSchema = z.enum(DATASET_NAMES).meta({
  description: "データセット種別",
  example: "timetable",
});

export const stationSchema = z
  .strictObject({
    id: z.string().min(1),
    railwayId: z.string().min(1),
    nameJa: z.string().min(1),
    nameEn: z.string().min(1),
    seq: z.number().int().nonnegative(),
  })
  .meta({
    description: "駅",
    example: {
      id: "STA_SHINJUKU",
      railwayId: "RAIL_CHUO",
      nameJa: "新宿",
      nameEn: "Shinjuku",
      seq: 3,
    },
  });

export const stopTimeSchema = z
  .strictObject({
    stopId: z.string().min(1),
    stopSequence: z.number().int().nonnegative(),
    arrivalTime: clockTimeSchema,
    departureTime: clockTimeSchema,
  })
  .meta({
    description: "便の停車駅ごとの発着時刻と停車順（GTFS stop_times.txt 相当）",
    example: {
      stopId: "STA_SHINJUKU",
      stopSequence: 0,
      arrivalTime: "07:32",
      departureTime: "07:32",
    },
  });

export const tripSchema = z
  .strictObject({
    tripId: z.string().min(1),
    dayType: dayTypeSchema,
    carCount: z.number().int().positive(),
    stopTimes: z.array(stopTimeSchema).min(1),
  })
  .refine(
    (trip) => {
      const sequences = trip.stopTimes.map((stopTime) => stopTime.stopSequence);
      return new Set(sequences).size === sequences.length;
    },
    { message: "stopTimes 内の stopSequence は重複してはならない" },
  )
  .meta({
    description:
      "列車1便の停車駅列（GTFS trips.txt + stop_times.txt 相当）。各便が自身の停車順を持ち、路線全体の駅連番には依存しない",
    example: {
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
  });

export const timetableDatasetPayloadSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),
    stations: z.array(stationSchema),
    trips: z.array(tripSchema),
  })
  .meta({ description: "時刻表データセット" });

export const congestionProfileEntrySchema = z
  .strictObject({
    railwayId: z.string().min(1),
    legKey: z.string().min(1),
    timeBucket: timeBucketSchema,
    dayType: dayTypeSchema,
    carNumber: z.number().int().positive(),
    loadScore: z.number().min(0).max(1),
    sampleSize: z.number().int().nonnegative(),
  })
  .meta({
    description: "混雑プロファイル（号車単位）",
    example: {
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:30",
      dayType: "weekday",
      carNumber: 3,
      loadScore: 0.62,
      sampleSize: 48,
    },
  });

export const congestionDatasetPayloadSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),
    profiles: z.array(congestionProfileEntrySchema),
  })
  .meta({ description: "混雑プロファイルデータセット" });

export const correctionStatsEntrySchema = z
  .strictObject({
    railwayId: z.string().min(1),
    legKey: z.string().min(1),
    timeBucket: timeBucketSchema,
    dayType: dayTypeSchema,
    deltaScore: z.number(),
    sampleSize: z.number().int().nonnegative(),
  })
  .meta({
    description:
      "フィードバックに基づく補正統計（サンプル数不足のセルは配信しない）",
    example: {
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      timeBucket: "07:30",
      dayType: "weekday",
      deltaScore: -0.05,
      sampleSize: 12,
    },
  });

export const correctionDatasetPayloadSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),
    stats: z.array(correctionStatsEntrySchema),
  })
  .meta({ description: "補正統計データセット" });

export function createDatasetResponseSchema<T extends z.ZodType>(
  payloadSchema: T,
) {
  return z.union([
    z.strictObject({
      version: z.string().min(1),
      notModified: z.literal(true),
    }),
    z.strictObject({
      version: z.string().min(1),
      payload: payloadSchema,
    }),
  ]);
}
