import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  getTrainStatusParamsSchema,
  trainStatusResponseSchema,
} from "shared";

const getTrainStatusRoute = createRoute({
  method: "get",
  path: "/v1/train-status/{railwayId}",
  tags: ["status"],
  operationId: "getTrainStatus",
  summary: "運行情報の取得（ODPT プロキシ + KV キャッシュ）",
  request: {
    params: getTrainStatusParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: trainStatusResponseSchema },
      },
      description:
        "運行情報。ODPT 障害時はキャッシュ済み値を stale: true で返す",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "対象路線が存在しない",
    },
    502: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "ODPT 障害かつキャッシュなし",
    },
    501: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "未実装（task 3.2 で実装予定）",
    },
  },
});

export const trainStatusRoute = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>().openapi(getTrainStatusRoute, (c) => {
  return c.json({ error: { code: "unknown" } } as const, 501);
});
