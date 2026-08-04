import type { MiddlewareHandler } from "hono";
import type { errorResponseSchema } from "shared";
import type { z } from "zod";

type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * IP-based rate limit for write endpoints prone to abuse
 * (design.md line 602: `/v1/events`・`/v1/feedback`).
 * `routeName` keeps each route's quota independent under the shared
 * `API_RATE_LIMITER` binding (one Workers Rate Limiting namespace, keyed
 * per route+IP rather than one binding per route).
 */
export function ipRateLimit(
  routeName: string,
): MiddlewareHandler<{ Bindings: CloudflareBindings }> {
  return async (c, next) => {
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    const { success } = await c.env.API_RATE_LIMITER.limit({
      key: `${routeName}:${ip}`,
    });
    if (!success) {
      const body: ErrorResponse = { error: { code: "validation_error" } };
      return c.json(body, 429);
    }
    await next();
  };
}
