import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  getDatasetParamsSchema,
  getDatasetQuerySchema,
  getDatasetResponseSchema,
} from "shared";
import type { z } from "zod";

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
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "APIキーが不正または未提供",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "対象データセットが存在しない",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "サーバエラー",
    },
  },
});

type DatasetResponse = z.infer<typeof getDatasetResponseSchema>;

// KV storage shape written by scripts/push-datasets-to-kv.ts under
// `dataset:{name}` (task 2.3 Implementation Notes) — verbatim
// `{version, payload}`, so this route reads it back almost as-is.
type StoredDataset = { version: string; payload: unknown };

export const datasetsRoute = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>().openapi(getDatasetRoute, async (c) => {
  const { name } = c.req.valid("param");
  const { since } = c.req.valid("query");

  try {
    const raw = await c.env.STATUS_CACHE.get(`dataset:${name}`);
    if (raw === null) {
      return c.json({ error: { code: "http_error" } } as const, 404);
    }

    const stored = JSON.parse(raw) as StoredDataset;
    if (since !== undefined && since === stored.version) {
      return c.json(
        { version: stored.version, notModified: true } as DatasetResponse,
        200,
      );
    }
    return c.json(
      {
        version: stored.version,
        payload: stored.payload,
      } as DatasetResponse,
      200,
    );
  } catch {
    return c.json({ error: { code: "unknown" } } as const, 500);
  }
});
