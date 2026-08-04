import { OpenAPIHono } from "@hono/zod-openapi";
import { apiKeyAuth } from "./middleware/api-key";
import { datasetsRoute } from "./routes/datasets";
import { eventsRoute } from "./routes/events";
import { feedbackRoute } from "./routes/feedback";
import { pushRegistrationsRoute } from "./routes/push-registrations";
import { trainStatusRoute } from "./routes/train-status";

// Honoインスタンスを生成
const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

// x-api-key applies to all /v1/* routes (design.md line 504/507); /doc stays
// open so Postman/tools can import the spec without a key.
app.use("/v1/*", apiKeyAuth);

app.route("/", datasetsRoute);
app.route("/", trainStatusRoute);
app.route("/", feedbackRoute);
app.route("/", eventsRoute);
app.route("/", pushRegistrationsRoute);

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    title: "SeatSignal API",
    version: "0.1.0",
  },
  servers: [
    { url: "http://localhost:8787", description: "wrangler dev" },
    { url: "https://seatsignal-backend.workers.dev", description: "本番" },
  ],
});

export default app;
