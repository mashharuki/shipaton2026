# Technology Stack

## Architecture

pnpm workspace monorepo (`apps/*`, `packages/*`) with two deployable apps:
- `apps/backend` — Cloudflare Workers API (Hono)
- `apps/frontend` — Expo / React Native client (iOS, Android, Web)

`packages/` is reserved for shared code extracted later; it is currently empty.

## Core Technologies

- **Language**: TypeScript, strict mode, everywhere
- **Backend**: Hono on Cloudflare Workers, deployed via Wrangler
- **Frontend**: Expo SDK 57, React Native 0.86, React 19, `expo-router` for file-based navigation

## Key Libraries

- Frontend: `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` for animation; `react-native-web` for the web target
- Monetization: RevenueCat SDK is the intended purchase/entitlement layer for the Shipaton submission but is not yet added to either app

## Development Standards

### Type Safety
TypeScript `strict: true` in both `apps/backend/tsconfig.json` and `apps/frontend/tsconfig.json`. The backend additionally types Cloudflare bindings via generated `CloudflareBindings` — regenerate with `npm run cf-typegen` (in `apps/backend`) any time `wrangler.jsonc` bindings change, and instantiate Hono as `new Hono<{ Bindings: CloudflareBindings }>()` to keep `c.env` typed.

### Code Quality
Biome is authoritative for formatting and linting across the whole monorepo (`pnpm format`, `pnpm check` from the repo root) — not ESLint/Prettier. `knip` (`pnpm knip`, repo root) finds unused files/exports/deps monorepo-wide. The frontend also ships Expo's default `expo lint` script (ESLint-based) as part of the Expo template, but no ESLint config exists yet — Biome is the actual enforced standard.

### Testing
No test runner is configured in either app yet. When tests are introduced, follow `.claude/rules/testing.md`: files co-located as `foo.ts` → `foo.test.ts`, `describe`/`it` grouping, happy path + edge cases + error cases, mocking at module boundaries.

## Development Environment

### Required Tools
- pnpm, pinned via `packageManager: pnpm@10.33.0` at the repo root
- Wrangler CLI for the backend (installed as a devDependency, invoked via `npm run dev` / `deploy`)
- Expo CLI for the frontend (invoked via `npm run start` / `ios` / `android` / `web`)

### Common Commands
```bash
# Backend (from apps/backend)
npm run dev          # wrangler dev — local dev server
npm run deploy        # wrangler deploy --minify
npm run cf-typegen    # regenerate CloudflareBindings types

# Frontend (from apps/frontend)
npm run start          # expo start
npm run ios / android / web

# Repo-wide (from repo root)
pnpm format   # biome format --write .
pnpm check    # biome check .
pnpm knip     # unused files/exports/deps
```

## Key Technical Decisions

- **Cloudflare Workers over Node** for the backend: edge runtime, not Node.js — the `nodejs_compat` compatibility flag is not enabled in `wrangler.jsonc`, so Node built-ins are unavailable unless that flag is added.
- **Biome over ESLint/Prettier** at the monorepo root for one fast formatter/linter shared by both apps.
- **RevenueCat for monetization** is the assumed direction (per Shipaton hackathon rules and the RevenueCat-focused tooling installed in this project) but is not yet wired into either app — treat it as pending, not implemented.

---
_Document standards and patterns, not every dependency_
