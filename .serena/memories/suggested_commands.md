# Suggested Commands

Run from repo root unless noted. This is a pnpm repo without real workspace linking (see
`mem:tech_stack`), so most app-specific commands must be run with `pnpm --dir apps/<app> <cmd>`
or by `cd`-ing into the app dir — do not assume `pnpm -F frontend <cmd>` filtering works since
`pnpm-workspace.yaml` has no package globs.

## Root
- `pnpm format` — Biome format --write, whole repo.
- `pnpm check` — Biome check (lint), whole repo.
- `pnpm knip` — find unused files/exports/deps.

## Frontend (`apps/frontend`, Expo)
- `pnpm --dir apps/frontend start` — Expo dev server.
- `pnpm --dir apps/frontend ios` / `android` / `web` — platform-targeted dev server.
- `pnpm --dir apps/frontend lint` — `expo lint`.
- `pnpm --dir apps/frontend reset-project` — runs `scripts/reset-project.js` (Expo template
  reset script — destructive, only if starting the template over).
- Per repo-wide argent rule set, prefer `mcp__argent__*` MCP tools (if available) over raw
  `xcrun`/`adb`/simulator commands for any iOS simulator / Android emulator interaction with this
  app — check `.claude/rules/argent.md` availability_check before using.

## Backend (`apps/backend`, Cloudflare Workers/Hono)
- `pnpm --dir apps/backend dev` — `wrangler dev` local server.
- `pnpm --dir apps/backend deploy` — `wrangler deploy --minify` (deploys to Cloudflare — treat as
  a real-world side-effecting action, confirm with user before running).
- `pnpm --dir apps/backend cf-typegen` — regenerates `CloudflareBindings` types from
  `wrangler.jsonc` bindings; re-run after editing bindings in `wrangler.jsonc`.

## Darwin-specific notes
- Use `startdocker` to start Docker if a task needs it and Docker isn't running (per
  `.claude/rules/development.md`) — don't ask the user to start it manually.
