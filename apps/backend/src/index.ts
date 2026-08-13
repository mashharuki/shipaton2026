import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { isErr } from "shared";
import { runAggregateFeedback } from "./cron/aggregate-feedback";
import { runNotifyCommuters } from "./cron/notify-commuters";
import { apiKeyAuth } from "./middleware/api-key";
import { datasetsRoute } from "./routes/datasets";
import { eventsRoute } from "./routes/events";
import { feedbackRoute } from "./routes/feedback";
import { pushRegistrationsRoute } from "./routes/push-registrations";
import { trainStatusRoute } from "./routes/train-status";

// Honoインスタンスを生成
const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

// 4.6: the Expo web target (Playwright E2E, and eventually the real app on
// web) calls this API cross-origin. No cookies/sessions exist anywhere in
// this design (accountless, x-api-key-gated per security.md) -- there is
// nothing a wildcard origin could leak that the API key doesn't already
// gate, so this stays permissive rather than hardcoding a single dev origin
// that would break in every other environment. Registered before
// apiKeyAuth so its preflight (OPTIONS) short-circuit responses are never
// rejected by the key check.
app.use(
  "/v1/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE"],
    allowHeaders: ["Content-Type", "x-api-key"],
  }),
);

// x-api-key applies to all /v1/* routes (design.md line 504/507); /doc stays
// open so Postman/tools can import the spec without a key.
app.use("/v1/*", apiKeyAuth);

app.route("/", datasetsRoute);
app.route("/", trainStatusRoute);
app.route("/", feedbackRoute);
app.route("/", eventsRoute);
app.route("/", pushRegistrationsRoute);

// design.md: "components.securitySchemes に apiKey（header x-api-key）を
// 定義し全ルートへ適用" -- registered once on the assembled app (not
// per-route) and applied via openApiConfig's top-level `security`, which
// OpenAPI treats as the default requirement for every operation that
// doesn't declare its own `security` (none of our routes do).
app.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "x-api-key",
});

// Single source of truth for the document's top-level metadata -- reused
// verbatim by scripts/generate-openapi.ts (task 3.8) so the committed
// openapi.yaml and this dev-server /doc endpoint can never drift apart.
export const openApiConfig = {
  openapi: "3.0.0",
  info: {
    title: "SeatSignal API",
    version: "0.1.0",
  },
  servers: [
    { url: "http://localhost:8787", description: "wrangler dev" },
    { url: "https://seatsignal-backend.workers.dev", description: "本番" },
  ],
  security: [{ ApiKeyAuth: [] }],
};

app.doc("/doc", openApiConfig);

// 2.2 Implementation Notes (unresolved-gap resolution): wrangler.jsonc's
// `triggers.crons` declares two schedules with no handler to dispatch them.
// Routed here by exact cron-expression match rather than a second export,
// so this stays the single place that owns cron wiring -- 3.4's
// aggregate-feedback and 3.7's notify-commuters keep owning their own batch
// logic (independently unit-tested against real D1/KV), this function only
// routes + logs. Errors are swallowed (not thrown) because there is no
// caller to receive them once Workers invokes `scheduled` -- a thrown error
// only shows up as a retry, so surfacing failure via `console.error` (code
// only, matching security.md's "never log secrets" convention already used
// by dataset-repository.ts) is the only observable signal available.
async function scheduled(
  event: ScheduledController,
  // Narrower than the full CloudflareBindings (which also carries secrets
  // like ODPT_TOKEN via env.d.ts's global augmentation) -- this handler
  // only ever touches D1/KV, and cloudflare:test's `env` export doesn't
  // statically know about secrets loaded from `.dev.vars`, so a Pick here
  // keeps test/scheduled.test.ts able to pass its `env` without a mismatch.
  env: Pick<CloudflareBindings, "DB" | "STATUS_CACHE">,
  _ctx: ExecutionContext,
): Promise<void> {
  // Both batches take `now` explicitly (never read the wall clock
  // internally) for the same determinism reason as the rest of this
  // codebase (e.g. route-search-engine.ts) -- `scheduledTime` is what
  // Workers guarantees is stable across retries of the same invocation.
  const now = new Date(event.scheduledTime);
  switch (event.cron) {
    case "0 18 * * *": {
      const result = await runAggregateFeedback(env.DB, now);
      if (isErr(result)) {
        console.error("aggregate-feedback cron failed:", result.error.code);
      }
      return;
    }
    case "*/5 * * * *": {
      const result = await runNotifyCommuters(env.DB, env.STATUS_CACHE, now);
      if (isErr(result)) {
        console.error("notify-commuters cron failed:", result.error.code);
      }
      return;
    }
    default:
      console.error(`scheduled: no handler for cron "${event.cron}"`);
  }
}

// Attaches `scheduled` onto the same `app` instance (not a wrapper object)
// so this stays a valid Workers module default export (needs `.fetch` +
// `.scheduled`) while remaining the exact OpenAPIHono instance that
// scripts/generate-openapi.ts and test/openapi-drift.test.ts import and
// call `.getOpenAPIDocument()` on.
export default Object.assign(app, { scheduled });
