# SeatSignal backend

Cloudflare Workers API (Hono + `@hono/zod-openapi`) for SeatSignal. See the repo root
`CLAUDE.md` / this directory's `CLAUDE.md` for architecture; this file is the local dev
quickstart.

## Routes

Five `/v1/*` routes are implemented (gated by `x-api-key`, see `src/middleware/api-key.ts`):

- `GET /v1/datasets/{name}` — dataset delivery (`timetable`/`congestion`/`correction`), reads
  from the `STATUS_CACHE` KV binding under `dataset:{name}` keys
- `GET /v1/train-status/{railwayId}` — ODPT delay/status proxy, KV-cached
- `POST /v1/feedback`, `POST /v1/events`, `PUT|DELETE /v1/push-registrations/{id}` — write to D1

**D1 and KV hold different things.** D1 (`src/db/migrations/0001_init_schema.sql`) only ever
holds user-generated rows: `feedback`, `correction_stats`, `metrics`, `analytics_events`,
`push_registrations`. Station/timetable/congestion data for the demo line (中央線, `RAIL_CHUO`)
lives **only in KV**, never in D1. There is no server-side route-search endpoint — route search
runs entirely on-device in the frontend (`RouteSearchEngine`, see `.kiro/specs/seat-signal/
design.md`); the backend's job here is limited to distributing the dataset the client searches
over.

## First-time local setup

```sh
cp .dev.vars.example .dev.vars   # then fill in API_SHARED_KEY (and ODPT_TOKEN if available)
pnpm --filter backend run setup:local   # runs db:migrate:local + push:datasets
pnpm --filter backend dev
```

**`wrangler dev` does not run migrations or seed KV automatically.** A fresh checkout (or a
`.wrangler/state` wipe) starts with an empty local D1 and empty KV — `GET /v1/datasets/*` will
404 and the frontend's dataset sync will silently fail until `setup:local` has been run once.

The `API_SHARED_KEY` you set in `.dev.vars` must match `EXPO_PUBLIC_API_SHARED_KEY` in
`apps/frontend/.env.local` exactly, or every `/v1/*` request 401s.

### Testing from a physical device

`pnpm --filter backend dev` runs `wrangler dev --ip 0.0.0.0` so the dev server listens on all
interfaces, not just loopback — required for a phone on the same Wi-Fi to reach it at all. Two
things still need to be set correctly, or dataset sync fails with an `offline` / "Network request
failed" error (indistinguishable in the UI from unseeded KV, but now logged distinctly by
`dataset-repository.ts`'s `syncOne`):

1. Mac and phone must be on the same Wi-Fi network (same constraint as Metro — see
   `apps/frontend/AGENTS.md`).
2. `EXPO_PUBLIC_API_BASE_URL` in `apps/frontend/.env.local` must be the Mac's current LAN IP, not
   `localhost` (e.g. `http://192.168.1.3:8787` — find it with `ipconfig getifaddr en0`). This
   changes whenever the Mac's IP changes (new network, DHCP lease renewal), so re-check it if sync
   that previously worked suddenly starts failing again.

## Commands

```sh
pnpm --filter backend dev              # wrangler dev — local dev server
pnpm --filter backend deploy           # wrangler deploy --minify
pnpm --filter backend cf-typegen       # regenerate CloudflareBindings types from wrangler.jsonc
pnpm --filter backend run typecheck
pnpm --filter backend test             # vitest
pnpm --filter backend run setup:local  # db:migrate:local + push:datasets, chained
pnpm --filter backend run generate:datasets  # regenerate fixtures/datasets/*.json (rarely needed — fixtures are committed)
pnpm --filter backend run push:datasets      # seed local KV from the committed fixtures
```

Pass the `CloudflareBindings` as generics when instantiating Hono:

```ts
// src/index.ts
const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>()
```
