# Tech Stack

- Package manager: pnpm 10.33.0 (pinned via root `package.json` `packageManager`).
  `pnpm-workspace.yaml` real globs — `packages: ["apps/*", "packages/*"]`. Workspace package names
  are the bare `name` field in each `package.json` (`shared`, `frontend`, `backend`), not
  directory-derived.
- Root devDeps: Biome 2.5.6 (lint/format), Knip 6.x (dead code/deps), TypeScript 7.0.2, @types/node 26.x.
- `packages/shared` (workspace package `shared`, ESM): pure-TS domain package, no build step —
  `main`/`types`/`exports` point at `./src/index.ts`. Deps: zod ^4.4.3. Dev: TypeScript ^7.0.2,
  vitest ^4.1.10. Real tests under `packages/shared/test/` mirroring `src/`.
- `apps/frontend`: Expo SDK ~57 + Expo Router (typed routes, `src/app/`), React 19.2.3, React
  Native 0.86.2, react-native-reanimated 4.5.1/react-native-worklets, TypeScript ~6.0.3 (different
  from root/shared/backend's 7.0.2). State/data: `zustand` (`create()` for ephemeral state e.g.
  `stores/theme-store.ts`; `persist`+`createJSONStorage` over `lib/kv-store.ts` for durable
  per-feature state e.g. `features/preferences/preference-store.ts`), `@tanstack/react-query`.
  Platform integrations: `expo-sqlite` (local dataset cache), `expo-notifications`,
  `expo-localization`+`i18next`/`react-i18next` (ja/en, `src/locales/`), `expo-crypto`,
  `@sentry/react-native` (DSN unset — no real project yet; `ios`/`android` scripts prefixed
  `SENTRY_DISABLE_AUTO_UPLOAD=true`, the Expo config plugin's Xcode build-phase wrapper hard-fails
  without a configured org/project otherwise). `@expo/ui`/`expo-glass-effect` for native UI.
  `@playwright/test` for E2E (`apps/frontend/e2e/`, now populated). Depends on `shared` via
  workspace protocol. See `mem:frontend/core` for structure/testing pattern.
- `apps/backend`: Cloudflare Workers, `@hono/zod-openapi` (`OpenAPIHono` — same route defs drive
  routing + OpenAPI generation), `hono/cors`, Wrangler ^4.110.0, `@cloudflare/vitest-pool-workers`
  0.20.1 for Workers-runtime integration tests, `tsx` for scripts. `wrangler.jsonc` has real
  bindings now: D1 (`DB`, migrations in `src/db/migrations/`), KV (`STATUS_CACHE` — shared by ODPT
  status cache and dataset payloads, prefix-differentiated), a `ratelimits` binding, and two Cron
  Triggers (daily 18:00 UTC, every 5 min) — see `mem:backend/core` for the unresolved
  `scheduled`-export gap. Depends on `shared` via workspace protocol.
- CI: `.github/workflows/ci.yaml` — 4 jobs: Biome check (whole repo); typecheck matrix
  `[shared, backend, frontend]` (frontend synthesizes `expo-env.d.ts` first, backend runs
  `cf-typegen` first); vitest matrix over the same three workspaces (all now have real `test`
  scripts); Playwright E2E job (applies local D1 migrations, then `pnpm --filter frontend e2e`
  against the Expo web target — the only rendering-level test surface in this repo).
- Spec-driven dev tooling: `.kiro/specs/seat-signal/` (approved) and `.kiro/steering/`
  (product/tech/structure — synced 2026-08-06, not stale).
- Language: Swift is also registered as a project language in Serena's config, but no Swift
  source found under `apps/` as of last check — likely reserved for a future/parallel native iOS
  target (RevenueCat Shipaton context implies iOS+RevenueCat work is expected).
