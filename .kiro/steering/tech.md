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

- Frontend: `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` for
  animation; `react-native-web` for the web target; `@expo/ui` / `expo-glass-effect` for native UI
- Shared: `zod` for runtime-validated contract schemas (API requests/responses, dataset payloads,
  analytics events) — schemas live once in `packages/shared/src/schemas/` and are the source of
  truth for both the (not-yet-built) backend routes and the frontend
- Monetization: RevenueCat SDK is the intended purchase/entitlement layer for the Shipaton
  submission but is not yet added to either app; `packages/shared` already defines
  `PRO_ENTITLEMENT_ID` and free-tier plan-limit constants as the shared contract for it

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
`packages/shared` has a real vitest suite (`packages/shared/test/`, mirroring `src/`) — this is
the pattern to follow: co-located `*.test.ts` files exercising pure domain logic (scoring,
schemas, error helpers) with no I/O mocking needed since the package has none. `apps/backend` and
`apps/frontend` have no tests yet; when added, follow `.claude/rules/testing.md` and give each
workspace a `test` script so CI's `--if-present` vitest matrix picks it up automatically.

## Development Environment

### Required Tools
- pnpm, pinned via `packageManager: pnpm@10.33.0` at the repo root
- Wrangler CLI for the backend (devDependency, invoked via `pnpm --filter backend dev` / `deploy`)
- Expo CLI for the frontend (invoked via `pnpm --filter frontend start` / `ios` / `android` / `web`)

### Common Commands
```bash
# Any workspace (repo root; pnpm --filter works directly)
pnpm --filter <shared|backend|frontend> run typecheck

# Backend
pnpm --filter backend dev          # wrangler dev — local dev server
pnpm --filter backend deploy       # wrangler deploy --minify
pnpm --filter backend cf-typegen   # regenerate CloudflareBindings types

# Frontend
pnpm --filter frontend start       # expo start
pnpm --filter frontend ios / android / web

# Shared
pnpm --filter shared test          # vitest

# Repo-wide
pnpm format   # biome format --write .
pnpm check    # biome check .
pnpm knip     # unused files/exports/deps
```

## CI

`.github/workflows/ci.yaml` runs on push/PR to `main`: Biome check (whole repo), a typecheck
matrix over `[shared, backend, frontend]`, and a vitest matrix over the same three workspaces
using `--if-present` (so backend/frontend are silently skipped until they gain a `test` script).
Treat a clean local `pnpm check` + per-workspace typecheck + `pnpm --filter shared test` as CI
parity.

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
  contract, treat actual SDK integration as pending.

---
_Document standards and patterns, not every dependency_
_Last synced with codebase: 2026-08-04 (kiro-steering sync)_
