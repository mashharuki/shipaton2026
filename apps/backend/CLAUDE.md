# CLAUDE.md

Guidance for Claude Code when working with code in this repository.

## What this is

A Cloudflare Workers backend built with [Hono](https://hono.dev) (`@hono/zod-openapi`) for
**SeatSignal** (see root `CLAUDE.md` and `.kiro/specs/seat-signal/`). This is **not** a fresh
scaffold — routing, D1, KV, and the datasets pipeline are all implemented; see `README.md` for
the route list and local setup. `.kiro/specs/seat-signal/tasks.md` phases 1–3 (shared package,
API skeleton, backend API/aggregation/notifications) are marked done.

**Route search is intentionally NOT a backend concern.** Per `.kiro/specs/seat-signal/design.md`
("端末内計算＋データセット配信"), `RouteSearchEngine` runs entirely on-device in
`apps/frontend/src/features/search/`. This backend's scope is limited to: dataset delivery
(`/v1/datasets/{name}`, reading pre-generated timetable/congestion/correction payloads from KV),
an ODPT status proxy, anonymous feedback/analytics collection, and push notification delivery. Do
not add a `/routes` or `/search` endpoint here without first checking `design.md` — that would
contradict an explicit, documented architectural decision (privacy/determinism/offline-resilience
guardrails), not fill a gap.

This package lives inside the `shipaton2026` pnpm monorepo (`apps/backend`, sibling to
`apps/frontend`, a React Native/Expo app, and `packages/shared`, a shared TS domain package).
Formatting/linting (Biome) and unused-code checks (knip) are configured at the monorepo root, not
here — run them from the repo root, not from `apps/backend`.

`shared` (workspace package, `"shared": "workspace:*"` dep) is the source of truth for contracts:
`packages/shared/src/schemas/api.schema.ts` and `dataset.schema.ts` define request/response
shapes, `packages/shared/src/errors/` provides `AppError`/`ErrorCode`, and
`packages/shared/src/result.ts` provides the `Result` type — reuse these rather than redefining
shapes locally.

## Local dev data pipeline — the thing that bites people

Route/station/timetable/congestion data for the demo line (中央線, `RAIL_CHUO`) lives **only in
KV** (`STATUS_CACHE` binding, `dataset:{name}` keys), never in D1. D1
(`src/db/migrations/0001_init_schema.sql`) only ever holds user-generated rows: `feedback`,
`correction_stats`, `metrics`, `analytics_events`, `push_registrations`.

**`wrangler dev` does not run D1 migrations or seed KV automatically.** A fresh checkout (or a
wiped `.wrangler/state`) starts with empty local D1 and empty KV, so `GET /v1/datasets/*` 404s
and the frontend's on-device dataset sync silently fails (see
`apps/frontend/src/features/dataset/dataset-repository.ts`'s `syncOne`, which logs but does not
surface sync failures in the UI). Run `pnpm --filter backend run setup:local` once per fresh
local state before `pnpm --filter backend dev` — see `README.md` for the full sequence. Also
confirm `.dev.vars`' `API_SHARED_KEY` matches `apps/frontend/.env.local`'s
`EXPO_PUBLIC_API_SHARED_KEY` exactly; a mismatch 401s every `/v1/*` request and looks
indistinguishable from unseeded KV without checking the actual HTTP status.

`localhost` in `EXPO_PUBLIC_API_BASE_URL` only works from a simulator or web — a physical device
needs the Mac's LAN IP, and `dev` runs `wrangler dev --ip 0.0.0.0` so the server actually accepts
those connections (default `wrangler dev` binds loopback-only). See `README.md`'s "Testing from a
physical device" section for the full setup.

## Commands

Run from repo root (workspace filtering works — `pnpm-workspace.yaml` has real globs):

```sh
pnpm --filter backend dev              # wrangler dev — local dev server
pnpm --filter backend deploy           # wrangler deploy --minify
pnpm --filter backend cf-typegen       # regenerate CloudflareBindings types from wrangler.jsonc into worker-configuration.d.ts
pnpm --filter backend run typecheck
pnpm --filter backend test             # vitest
pnpm --filter backend run setup:local  # db:migrate:local + push:datasets, chained — run once per fresh local state
```

Repo-wide:

```sh
pnpm format   # biome format --write .
pnpm check    # biome check .
pnpm knip     # find unused files/exports/deps across the monorepo
```

## Architecture notes

- Entry point is `src/index.ts` (`OpenAPIHono<{ Bindings: CloudflareBindings }>`), referenced by
  `main` in `wrangler.jsonc`. Five route modules are mounted: `datasets`, `train-status`,
  `feedback`, `events`, `push-registrations` (`src/routes/`). `x-api-key` auth
  (`src/middleware/api-key.ts`) applies to all `/v1/*` routes.
- Cloudflare bindings (KV `STATUS_CACHE`, D1 `DB`, `API_RATE_LIMITER`, cron triggers) are declared
  in `wrangler.jsonc`. When adding a binding, uncomment/add it there, then run
  `pnpm --filter backend cf-typegen` to regenerate the `CloudflareBindings` type before using it
  in code.
- `tsconfig.json` sets `jsxImportSource: "hono/jsx"` — Hono's own JSX runtime is available for
  server-rendered views if needed, not React.
- No `nodejs_compat` compatibility flag is enabled — Node.js built-ins are not available unless
  that flag is added in `wrangler.jsonc`.
- `openapi.yaml` is generated from the route definitions (`pnpm --filter backend run openapi`) and
  a drift test (`test/openapi-drift.test.ts`) keeps the committed file in sync with the code.
