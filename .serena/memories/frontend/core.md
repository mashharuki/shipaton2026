# Frontend — apps/frontend (Expo React Native)

Routing: expo-router file-based under `src/app/` (typed routes). `(tabs)/` route group = 3-tab
shell (home/report/settings, `_layout.tsx` per dir); pushed screens include results, route detail,
coach, feedback, paywall, onboarding, and settings subpages.

## Structure
- `features/<feature>/` — domain/business logic per feature area (search, prediction,
  preferences, dataset sync), kept **separate from screens on purpose** so it's Vitest-testable
  (see Testing below). Typical shape: a store/engine/repository file + a `use-*.ts` hook the
  screen calls; I/O boundaries (SQLite, storage) are abstracted behind a typed port so the logic
  file has no native dependency (e.g. `features/dataset/dataset-repository.ts` depends on a
  `DatasetStore` port in `dataset-store.ts`, never `expo-sqlite` directly).
- `lib/` — cross-cutting infra, not feature-specific: `api-client.ts` (fetch wrapper normalizing
  offline/timeout/http/validation errors to `shared`'s `ErrorCode`s via `parseToResult`), `db.ts`/
  `kv-store.ts` (SQLite/storage setup), `i18n.ts` (i18next init, resources in `src/locales/{ja,en}.json`),
  `analytics.ts` (batched event client, max-20 batches), `error-display.ts` (pure: `AppError` →
  i18n message key + retry affordance — `components/error-state.tsx` is its untested JSX consumer).
- `stores/` — `zustand` stores for ephemeral UI state only (plain `create()`, e.g.
  `theme-store.ts`); durable per-feature state instead lives inside its feature dir with
  `persist`+`createJSONStorage` over `lib/kv-store.ts` (e.g.
  `features/preferences/preference-store.ts`).
- `components/`, `hooks/`, `constants/` — shared UI/cross-cutting hooks/theming. Platform variants
  via `.web.tsx`/`.web.ts` suffix (Metro/Expo auto-resolves).
- Implemented feature modules also cover subscription (RevenueCat + free-tier gate), coach/train
  status/feedback/history, saved routes/notifications/report, onboarding, and privacy settings.
  Prediction strategies produce shared `ComfortEstimate`: Tokyo uses `ModeledStrategy`; the
  fixture-tested TfNSW path uses `MeasuredStrategy` with optional per-carriage data.

## Testing — architectural split, not an oversight
Vitest coverage is domain-layer only (`src/features/**`, `src/lib/**`). This project's
Vite/Rolldown-based Vitest pipeline **cannot** parse React Native's Flow-typed source
(`react-native/index.js` fails `RolldownError: Flow is not supported`) — no RN-component-rendering
tool (`react-test-renderer`, `@testing-library/react-native`) works here without a new Babel/Flow
transform (spiked and reverted, confirmed not viable within scope). The working pattern: extract
decision logic into pure/ported modules Vitest can import directly, leave JSX/rendering to
Playwright (`apps/frontend/e2e/`, against the Expo **web** target — the only rendering-level test
surface in this repo). `test/` mirrors `src/` 1:1 (`test/features/`, `test/lib/`).

## Gotchas
- `@sentry/react-native`'s Expo config plugin unconditionally wraps the Xcode "Bundle React
  Native code" build phase with `sentry-cli`, which hard-fails without a configured org/project —
  no declarative plugin option to disable it, and `ios`/`android` dirs are gitignored/regenerated
  by prebuild each run. Fixed via `SENTRY_DISABLE_AUTO_UPLOAD=true` prefix on the `ios`/`android`
  npm scripts (the only fix that's both committed and prebuild-proof).
- Frontend TypeScript is `~6.0.3`, different from root/shared/backend's `^7.0.2` — Expo pins this.
- CORS: `apps/frontend`'s `api-client.ts` is a plain `fetch()` wrapper with no CORS-specific
  handling — a CORS failure surfaces through the existing `offline` catch branch like any other
  network failure; CORS itself is owned backend-side (`hono/cors` in `index.ts`).
- RevenueCatUI is native-only. Web/Expo Go paths must use the existing availability guard/fallback;
  sandbox purchase completion remains a physical development-build verification, not Playwright.
