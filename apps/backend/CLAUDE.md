# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Cloudflare Workers backend built with [Hono](https://hono.dev). Currently a fresh scaffold (`src/index.ts` only has the default `Hello Hono!` route) — there is no routing structure, data layer, or bindings configured yet.

This package lives inside the `shipaton2026` pnpm monorepo (`apps/backend`, sibling to `apps/frontend`, a React Native/Expo app). Formatting/linting (Biome) and unused-code checks (knip) are configured at the monorepo root, not here — run them from the repo root, not from `apps/backend`.

## Commands

Run from `apps/backend`:

```sh
npm run dev         # wrangler dev — local dev server
npm run deploy      # wrangler deploy --minify
npm run cf-typegen  # regenerate CloudflareBindings types from wrangler.jsonc into worker-configuration.d.ts
```

Run from the monorepo root (`/Users/harukikondo/git/shipaton2026`):

```sh
pnpm format   # biome format --write .
pnpm check    # biome check .
pnpm knip     # find unused files/exports/deps across the monorepo
```

There is no test runner configured for this package yet.

## Architecture notes

- Entry point is `src/index.ts`, referenced by `main` in `wrangler.jsonc`. The `Hono` app instance is exported as the default export — this is what Wrangler runs as the Worker's fetch handler.
- Cloudflare bindings (KV, R2, D1, AI, vars, etc.) are declared in `wrangler.jsonc` and are currently all commented out. When adding a binding, uncomment/add it there, then run `npm run cf-typegen` to regenerate the `CloudflareBindings` type before using it in code.
- Instantiate Hono with the generated bindings type so `c.env` is typed:
  ```ts
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  ```
- `tsconfig.json` sets `jsxImportSource: "hono/jsx"` — Hono's own JSX runtime is available for server-rendered views if needed, not React.
- No `nodejs_compat` compatibility flag is enabled — Node.js built-ins are not available unless that flag is added in `wrangler.jsonc`.
