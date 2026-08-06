import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
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

export default app;
