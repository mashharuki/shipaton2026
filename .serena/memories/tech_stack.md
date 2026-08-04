# Tech Stack

- Package manager: pnpm 10.33.0 (pinned via root `package.json` `packageManager`).
  `pnpm-workspace.yaml` now defines real globs — `packages: ["apps/*", "packages/*"]` — so
  `pnpm --filter <name> <cmd>` works (used throughout `.github/workflows/ci.yaml`). Workspace
  package names are the bare `name` field in each `package.json` (`shared`, `frontend`,
  `backend`), not directory-derived.
- Root devDeps: Biome 2.5.6 (lint/format), Knip 6.x (dead code/deps), TypeScript 7.0.2, @types/node 26.x.
- `packages/shared` (workspace package `shared`, ESM `"type": "module"`): pure-TS domain package,
  no build step — `main`/`types`/`exports` all point straight at `./src/index.ts` (consumers
  import TS source directly). Deps: zod ^4.4.3. Dev: TypeScript ^7.0.2, vitest ^4.1.10. Has real
  tests under `packages/shared/test/` mirroring `src/` (result, prediction/scoring, utils, schemas,
  errors). Consumed by both apps via `"shared": "workspace:*"`. See `mem:product` for what it models.
- `apps/frontend`: Expo SDK ~57 + Expo Router (typed routes, file-based routing under `src/app/`),
  React 19.2.3, React Native 0.86.2, react-native-reanimated 4.5.1, react-native-worklets,
  TypeScript ~6.0.3 (note: different TS version than root/shared/backend). `experiments.reactCompiler: true`
  is enabled in `app.json` — React Compiler is active for this app. Also has `@expo/ui`,
  `expo-device`, `expo-glass-effect` (native/glass UI + device-info APIs) and an `e2e/` dir
  (currently empty — no e2e tests written yet). Depends on `shared` via workspace protocol.
  IMPORTANT (per `apps/frontend/AGENTS.md`/`CLAUDE.md`): Expo has changed significantly at v57;
  consult https://docs.expo.dev/versions/v57.0.0/ before writing Expo code, don't rely on
  pre-v57 memory/training data.
- `apps/backend`: Cloudflare Workers, Hono 4.x, Wrangler 4.x, ESM (`"type": "module"`). Entry:
  `apps/backend/src/index.ts` — still the unmodified Hono starter route (`GET / → "Hello Hono!"`)
  as of this writing; no SeatSignal routes/bindings built yet (Phase 2/3 in
  `.kiro/specs/seat-signal/tasks.md`). `wrangler.jsonc` has no bindings configured yet (KV/R2/D1/AI
  all commented out). Depends on `shared` via workspace protocol.
- CI: `.github/workflows/ci.yaml` — 3 jobs on push/PR to main: Biome check (whole repo), typecheck
  matrix over `[shared, backend, frontend]` (via `pnpm --filter <ws> run typecheck`; frontend job
  synthesizes `expo-env.d.ts` first since it's gitignored/Expo-generated), and a vitest matrix over
  the same three workspaces using `--if-present` (so backend/frontend are silently skipped until
  they add a `test` script — only `shared` currently has one).
- Spec-driven dev tooling: `.kiro/specs/seat-signal/` (Kiro-style requirements/design/tasks,
  approved) and `.kiro/steering/` (product/tech/structure — currently stale, see `mem:core`).
- Language: Swift is also registered as a project language in Serena's config, but no Swift
  source was found under `apps/` — likely reserved for a future/parallel native iOS target
  (RevenueCat Shipaton context implies iOS+RevenueCat work is expected).
