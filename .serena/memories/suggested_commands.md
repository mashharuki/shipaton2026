# Suggested Commands

Run from repo root unless noted. `pnpm-workspace.yaml` now has real `packages:` globs
(`apps/*`, `packages/*` — see `mem:tech_stack`), so `pnpm --filter <workspace-name> <cmd>` /
`pnpm -F <workspace-name> <cmd>` work directly — prefer this over `cd`/`pnpm --dir`. Workspace
names are the `name` field in each package.json: `shared`, `frontend`, `backend`.

## Root
- `pnpm format` — Biome format --write, whole repo.
- `pnpm check` — Biome check (lint), whole repo.
- `pnpm knip` — find unused files/exports/deps.
- `pnpm --filter shared test` / `pnpm --filter shared run typecheck` — the only workspace with a
  real test suite today (vitest). Run this after any change to `packages/shared`.
- `pnpm --filter backend run typecheck`, `pnpm --filter frontend run typecheck` — per-workspace
  typecheck (also what CI runs in the typecheck matrix job).

## Frontend (`apps/frontend`, Expo)
- `pnpm --filter frontend start` — Expo dev server.
- `pnpm --filter frontend ios` / `android` / `web` — platform-targeted dev server.
- `pnpm --filter frontend lint` — `expo lint`.
- `pnpm --filter frontend reset-project` — runs `scripts/reset-project.js` (Expo template
  reset script — destructive, only if starting the template over).
- Per repo-wide argent rule set, prefer `mcp__argent__*` MCP tools (if available) over raw
  `xcrun`/`adb`/simulator commands for any iOS simulator / Android emulator interaction with this
  app — check `.claude/rules/argent.md` availability_check before using.

## Backend (`apps/backend`, Cloudflare Workers/Hono)
- `pnpm --filter backend dev` — `wrangler dev` local server.
- `pnpm --filter backend deploy` — `wrangler deploy --minify` (deploys to Cloudflare — treat as
  a real-world side-effecting action, confirm with user before running).
- `pnpm --filter backend cf-typegen` — regenerates `CloudflareBindings` types from
  `wrangler.jsonc` bindings; re-run after editing bindings in `wrangler.jsonc`.

## CI parity (what `.github/workflows/ci.yaml` runs on every push/PR to main)
1. `pnpm check` (Biome, whole repo)
2. `pnpm --filter <shared|backend|frontend> run typecheck` (matrix)
3. `pnpm --filter <shared|backend|frontend> --if-present run test` (matrix; only `shared` has a
   test script today, others are silently skipped)

## Darwin-specific notes
- Use `startdocker` to start Docker if a task needs it and Docker isn't running (per
  `.claude/rules/development.md`) — don't ask the user to start it manually.
