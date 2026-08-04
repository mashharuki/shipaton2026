import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  okResponseSchema,
  pushRegistrationParamsSchema,
  pushRegistrationRequestSchema,
} from "shared";

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
    501: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "未実装（task 3.6 で実装予定）",
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
    501: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "未実装（task 3.6 で実装予定）",
    },
  },
});

export const pushRegistrationsRoute = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>()
  .openapi(putPushRegistrationRoute, (c) => {
    return c.json({ error: { code: "unknown" } } as const, 501);
  })
  .openapi(deletePushRegistrationRoute, (c) => {
    return c.json({ error: { code: "unknown" } } as const, 501);
  });
