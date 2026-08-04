import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  errorResponseSchema,
  getTrainStatusParamsSchema,
  trainStatusResponseSchema,
} from "shared";
import { fetchTrainInformation } from "../services/odpt-client";

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
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "サーバエラー",
    },
    502: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "ODPT 障害かつキャッシュなし",
    },
  },
});

type StoredStatus = {
  status: "normal" | "delayed" | "suspended";
  delayMinutes: number;
  fetchedAt: string;
};

const freshKey = (railwayId: string) => `train-status:fresh:${railwayId}`;
// Retained beyond the 60s freshness window (no TTL) so ODPT outages can
// still fall back to the last known value with `stale: true`.
const lastKey = (railwayId: string) => `train-status:last:${railwayId}`;

export const trainStatusRoute = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>().openapi(getTrainStatusRoute, async (c) => {
  const { railwayId } = c.req.valid("param");

  try {
    const cached = await c.env.STATUS_CACHE.get(freshKey(railwayId));
    if (cached !== null) {
      return c.json(JSON.parse(cached) as StoredStatus, 200);
    }

    const result = await fetchTrainInformation(c.env, railwayId);

    if (result.ok) {
      const value: StoredStatus = {
        status: result.data.status,
        delayMinutes: result.data.delayMinutes,
        fetchedAt: new Date().toISOString(),
      };
      await c.env.STATUS_CACHE.put(freshKey(railwayId), JSON.stringify(value), {
        expirationTtl: 60,
      });
      await c.env.STATUS_CACHE.put(lastKey(railwayId), JSON.stringify(value));
      return c.json(value, 200);
    }

    if (result.reason === "not_found") {
      return c.json({ error: { code: "http_error" } } as const, 404);
    }

    const last = await c.env.STATUS_CACHE.get(lastKey(railwayId));
    if (last !== null) {
      const value = JSON.parse(last) as StoredStatus;
      return c.json({ ...value, stale: true }, 200);
    }

    return c.json({ error: { code: "http_error" } } as const, 502);
  } catch {
    return c.json({ error: { code: "unknown" } } as const, 500);
  }
});
