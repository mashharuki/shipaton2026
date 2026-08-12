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
  analytics-events contracts, plan-limit constants (vitest, `packages/shared/test/`).
- `.kiro/specs/seat-signal/` — approved requirements/design/tasks for the product.
  `.kiro/steering/` — product/tech/structure steering docs, **currently stale** (describe a
  pre-SeatSignal scaffold state; refresh via the `kiro-steering` skill before trusting them).
- `.github/workflows/ci.yaml` — Biome check, per-workspace typecheck (incl. `cf-typegen` for
  backend), per-workspace vitest (`shared`/`backend`/`frontend` all have real `test` scripts now),
  Playwright E2E against Expo web (seeds local D1 + KV fixtures first).

## Implementation status

Phases 1–9 of `.kiro/specs/seat-signal/tasks.md` are substantially implemented and verified
(shared foundation, backend API/aggregation/notifications, frontend app shell, core search/predict/
compare/detail loop, subscription/Paywall, Live Comfort Coach, saved routes/notifications/report,
onboarding/settings) — this is **not** a scaffold anymore. Verified directly (2026-08-12): backend
`typecheck` is clean and `pnpm --filter backend test` passes 65/65 (real D1/KV via
`vitest-pool-workers`); `pnpm --filter shared test` passes 68/68. Don't trust tasks.md's `[x]`
checkboxes blindly, but don't assume the "unmodified Hono starter" state either — read the actual
route/feature files before claiming something is missing.

Known real gaps, not assumptions:
- **No station-picker search UI.** `apps/frontend/src/app/(tabs)/index.tsx`'s search button always
  fires one hardcoded `DEMO_QUERY` (Shinjuku→Tokyo, fixed date/time); saved routes reuse the same
  query. The search/prediction engine itself (`apps/frontend/src/features/search/`,
  `packages/shared/src/prediction/scoring.ts`) is real and tested, not mocked — `results.tsx` reads
  arbitrary query params, so a picker UI is the only missing piece, not the engine.
- **Datasets are synthetic demo data, on purpose.** Real ODPT 中央線 timetable data is
  Challenge-only licensed and was deliberately not adopted (see `design.md`'s "Out of Boundary" and
  project memory `odpt-timetable-challenge-license-2026-08.md`). The bundled fixture covers 5
  stations / 1 line / weekday-only.
- **10.3 (real-device E2E) and 10.4 (sandbox purchase E2E) are unstarted**, blocked on a human with
  a physical device / real Apple ID sandbox account — see `docs/qa/10.3-10.4-manual-e2e-runbook.md`.
- Feedback aggregation's `delta_score`/`mae_standing_min` use a provisional heuristic (categorical
  `vsExpected` mapped to ±0.1), not a real measured standing-time error — see tasks.md's 3.4 note.

## Commands (from repo root)

```sh
pnpm format                              # Biome format --write, whole repo
pnpm check                               # Biome lint, whole repo
pnpm knip                                # unused files/exports/deps, whole repo
pnpm --filter <shared|backend|frontend> run typecheck
pnpm --filter <shared|backend|frontend> test    # vitest — all three workspaces have real suites
pnpm --filter frontend start|ios|android|web|lint|e2e
pnpm --filter backend dev|deploy|cf-typegen|run setup:local
```

`pnpm --filter <name>` works directly (workspace globs are real) — prefer it over `cd`/`pnpm --dir`.

## Rules

Cross-cutting engineering rules live in `.claude/rules/*.md` (code style, git workflow, testing,
security, mobile/browser device-tool priorities, dev workflow, learning-loop memory policy) and
apply repo-wide — they're loaded automatically, this file is an orientation map, not a duplicate
of them.
