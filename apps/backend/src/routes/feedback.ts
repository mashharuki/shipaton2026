import { $, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  feedbackPayloadSchema,
  okResponseSchema,
} from "shared";
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
    501: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "未実装（task 3.3 で実装予定）",
    },
  },
});

export const feedbackRoute = $(
  new OpenAPIHono<{ Bindings: CloudflareBindings }>().use(
    "/v1/feedback",
    ipRateLimit("feedback"),
  ),
).openapi(postFeedbackRoute, (c) => {
  return c.json({ error: { code: "unknown" } } as const, 501);
});
