# shipaton2026 — Core Map

pnpm workspace monorepo for a RevenueCat "Shipaton" hackathon entry. `pnpm-workspace.yaml` real
globs (`apps/*`, `packages/*`) — `pnpm --filter <name> <cmd>` works.

Product: **SeatSignal** (通勤電車の着座快適性予測アプリ) — approved spec at
`.kiro/specs/seat-signal/` (requirements.md, design.md, tasks.md; `spec.json` phase
`tasks-generated`, all approvals true, `ready_for_implementation: true`). Full concept:
`docs/memo.md`. Red-team/pre-mortem review: `docs/pm/review-seatsignal-idea-2026-08-04.md`
(verdict: Conditional Go, numbered kill-criteria — read before product-scope decisions). See
`mem:product` for condensed product facts and current implementation phase.

`.kiro/steering/{product,tech,structure}.md` are synced as of 2026-08-06 (kiro-steering skill) —
trust them, no longer stale.

Layout:
- `apps/frontend/` — Expo React Native app (iOS/Android/Web), expo-router, feature-based domain
  logic. See `mem:frontend/core`.
- `apps/backend/` — Cloudflare Workers API (Hono/OpenAPIHono), D1+KV+Cron. See `mem:backend/core`.
- `packages/shared/` — shared TS domain package (`name: "shared"`, `"shared": "workspace:*"` in
  both apps). Result type, app-error/error-code helpers, prediction scoring pure functions, zod
  schemas for API/dataset/analytics-events, plan-limit constants. Own vitest suite
  (`packages/shared/test/`). See `mem:product` for what these model.
- `docs/` — `memo.md` (product spec), `pm/` (strategy reviews), `mockup.html` (see root-level
  auto-memory `mockup-html-extraction.md` for extraction procedure).
- Root tooling: Biome (lint+format, see `mem:conventions`), Knip (unused code/deps), pnpm.
- `.github/workflows/ci.yaml` — 4 jobs: Biome check, typecheck matrix (shared/backend/frontend),
  vitest matrix (all 3 workspaces now have real `test` scripts), Playwright E2E (frontend, applies
  local D1 migrations first).

Extensive `.claude/rules/*.md` govern agent behavior (code-style, git-workflow, testing, security,
argent mobile-device MCP tooling, dev/browser-tool priorities, learning-loop memory policy). Those
are process rules, not project facts — read directly rather than via Serena memory when relevant.

For commands: `mem:suggested_commands`. For completion checks: `mem:task_completion`. For product
facts and implementation phase: `mem:product`. For backend internals: `mem:backend/core`. For
frontend internals: `mem:frontend/core`.
