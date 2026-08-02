# Tech Stack

- Package manager: pnpm 10.33.0 (pinned via root `package.json` `packageManager`). Workspace file
  `pnpm-workspace.yaml` exists but is empty (no `packages:` globs defined) — do not assume
  `apps/*` are linked as a pnpm workspace; verify before relying on workspace protocol deps.
- Root devDeps: Biome 2.5.6 (lint/format), Knip 6.x (dead code/deps), TypeScript 7.0.2, @types/node 26.x.
- `apps/frontend`: Expo SDK ~57 + Expo Router (typed routes, file-based routing under `src/app/`),
  React 19.2.3, React Native 0.86.2, react-native-reanimated 4.5.1, react-native-worklets,
  TypeScript ~6.0.3 (note: different TS version than root). `experiments.reactCompiler: true` is
  enabled in `app.json` — React Compiler is active for this app.
  IMPORTANT (per `apps/frontend/AGENTS.md`/`CLAUDE.md`): Expo has changed significantly at v57;
  consult https://docs.expo.dev/versions/v57.0.0/ before writing Expo code, don't rely on
  pre-v57 memory/training data.
- `apps/backend`: Cloudflare Workers, Hono 4.x, Wrangler 4.x, ESM (`"type": "module"`). Entry:
  `apps/backend/src/index.ts`. `wrangler.jsonc` has no bindings configured yet (KV/R2/D1/AI all
  commented out) — this is a bare Hono-on-Workers starter, not yet wired to storage.
- Language: Swift is also registered as a project language in Serena's config, but no Swift
  source was found under `apps/` at onboarding time — likely relevant for a future/parallel
  native iOS target (RevenueCat Shipaton context implies iOS+RevenueCat work is expected).
