# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Cloudflare Workers backend built with [Hono](https://hono.dev). Currently a fresh scaffold (`src/index.ts` only has the default `Hello Hono!` route) — there is no routing structure, data layer, or bindings configured yet. The product this will eventually serve is **SeatSignal** (see root `CLAUDE.md` and `.kiro/specs/seat-signal/`); the backend implementation phase (Workers/D1/KV infra, API routes) hasn't started — `.kiro/specs/seat-signal/tasks.md` Phase 2/3 is the plan for it.

This package lives inside the `shipaton2026` pnpm monorepo (`apps/backend`, sibling to `apps/frontend`, a React Native/Expo app, and `packages/shared`, a shared TS domain package). Formatting/linting (Biome) and unused-code checks (knip) are configured at the monorepo root, not here — run them from the repo root, not from `apps/backend`.

`shared` (workspace package, `"shared": "workspace:*"` dep) is already available and should be the source of truth once routes are built: `packages/shared/src/schemas/api.schema.ts` and `dataset.schema.ts` define the intended request/response contracts, `packages/shared/src/errors/` provides `AppError`/`ErrorCode`, and `packages/shared/src/result.ts` provides the `Result` type — reuse these rather than redefining shapes locally.

## Commands

Run from repo root (workspace filtering works — `pnpm-workspace.yaml` has real globs):

```sh
pnpm --filter backend dev          # wrangler dev — local dev server
pnpm --filter backend deploy       # wrangler deploy --minify
pnpm --filter backend cf-typegen   # regenerate CloudflareBindings types from wrangler.jsonc into worker-configuration.d.ts
pnpm --filter backend run typecheck
```

Repo-wide:

```sh
pnpm format   # biome format --write .
pnpm check    # biome check .
pnpm knip     # find unused files/exports/deps across the monorepo
```

There is no test runner configured for this package yet (CI's vitest matrix job uses `--if-present` and currently skips it — add a `test` script here once tests exist, per `.claude/rules/testing.md`).

## Architecture notes

- Entry point is `src/index.ts`, referenced by `main` in `wrangler.jsonc`. The `Hono` app instance is exported as the default export — this is what Wrangler runs as the Worker's fetch handler.
- Cloudflare bindings (KV, R2, D1, AI, vars, etc.) are declared in `wrangler.jsonc` and are currently all commented out. When adding a binding, uncomment/add it there, then run `npm run cf-typegen` to regenerate the `CloudflareBindings` type before using it in code.
- Instantiate Hono with the generated bindings type so `c.env` is typed:
  ```ts
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  ```
- `tsconfig.json` sets `jsxImportSource: "hono/jsx"` — Hono's own JSX runtime is available for server-rendered views if needed, not React.
- No `nodejs_compat` compatibility flag is enabled — Node.js built-ins are not available unless that flag is added in `wrangler.jsonc`.
