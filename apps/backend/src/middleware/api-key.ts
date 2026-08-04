import type { MiddlewareHandler } from "hono";
import type { errorResponseSchema } from "shared";
import type { z } from "zod";

type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * MVP auth per design.md line 507: App-shared key via the `x-api-key`
 * header, no per-user identity (accountless design).
 */
export const apiKeyAuth: MiddlewareHandler<{
  Bindings: CloudflareBindings;
}> = async (c, next) => {
  // MVP auth per design.md line 507: App-shared key via the `x-api-key`
  const provided = c.req.header("x-api-key");
  // APIキーが提供されていない、または正しくない場合は、401 Unauthorizedを返す
  if (!provided || provided !== c.env.API_SHARED_KEY) {
    const body: ErrorResponse = { error: { code: "validation_error" } };
    return c.json(body, 401);
  }
  await next();
};
