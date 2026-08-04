# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`shipaton2026` — entry for RevenueCat's **Shipaton** hackathon. The product is **SeatSignal**: a
commuter-train app that predicts expected standing/seating time and comfort for a route, not just
fastest/cheapest (core metric: Expected Standing Minutes). Full concept: `docs/memo.md`. Approved
spec: `.kiro/specs/seat-signal/{requirements,design,tasks}.md` (`ready_for_implementation: true`).
A red-team/pre-mortem review with scope kill-criteria is at
`docs/pm/review-seatsignal-idea-2026-08-04.md` — read it before expanding product scope.

## Layout

pnpm workspace monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*`):

- `apps/frontend/` — Expo React Native app (iOS/Android/Web), Expo Router. See its own
  `CLAUDE.md`/`AGENTS.md`.
- `apps/backend/` — Cloudflare Workers API on Hono. See its own `CLAUDE.md`.
- `packages/shared/` — shared TypeScript domain package (`workspace:*` dep of both apps): Result
  type, `AppError`/error codes, prediction scoring pure functions, zod schemas for the API/dataset/
  analytics-events contracts, plan-limit constants. Has the only real test suite in the repo today
  (vitest, `packages/shared/test/`).
- `.kiro/specs/seat-signal/` — approved requirements/design/tasks for the product.
  `.kiro/steering/` — product/tech/structure steering docs, **currently stale** (describe a
  pre-SeatSignal scaffold state; refresh via the `kiro-steering` skill before trusting them).
- `.github/workflows/ci.yaml` — Biome check, per-workspace typecheck, per-workspace vitest
  (`--if-present`, so only `shared` runs today).

## Implementation status

Only Phase 1 of `.kiro/specs/seat-signal/tasks.md` is done (`packages/shared` foundation + CI).
`apps/backend/src/index.ts` is still the unmodified Hono starter route; `apps/frontend/src/app/`
is still the Expo template screen. Don't assume SeatSignal routes, screens, or Cloudflare bindings
exist beyond what's implemented in `packages/shared`.

## Commands (from repo root)

```sh
pnpm format                              # Biome format --write, whole repo
pnpm check                               # Biome lint, whole repo
pnpm knip                                # unused files/exports/deps, whole repo
pnpm --filter <shared|backend|frontend> run typecheck
pnpm --filter shared test                # vitest — the only workspace with real tests today
pnpm --filter frontend start|ios|android|web|lint
pnpm --filter backend dev|deploy|cf-typegen
```

`pnpm --filter <name>` works directly (workspace globs are real) — prefer it over `cd`/`pnpm --dir`.

## Rules

Cross-cutting engineering rules live in `.claude/rules/*.md` (code style, git workflow, testing,
security, mobile/browser device-tool priorities, dev workflow, learning-loop memory policy) and
apply repo-wide — they're loaded automatically, this file is an orientation map, not a duplicate
of them.
