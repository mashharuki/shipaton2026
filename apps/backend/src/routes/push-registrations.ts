import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  isErr,
  okResponseSchema,
  pushRegistrationParamsSchema,
  pushRegistrationRequestSchema,
} from "shared";
import { deletePushRegistration, upsertPushRegistration } from "../db/queries";

const putPushRegistrationRoute = createRoute({
  method: "put",
  path: "/v1/push-registrations/{id}",
  tags: ["push"],
  operationId: "putPushRegistration",
  summary: "通知登録の作成・更新",
  request: {
    params: pushRegistrationParamsSchema,
    body: {
      content: {
        "application/json": { schema: pushRegistrationRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: okResponseSchema } },
      description: "登録・更新成功",
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

const deletePushRegistrationRoute = createRoute({
  method: "delete",
  path: "/v1/push-registrations/{id}",
  tags: ["push"],
  operationId: "deletePushRegistration",
  summary: "通知登録の削除",
  request: {
    params: pushRegistrationParamsSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: okResponseSchema } },
      description: "削除成功",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "対象の登録が存在しない",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "サーバエラー",
    },
  },
});

export const pushRegistrationsRoute = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>()
  .openapi(putPushRegistrationRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const result = await upsertPushRegistration(c.env.DB, {
      id,
      expoPushToken: body.expoPushToken,
      fromStationId: body.fromStationId,
      toStationId: body.toStationId,
      weekdays: body.weekdays,
      notifyAt: body.notifyAt,
      leadMinutes: body.leadMinutes,
      locale: body.locale,
      lastSentDate: null,
    });
    if (isErr(result)) {
      return c.json({ error: { code: "unknown" } } as const, 500);
    }
    return c.json({ ok: true } as const, 200);
  })
  .openapi(deletePushRegistrationRoute, async (c) => {
    const { id } = c.req.valid("param");

    const result = await deletePushRegistration(c.env.DB, id);
    if (isErr(result)) {
      return c.json({ error: { code: "unknown" } } as const, 500);
    }
    if (result.data === 0) {
      return c.json({ error: { code: "http_error" } } as const, 404);
    }
    return c.json({ ok: true } as const, 200);
  });
