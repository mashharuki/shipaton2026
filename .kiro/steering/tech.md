# Technology Stack

## Architecture

pnpm workspace monorepo (`pnpm-workspace.yaml`: `apps/*`, `packages/*` — real globs, so
`pnpm --filter <name> <cmd>` works) with three workspaces:
- `apps/backend` — Cloudflare Workers API (Hono)
- `apps/frontend` — Expo / React Native client (iOS, Android, Web)
- `packages/shared` — shared TypeScript domain package (workspace name `shared`), consumed by both
  apps as `"shared": "workspace:*"`. No build step: `main`/`types` point straight at
  `./src/index.ts`, so consumers import TS source directly and new exports must be re-exported
  from `packages/shared/src/index.ts` to be usable elsewhere.

## Core Technologies

- **Language**: TypeScript, strict mode, everywhere
- **Backend**: Hono on Cloudflare Workers, deployed via Wrangler
- **Frontend**: Expo SDK 57, React Native 0.86, React 19, `expo-router` for file-based navigation
- **Shared domain layer**: pure TypeScript + zod, no runtime framework dependency, so it's
  importable from both the edge Worker and the RN app without polyfills

## Key Libraries

- Frontend UI: `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets`
  for animation; `react-native-web` for the web target; `@expo/ui` / `expo-glass-effect` for
  native UI
- Frontend state/data: `zustand` for client state — plain `create()` for ephemeral UI state
  (`stores/theme-store.ts`), `persist` + `createJSONStorage` over the local `lib/kv-store.ts` port
  for durable preferences (`features/preferences/preference-store.ts`); `@tanstack/react-query` for
  server-state fetching against the backend API
- Frontend platform integrations: `expo-sqlite` (local dataset cache), `expo-notifications` (push),
  `expo-localization` + `i18next`/`react-i18next` (ja/en, resources in `src/locales/`),
  `expo-crypto`, `@sentry/react-native` (crash reporting — DSN intentionally unset until a real
  Sentry project exists; `ios`/`android` npm scripts are prefixed
  `SENTRY_DISABLE_AUTO_UPLOAD=true` because the Expo config plugin's Xcode build-phase wrapper
  hard-fails without a configured org/project otherwise)
- Backend: `@hono/zod-openapi` (`OpenAPIHono`) drives both routing and OpenAPI generation from the
  same route definitions; `hono/cors` (wildcard origin — accountless, x-api-key-gated API, so a
  permissive CORS policy leaks nothing session-based); `@cloudflare/vitest-pool-workers` for
  Workers-runtime integration tests against real D1/KV bindings
- Shared: `zod` for runtime-validated contract schemas (API requests/responses, dataset payloads,
  analytics events) — schemas live once in `packages/shared/src/schemas/` and are the source of
  truth for both backend routes and frontend; schemas needing OpenAPI `$ref`s use zod4's
  `.meta({id})` (see `ErrorResponse`/`OkResponse`) instead of inlining
- Monetization: RevenueCat SDK is the intended purchase/entitlement layer for the Shipaton
  submission (`.kiro/specs/seat-signal/tasks.md` phase 6) but is **not yet added to either app** —
  `packages/shared` already defines `PRO_ENTITLEMENT_ID` and free-tier plan-limit constants as the
  shared contract for it, and the free-tier search/comparison/detail flow (phase 5) is built and
  ungated ahead of it

## Development Standards

### Type Safety
TypeScript `strict: true` across all three workspaces. The backend additionally types Cloudflare
bindings via generated `CloudflareBindings` — regenerate with `pnpm --filter backend cf-typegen`
any time `wrangler.jsonc` bindings change, and instantiate Hono as
`new Hono<{ Bindings: CloudflareBindings }>()` to keep `c.env` typed.

### Code Quality
Biome is authoritative for formatting and linting across the whole monorepo (`pnpm format`,
`pnpm check` from the repo root) — not ESLint/Prettier. `knip` (`pnpm knip`, repo root) finds
unused files/exports/deps monorepo-wide. The frontend also ships Expo's default `expo lint`
script (ESLint-based) as part of the Expo template, but no ESLint config exists yet — Biome is
the actual enforced standard.

### Testing
All three workspaces have real vitest suites now (`<workspace>/test/`, mirroring `src/`), and
frontend also has Playwright E2E (`apps/frontend/e2e/`):
- `packages/shared`: pure domain logic (scoring, schemas, error helpers) — no I/O mocking needed
  since the package has none.
- `apps/backend`: `@cloudflare/vitest-pool-workers` integration tests hit real D1/KV bindings via
  `SELF.fetch`/`applyD1Migrations`, not mocks — see `apps/backend/test/routes/*.test.ts` and
  `test/cron/*.test.ts`. When mocking `fetch` inside a Workers test, build the `Response` inside
  `vi.spyOn(globalThis, "fetch").mockImplementation(...)`, not via a pre-built `Response` handed to
  `mockResolvedValue` — a pre-built one belongs to the outer test's IoContext and throws on read.
  KV state is not isolated per `it()`; clear keys you depend on in `beforeEach`.
- `apps/frontend`: Vitest coverage is **domain-layer only** (`src/features/**`, `src/lib/**`) by
  deliberate architectural constraint, not oversight — this project's Vite/Rolldown-based Vitest
  pipeline cannot parse React Native's Flow-typed source (`react-native/index.js` fails with
  `RolldownError: Flow is not supported`), so no RN-component-rendering tool (`react-test-renderer`,
  `@testing-library/react-native`) works here without a new Babel/Flow transform. The working
  pattern: extract decision logic into a pure, port-based module Vitest can import directly
  (`features/dataset/dataset-repository.ts` depends on a typed `DatasetStore` port, never
  `expo-sqlite`, directly), then leave the JSX/rendering layer to Playwright. Playwright
  (`apps/frontend/e2e/`) covers screen-level/rendering behavior against the Expo **web** target
  only — it is the only rendering-level test surface in this repo.
- CI mirrors this as 4 jobs (`.github/workflows/ci.yaml`): Biome, typecheck matrix, vitest matrix
  (all 3 workspaces), and a Playwright job that also applies local D1 migrations before running.

## Development Environment

### Required Tools
- pnpm, pinned via `packageManager: pnpm@10.33.0` at the repo root
- Wrangler CLI for the backend (devDependency, invoked via `pnpm --filter backend dev` / `deploy`)
- Expo CLI for the frontend (invoked via `pnpm --filter frontend start` / `ios` / `android` / `web`)

### Common Commands
```bash
# Any workspace (repo root; pnpm --filter works directly)
pnpm --filter <shared|backend|frontend> run typecheck
pnpm --filter <shared|backend|frontend> run test   # vitest, all three workspaces now

# Backend
pnpm --filter backend dev              # wrangler dev — local dev server
pnpm --filter backend deploy           # wrangler deploy --minify
pnpm --filter backend cf-typegen       # regenerate CloudflareBindings types
pnpm --filter backend db:migrate:local # apply D1 migrations to local Miniflare
pnpm --filter backend generate:datasets # regenerate fixture datasets (timetable/congestion/correction)
pnpm --filter backend push:datasets    # push generated datasets to local KV
pnpm --filter backend openapi          # regenerate committed openapi.yaml from route definitions

# Frontend
pnpm --filter frontend start       # expo start
pnpm --filter frontend ios / android / web
pnpm --filter frontend e2e         # playwright test (against Expo web target)

# Repo-wide
pnpm format   # biome format --write .
pnpm check    # biome check .
pnpm knip     # unused files/exports/deps
```

## CI

`.github/workflows/ci.yaml` runs on push/PR to `main`: Biome check (whole repo), a typecheck
matrix over `[shared, backend, frontend]` (frontend generates `expo-env.d.ts`, backend runs
`cf-typegen` first), a vitest matrix over the same three workspaces (`--if-present`, now a no-op
guard since all three declare `test`), and a Playwright E2E job (applies local D1 migrations, then
runs `pnpm --filter frontend e2e` against the Expo web target). Treat a clean local `pnpm check` +
per-workspace typecheck + `pnpm --filter <ws> test` + `pnpm --filter frontend e2e` as CI parity.

## Key Technical Decisions

- **Cloudflare Workers over Node** for the backend: edge runtime, not Node.js — the
  `nodejs_compat` compatibility flag is not enabled in `wrangler.jsonc`, so Node built-ins are
  unavailable unless that flag is added.
- **Biome over ESLint/Prettier** at the monorepo root for one fast formatter/linter shared by all
  workspaces.
- **`packages/shared` as a build-free source package**: domain logic, contract schemas (zod), and
  error/result helpers extracted once so frontend and backend can't drift on prediction math or
  API shapes — chosen specifically because the product's core value (ESM) must be computed
  identically wherever it's shown, and because a hackathon timeline favors sharing over an API
  round-trip for pure functions.
- **RevenueCat for monetization** is the assumed direction (per Shipaton hackathon rules) but not
  yet wired into either app — `packages/shared`'s plan-limit constants exist as the future
  contract, treat actual SDK integration as pending (`.kiro/specs/seat-signal/tasks.md` phase 6).
- **Cron Triggers configured but not dispatched**: `wrangler.jsonc` declares a daily (feedback
  aggregation) and 5-minute (commuter notification) cron schedule, and both batch jobs
  (`cron/aggregate-feedback.ts`, `cron/notify-commuters.ts`) are implemented and tested as
  directly-callable functions — but `apps/backend/src/index.ts` has no `scheduled` export to
  invoke them, so neither cron fires in a real deployment yet. This is a known, tracked gap (see
  `.kiro/specs/seat-signal/tasks.md` Implementation Notes for task 2.2/3.4/3.7), left unresolved
  pending a human decision on which task should own adding the `scheduled` export — don't assume
  the cron batches run just because the triggers are configured.
- **Frontend domain logic is Vitest-testable by construction, RN rendering is not**: business logic
  lives in `src/features/**/*.ts` (plain functions/stores behind typed ports) precisely so it can
  be unit-tested without a working RN component-render pipeline in this Vite/Rolldown-based test
  setup; JSX/screens are verified via Playwright against the web target instead. Keep new
  domain logic in that shape rather than folding it into components.

---
_Document standards and patterns, not every dependency_
_Last synced with codebase: 2026-08-06 (kiro-steering sync)_
