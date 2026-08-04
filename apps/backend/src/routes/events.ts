import { $, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  postEventsRequestSchema,
  postEventsResponseSchema,
} from "shared";
import { ipRateLimit } from "../middleware/rate-limit";

const postEventsRoute = createRoute({
  method: "post",
  path: "/v1/events",
  tags: ["events"],
  operationId: "postEvents",
  summary: "分析イベントのバッチ送信（最大 20 件）",
  request: {
    body: {
      content: { "application/json": { schema: postEventsRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: postEventsResponseSchema } },
      description: "受理したイベント件数",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "不正なペイロード",
    },
    413: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "20 件超のバッチ",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "サーバエラー",
    },
    501: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "未実装（task 3.5 で実装予定）",
    },
  },
});

export const eventsRoute = $(
  new OpenAPIHono<{ Bindings: CloudflareBindings }>().use(
    "/v1/events",
    ipRateLimit("events"),
  ),
).openapi(postEventsRoute, (c) => {
  return c.json({ error: { code: "unknown" } } as const, 501);
});
