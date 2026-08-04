import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  getDatasetParamsSchema,
  getDatasetQuerySchema,
  getDatasetResponseSchema,
} from "shared";

const getDatasetRoute = createRoute({
  method: "get",
  path: "/v1/datasets/{name}",
  tags: ["datasets"],
  operationId: "getDataset",
  summary: "バージョン付きデータセットの取得",
  request: {
    params: getDatasetParamsSchema,
    query: getDatasetQuerySchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: getDatasetResponseSchema } },
      description: "版一致時は notModified、更新時は payload を返す",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "不正なリクエスト",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "対象データセットが存在しない",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "サーバエラー",
    },
    501: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "未実装（task 3.1 で実装予定）",
    },
  },
});

export const datasetsRoute = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>().openapi(getDatasetRoute, (c) => {
  return c.json({ error: { code: "unknown" } } as const, 501);
});
