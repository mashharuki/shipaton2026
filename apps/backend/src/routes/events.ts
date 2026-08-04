import { $, createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  isErr,
  postEventsRequestSchema,
  postEventsResponseSchema,
} from "shared";
import { insertAnalyticsEvent } from "../db/queries";
import { ipRateLimit } from "../middleware/rate-limit";

const MAX_EVENTS_PER_BATCH = 20;

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
  },
});

export const eventsRoute = $(
  new OpenAPIHono<{ Bindings: CloudflareBindings }>().use(
    "/v1/events",
    ipRateLimit("events"),
  ),
).openapi(postEventsRoute, async (c) => {
  const { events } = c.req.valid("json");

  if (events.length > MAX_EVENTS_PER_BATCH) {
    return c.json({ error: { code: "validation_error" } } as const, 413);
  }

  for (const event of events) {
    const result = await insertAnalyticsEvent(c.env.DB, {
      id: crypto.randomUUID(),
      name: event.name,
      propsJson: JSON.stringify(event.props),
      sessionId: event.sessionId,
      createdAt: event.occurredAt,
    });
    if (isErr(result)) {
      return c.json({ error: { code: "unknown" } } as const, 500);
    }
  }

  return c.json({ accepted: events.length }, 200);
});
