# Backend — apps/backend (Cloudflare Workers / Hono)

Entry `src/index.ts` is the single assembly point: `OpenAPIHono` instance, `hono/cors` (wildcard
origin — accountless API gated by `x-api-key`, nothing session-based to leak) mounted before
`apiKeyAuth` middleware (so CORS preflight OPTIONS isn't rejected by the key check), route mounting
(`app.route("/", xRoute)` per module), and OpenAPI document metadata (`openApiConfig` export,
reused by `scripts/generate-openapi.ts`). Convention: individual route/feature tasks own only their
own `routes/`/`services/`/`cron/` module, not `index.ts` — treat edits to it as cross-cutting.

## Structure
- `routes/` — one module per resource: `datasets.ts`, `train-status.ts`, `feedback.ts`,
  `events.ts`, `push-registrations.ts`. Validate via `shared`'s zod schemas, not local shapes.
- `services/` — business logic routes/cron call into: `prediction.ts` (wraps `shared`'s
  `scorePrediction`), `odpt-client.ts` (ODPT transit API — see gotcha below), `feedback-aggregator.ts`,
  `push-sender.ts` (Expo Push).
- `db/queries.ts` — the only place raw D1 SQL lives; parameterized, typed, returns `Result`.
  `db/migrations/NNNN_name.sql` — also wired as `d1_databases[].migrations_dir` in
  `wrangler.jsonc` (used by both `vitest-pool-workers`' `applyD1Migrations` and
  `wrangler d1 migrations apply --local`).
- `cron/` — `aggregate-feedback.ts` (daily), `notify-commuters.ts` (5-min) — written as
  directly-callable, directly-tested functions (`runAggregateFeedback(db, now)`,
  `runNotifyCommuters(db, kv, now)`).
- `middleware/` — `api-key.ts`, `rate-limit.ts`.
- `scripts/` — `generate-datasets.ts`, `push-datasets-to-kv.ts`, `generate-openapi.ts` (run via
  `tsx`, see `mem:suggested_commands`).

## Bindings (`wrangler.jsonc`)
- D1 `DB` (`seatsignal-db`), KV `STATUS_CACHE` (shared by ODPT status cache *and* dataset
  payloads — key-prefix differentiated: `dataset:{name}` holds `{version, payload}` JSON;
  `train-status:fresh:{id}` 60s-TTL cache-hit key + `train-status:last:{id}` no-TTL
  last-known-good fallback for the ODPT proxy), a `ratelimits` binding (IP-based, 30/60s on
  `/v1/feedback`, `/v1/events`), and two Cron Triggers (daily `0 18 * * *` UTC = 03:00 JST,
  `*/5 * * * *`). D1/KV IDs are placeholder zero-UUIDs — real deploy needs
  `wrangler d1 create`/`wrangler kv namespace create` first (not run — creates live Cloudflare
  resources). `nodejs_compat` compat flag is NOT enabled — no Node built-ins available.

## Cron dispatch
`index.ts`'s default export is `Object.assign(app, { scheduled })`: the same `OpenAPIHono`
instance used for OpenAPI generation also dispatches the configured expressions. It passes
`new Date(event.scheduledTime)` into `runAggregateFeedback` / `runNotifyCommuters`, logs Result
errors without throwing, and logs unknown cron expressions. Test with direct
`worker.scheduled(createScheduledController(...), env, createExecutionContext())`, then
`waitOnExecutionContext`; calling it through `SELF` causes a `DataCloneError`.

## Testing
`test/` mirrors `src/` (`test/routes/`, `test/services/`, `test/cron/`, `test/db/`). Uses
`@cloudflare/vitest-pool-workers` — integration tests hit real D1/KV via `SELF.fetch`/
`applyD1Migrations`, not mocks. Gotchas:
- KV state is **not** isolated per `it()` — clear keys you depend on in `beforeEach`.
- To mock `fetch` inside a Workers test, build the `Response` *inside*
  `vi.spyOn(globalThis, "fetch").mockImplementation(async () => ...)` — a `Response` pre-built
  outside and handed to `mockResolvedValue` belongs to the wrong IoContext and throws on body read.

## Domain quirks worth knowing before touching prediction/feedback code
- `feedback-aggregator.ts`: no numeric "actual standing minutes" exists in feedback payloads
  (only categorical `seatedOutcome`/`vsExpected`) — `vsExpected` is mapped to `-0.1/0/+0.1` and
  used as the sole signal for both `correction_stats.delta_score` and `metrics.mae_standing_min`;
  the latter is really "avg magnitude of reported crowding-perception deviation," not a literal
  measured error. `correction_stats` is fully cleared and rebuilt each run (true 全量再計算), not
  upserted, so cells that drop below the n≥5 threshold don't leave stale rows.
- `odpt-client.ts`: `ODPT_RAILWAY_IDS` map is single-line-MVP scoped (currently just `RAIL_CHUO`);
  unmapped `railwayId` short-circuits to 404 without calling ODPT. Status text is pattern-matched
  from Japanese ODPT fields (平常/見合わせ/運休), never validated against a live ODPT response —
  revisit before production traffic.
- `notify-commuters.ts`: "should notify" is driven entirely by `correction_stats.deltaScore > 0`
  (the only real vs.-normal signal available) — no weather/event dataset exists, so reason text is
  feedback-based copy (`REASON_COPY`), not literally weather/event-derived despite what
  requirements.md's prose implies.
- Ingest tooling is intentionally offline-testable: `scripts/ingest-toei-gtfs.ts` combines
  fail-closed Transitland license filtering, Feed Archive download, and GTFS-JP parsing into a
  `gtfs_import` dataset with attribution. `scripts/ingest/tfnsw-client.ts` decodes GTFS-RT
  occupancy into shared `OccupancyObservation`s. Neither live provider has been validated here;
  credentials/network access and human review are still required before using either feed.
