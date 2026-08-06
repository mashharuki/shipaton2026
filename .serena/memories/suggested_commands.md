# Suggested Commands

Run from repo root unless noted. `pnpm --filter <workspace-name> <cmd>` / `pnpm -F <name> <cmd>`
work directly — prefer over `cd`/`pnpm --dir`. Workspace names: `shared`, `frontend`, `backend`.

## Root
- `pnpm format` — Biome format --write, whole repo.
- `pnpm check` — Biome check (lint), whole repo.
- `pnpm knip` — find unused files/exports/deps.
- `pnpm --filter <shared|backend|frontend> run typecheck` — per-workspace typecheck (CI matrix).
- `pnpm --filter <shared|backend|frontend> run test` — vitest; all three workspaces now have a
  real suite (not just `shared`).

## Frontend (`apps/frontend`, Expo)
- `pnpm --filter frontend start` — Expo dev server.
- `pnpm --filter frontend ios` / `android` / `web` — platform-targeted dev server.
- `pnpm --filter frontend lint` — `expo lint`.
- `pnpm --filter frontend e2e` — `playwright test` against the Expo web target (needs local
  backend D1 migrated first, see CI job below).
- `pnpm --filter frontend reset-project` — Expo template reset script — destructive, template-only.
- Per repo-wide argent rule set, prefer `mcp__argent__*` MCP tools (if available) over raw
  `xcrun`/`adb`/simulator commands for iOS simulator / Android emulator interaction — check
  `.claude/rules/argent.md` availability_check before using.

## Backend (`apps/backend`, Cloudflare Workers/Hono)
- `pnpm --filter backend dev` — `wrangler dev` local server.
- `pnpm --filter backend deploy` — `wrangler deploy --minify` (real Cloudflare deploy — confirm
  with user before running).
- `pnpm --filter backend cf-typegen` — regenerates `CloudflareBindings` types from
  `wrangler.jsonc` bindings; re-run after editing bindings.
- `pnpm --filter backend db:migrate:local` — `wrangler d1 migrations apply seatsignal-db --local`.
- `pnpm --filter backend generate:datasets` — regenerate fixture datasets (timetable/congestion/
  correction) used by dev/test/E2E.
- `pnpm --filter backend push:datasets` — push generated datasets into local KV.
- `pnpm --filter backend openapi` — regenerate committed `openapi.yaml` from route definitions
  (there's a drift test asserting these stay in sync — `test/openapi-drift.test.ts`).

## CI parity (what `.github/workflows/ci.yaml` runs on every push/PR to main)
1. `pnpm check` (Biome, whole repo)
2. `pnpm --filter <shared|backend|frontend> run typecheck` (matrix; frontend/backend need their
   generated-types step first — `expo-env.d.ts` / `cf-typegen` respectively)
3. `pnpm --filter <shared|backend|frontend> run test` (matrix; all three now have real suites)
4. Playwright E2E: `wrangler d1 migrations apply --local` then `pnpm --filter frontend e2e`

## Darwin-specific notes
- Use `startdocker` to start Docker if a task needs it and Docker isn't running (per
  `.claude/rules/development.md`) — don't ask the user to start it manually.
