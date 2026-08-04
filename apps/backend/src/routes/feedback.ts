import { $, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  feedbackPayloadSchema,
  isErr,
  okResponseSchema,
  toDayType,
} from "shared";
import { insertFeedback } from "../db/queries";
import { ipRateLimit } from "../middleware/rate-limit";

const postFeedbackRoute = createRoute({
  method: "post",
  path: "/v1/feedback",
  tags: ["feedback"],
  operationId: "postFeedback",
  summary: "乗車結果フィードバックの送信",
  request: {
    body: {
      content: { "application/json": { schema: feedbackPayloadSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: okResponseSchema } },
      description: "受理",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "不正なペイロード",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "サーバエラー",
    },
  },
});

export const feedbackRoute = $(
  new OpenAPIHono<{ Bindings: CloudflareBindings }>().use(
    "/v1/feedback",
    ipRateLimit("feedback"),
  ),
).openapi(postFeedbackRoute, async (c) => {
  const payload = c.req.valid("json");
  // 乗車中のみ有効な匿名 Trip ID・時間帯バケットのみを保存する (16.2, 16.4) --
  // the payload schema structurally has no identifier/location fields to
  // strip; day_type is derived server-side since the client never sends it.
  const now = new Date();

  const result = await insertFeedback(c.env.DB, {
    id: crypto.randomUUID(),
    tripId: payload.tripId,
    railwayId: payload.railwayId,
    legKey: payload.legKey,
    timeBucket: payload.boardedAt,
    dayType: toDayType(now),
    seatedOutcome: payload.seatedOutcome,
    seatedStationId:
      payload.seatedOutcome === "seated_from_middle"
        ? payload.seatedStationId
        : null,
    vsExpected: payload.vsExpected ?? null,
    predictedStandingMin: payload.predictedStandingMin ?? null,
    createdAt: now.toISOString(),
  });

  if (isErr(result)) {
    return c.json({ error: { code: "unknown" } } as const, 500);
  }
  return c.json({ ok: true } as const, 200);
});
