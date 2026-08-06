import { z } from "zod";
import { ERROR_CODES } from "../errors/error-codes";
import {
  congestionDatasetPayloadSchema,
  correctionDatasetPayloadSchema,
  createDatasetResponseSchema,
  datasetNameSchema,
  timeBucketSchema,
  timetableDatasetPayloadSchema,
} from "./dataset.schema";

export const errorResponseSchema = z
  .strictObject({
    error: z.strictObject({
      code: z.enum(ERROR_CODES),
    }),
  })
  .meta({
    id: "ErrorResponse",
    description: "共通エラーレスポンス",
    example: { error: { code: "validation_error" } },
  });

export const okResponseSchema = z.strictObject({ ok: z.literal(true) }).meta({
  id: "OkResponse",
  description: "処理成功を示す共通レスポンス",
  example: { ok: true },
});

export const getDatasetParamsSchema = z
  .strictObject({ name: datasetNameSchema })
  .meta({ description: "GET /v1/datasets/:name のパスパラメータ" });

export const getDatasetQuerySchema = z
  .strictObject({ since: z.string().min(1).optional() })
  .meta({
    description: "GET /v1/datasets/:name のクエリパラメータ",
    example: { since: "3" },
  });

export const getDatasetResponseSchema = z
  .union([
    createDatasetResponseSchema(timetableDatasetPayloadSchema),
    createDatasetResponseSchema(congestionDatasetPayloadSchema),
    createDatasetResponseSchema(correctionDatasetPayloadSchema),
  ])
  .meta({
    description:
      "データセット配信レスポンス（版一致時は notModified、更新時は payload を返す）",
    example: { version: "4", notModified: true },
  });

export const getTrainStatusParamsSchema = z
  .strictObject({
    railwayId: z.string().min(1).meta({ example: "RAIL_CHUO" }),
  })
  .meta({ description: "GET /v1/train-status/:railwayId のパスパラメータ" });

export const TRAIN_STATUSES = ["normal", "delayed", "suspended"] as const;

export const trainStatusResponseSchema = z
  .strictObject({
    status: z.enum(TRAIN_STATUSES),
    delayMinutes: z.number().int().nonnegative(),
    fetchedAt: z.iso.datetime(),
    stale: z.boolean().optional(),
  })
  .meta({
    description:
      "運行情報レスポンス（ODPT 障害時はキャッシュ済み値を stale: true で返す）",
    example: {
      status: "delayed",
      delayMinutes: 5,
      fetchedAt: "2026-08-04T07:00:00.000Z",
      stale: false,
    },
  });

export const SEATED_OUTCOMES = [
  "seated_from_start",
  "seated_from_middle",
  "stood_whole_trip",
] as const;
export const VS_EXPECTED_OUTCOMES = [
  "less_crowded_than_expected",
  "as_expected",
  "more_crowded_than_expected",
] as const;

const feedbackCommonShape = {
  tripId: z.uuid(),
  railwayId: z.string().min(1),
  legKey: z.string().min(1),
  boardedAt: timeBucketSchema,
  vsExpected: z.enum(VS_EXPECTED_OUTCOMES).optional(),
  predictedStandingMin: z.number().nonnegative().optional(),
};

export const feedbackPayloadSchema = z
  .discriminatedUnion("seatedOutcome", [
    z.strictObject({
      seatedOutcome: z.literal("seated_from_start"),
      ...feedbackCommonShape,
    }),
    z.strictObject({
      seatedOutcome: z.literal("seated_from_middle"),
      seatedStationId: z.string().min(1),
      ...feedbackCommonShape,
    }),
    z.strictObject({
      seatedOutcome: z.literal("stood_whole_trip"),
      ...feedbackCommonShape,
    }),
  ])
  .meta({
    description:
      "乗車結果フィードバック（乗車中のみ有効な匿名 Trip ID とのみ関連付ける）",
    example: {
      seatedOutcome: "seated_from_middle",
      seatedStationId: "STA_YOTSUYA",
      tripId: "6f9a2b3e-4b7a-4a4b-8b2b-9b6b1e2e3f4a",
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      boardedAt: "07:30",
      vsExpected: "as_expected",
      predictedStandingMin: 6,
    },
  });

export const pushRegistrationParamsSchema = z
  .strictObject({
    id: z.string().min(1).meta({ example: "push-reg-001" }),
  })
  .meta({
    description: "PUT/DELETE /v1/push-registrations/:id のパスパラメータ",
  });

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export const pushRegistrationRequestSchema = z
  .strictObject({
    expoPushToken: z.string().min(1),
    fromStationId: z.string().min(1),
    toStationId: z.string().min(1),
    weekdays: z.array(z.enum(WEEKDAYS)).min(1),
    notifyAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    leadMinutes: z.number().int().min(15).max(30),
    locale: z.enum(["ja", "en"]),
  })
  .meta({
    description: "通知登録の作成・更新",
    example: {
      expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
    },
  });
