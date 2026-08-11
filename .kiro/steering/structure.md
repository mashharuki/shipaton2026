# Project Structure

## Organization Philosophy

pnpm workspace monorepo split by deployable/shareable unit, not by layer: `apps/backend` and
`apps/frontend` are independent apps with their own `package.json`/`tsconfig.json`, and
`packages/shared` is a build-free domain package both depend on via the workspace protocol
(`"shared": "workspace:*"`). All three share only root-level tooling (Biome, knip, pnpm workspace
config, CI).

## Directory Patterns

### Shared domain package
**Location**: `packages/shared/src/`
**Purpose**: Cross-app TypeScript logic with no runtime framework dependency — pure functions,
zod contract schemas, error/result types, constants. Organized by domain concern
(`prediction/`, `schemas/`, `errors/`, `constants/`, `utils/`), each re-exported from a single
`src/index.ts` barrel — that barrel is the only import surface consumers should use
(`import { scorePrediction } from "shared"`, not deep paths into `packages/shared/src/...`).
Every module has a mirrored test file under `packages/shared/test/`.
**Example**: `src/prediction/scoring.ts` (pure scoring function) + `test/prediction/scoring.test.ts`

### Backend Worker entry
**Location**: `apps/backend/src/index.ts`
**Purpose**: Single assembly point — instantiates the `OpenAPIHono` app, mounts CORS + `x-api-key`
auth middleware, registers each route module (`app.route("/", xRoute)`), and owns document-level
OpenAPI metadata (`securitySchemes`, `servers`, exported as `openApiConfig` for
`scripts/generate-openapi.ts` to reuse). By convention (`tasks.md` task 2.2), individual API tasks
own only their route module, not this assembly file — treat edits to `index.ts` itself as a
cross-cutting change, not something a single route/feature task should casually make.
**Example**: `apps/backend/src/index.ts`

### Backend routes, services, db, cron
**Location**: `apps/backend/src/{routes,services,db,cron,middleware}/`
**Purpose**: One route module per API resource under `routes/` (`datasets.ts`, `feedback.ts`,
`events.ts`, `train-status.ts`, `push-registrations.ts`), validating against `shared`'s zod
schemas rather than redefining shapes locally. `services/` holds business logic the routes/cron
call into (`prediction.ts`, `odpt-client.ts`, `feedback-aggregator.ts`, `push-sender.ts`).
`db/queries.ts` is the only place raw D1 SQL lives — parameterized, typed, returning `Result`.
`db/migrations/NNNN_name.sql` is the D1 migrations directory (also wired as
`d1_databases[].migrations_dir` in `wrangler.jsonc` for both `vitest-pool-workers` and
`wrangler d1 migrations apply`). `cron/` holds scheduled-batch entry points
(`aggregate-feedback.ts`, `notify-commuters.ts`) written as directly-callable, directly-testable
functions — see [[tech]] for the still-open gap where nothing invokes them via a real `scheduled`
handler yet.
**Example**: `src/routes/feedback.ts`, `src/services/prediction.ts`, `src/db/queries.ts`,
`src/cron/notify-commuters.ts`

### Frontend routes (file-based)
**Location**: `apps/frontend/src/app/`
**Purpose**: `expo-router` file-based routing — each file is a screen/route, `_layout.tsx` defines
shared layout/navigation for its directory. `(tabs)/` is a route group for the 3-tab shell
(home/report/settings); everything else is a pushed screen outside the tabs, reached from a tab or
from another pushed screen — `onboarding.tsx`, `results.tsx`, `route-detail.tsx`, `coach.tsx`,
`feedback.tsx`, `paywall.tsx`. A subdirectory groups a tab's own pushed sub-screens the same way
`(tabs)/` groups the tab shell: `settings/licenses.tsx`, `settings/notifications.tsx`,
`settings/privacy.tsx` are all reached from `(tabs)/settings.tsx`.
**Example**: `src/app/(tabs)/index.tsx` (home tab), `src/app/results.tsx`, `src/app/paywall.tsx`,
`src/app/settings/privacy.tsx`, `src/app/_layout.tsx`

### Frontend feature domain logic
**Location**: `apps/frontend/src/features/<feature>/`
**Purpose**: Pure/testable business logic per feature area — search, prediction, preferences,
dataset sync, subscription, coach, feedback, onboarding, saved-routes, trip-history — kept separate
from screens specifically so Vitest can exercise it (see [[tech]]'s note on why RN component
rendering isn't testable here). A feature typically pairs a store/engine/repository file with a
`use-*.ts` hook that screens call; I/O boundaries (SQLite, storage, the RevenueCat SDK) are
abstracted behind a typed port (e.g. `dataset-store.ts`, `purchases-client.ts`) so the logic file
itself has no native dependency.
**Example**: `features/search/route-search-engine.ts` + `use-route-search.ts`,
`features/dataset/dataset-repository.ts` + `dataset-store.ts` (port),
`features/subscription/purchases-client.ts` (port) + `subscription-gate.ts` + `use-purchases.ts`

### Frontend lib (cross-cutting infrastructure)
**Location**: `apps/frontend/src/lib/`
**Purpose**: App-wide infrastructure not specific to one feature: `api-client.ts` (fetch wrapper
normalizing errors to shared's `ErrorCode`s), `db.ts`/`kv-store.ts` (SQLite/storage setup),
`i18n.ts` (i18next init, resources from `src/locales/{ja,en}.json`), `analytics.ts` (batched event
client), `error-display.ts` (`AppError` → i18n message key + retry affordance, pure/testable —
`error-state.tsx` in `components/` is the untested JSX consumer of it).
**Example**: `lib/api-client.ts`, `lib/i18n.ts`, `lib/error-display.ts`

### Frontend state stores
**Location**: `apps/frontend/src/stores/`, and store files inside `features/<feature>/`
**Purpose**: `zustand` stores. Ephemeral UI state (e.g. theme preference) uses plain `create()` in
`stores/`; durable per-feature state uses `persist` + `createJSONStorage` over `lib/kv-store.ts`
and lives inside its feature directory (e.g. `features/preferences/preference-store.ts`) rather
than in the shared `stores/` folder.
**Example**: `stores/theme-store.ts` (ephemeral), `features/preferences/preference-store.ts`
(persisted)

### Frontend components, hooks & constants
**Location**: `apps/frontend/src/components/`, `src/hooks/`, `src/constants/`
**Purpose**: Shared UI components (screens compose these, business logic stays in `features/`).
Platform-specific variants use a `.web.tsx`/`.web.ts` suffix resolved automatically by Metro/Expo.
**Example**: `components/route-card.tsx`, `hooks/use-color-scheme.ts` +
`hooks/use-color-scheme.web.ts`, `constants/theme.ts`

### Spec-driven feature work
**Location**: `.kiro/specs/<feature-name>/`
**Purpose**: Approved requirements/design/tasks for a feature, generated and tracked via the Kiro
spec workflow (`spec.json` tracks approval + implementation-readiness). `tasks.md` checkboxes are
the current source of truth for "what's actually built" — don't assume a feature's scope is
implemented just because it's in `docs/memo.md` or `requirements.md`.
**Example**: `.kiro/specs/seat-signal/`

### Cross-repo agent context
**Location**: `.claude/rules/`, `.kiro/steering/`, `.kiro/specs/`
**Purpose**: `.claude/rules/` holds engineering rules (git workflow, code style, testing, security)
applied repo-wide by Claude Code. `.kiro/steering/` (this directory) is persistent project memory.
`.kiro/specs/` holds spec-driven feature work.

## Naming Conventions

- **Files**: kebab-case everywhere (`themed-text.tsx`, `use-color-scheme.ts`,
  `animated-icon.module.css`, `scoring.ts`, `api.schema.ts`)
- **Platform variants**: `.web.tsx` / `.web.ts` suffix for a web-specific implementation alongside
  the native default
- **Components**: PascalCase export name inside a kebab-case file
- **Shared package modules**: singular domain-noun directories (`prediction/`, `errors/`), each
  with a `*.schema.ts` suffix for zod schema files specifically (vs. plain `.ts` for logic/types)

## Import Organization

```typescript
// Frontend — path alias resolves to src/
import { ThemedText } from "@/components/themed-text";

// Cross-workspace — via the shared package's barrel export, never a deep path
import { scorePrediction, PRO_ENTITLEMENT_ID } from "shared";

// Relative import for same-directory/local files
import { useColorScheme } from "./use-color-scheme";
```

**Path Aliases** (`apps/frontend/tsconfig.json`):
- `@/*` → `src/*`
- `@/assets/*` → `assets/*`

The backend uses relative imports throughout (`./routes/...`, `../db/queries`) — no path alias
configured.

## Test Structure

Both `apps/backend/test/` and `apps/frontend/test/` mirror their `src/` tree 1:1 by subdirectory
(`test/routes/`, `test/services/`, `test/cron/` in backend; `test/features/`, `test/lib/` in
frontend) — put a new test at the same relative path as the module it covers. Frontend E2E lives
separately in `apps/frontend/e2e/` (Playwright, not vitest). See [[tech]] for what each layer is
allowed to test (backend hits real D1/KV via `vitest-pool-workers`; frontend vitest is
domain-logic-only, rendering is Playwright's job).

## Code Organization Principles

- **`packages/shared`**: the barrel (`src/index.ts`) is the only sanctioned import surface; add a
  new export there whenever a new module should be consumable by an app. No build step — TS
  source is imported directly, so there's no dist/ staleness to manage.
- **Backend**: `src/index.ts` is the single assembly point (see above) — new routes/middleware
  extend it there, but individual route/feature work should stay inside its own `routes/`,
  `services/`, or `cron/` module rather than editing the assembly file. New Cloudflare bindings are
  declared in `wrangler.jsonc` and typed via `pnpm --filter backend cf-typegen`. Request/response
  validation goes through `shared`'s zod schemas via `parseToResult`
  (`packages/shared/src/utils/validation.ts`).
- **Frontend**: routing is dictated by the filesystem under `src/app/` (expo-router), not a
  central route table — adding a screen means adding a file. Business logic goes in
  `src/features/<feature>/`, not inline in the screen component, so it stays Vitest-testable.

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
_Last synced with codebase: 2026-08-11 (kiro-steering sync)_
