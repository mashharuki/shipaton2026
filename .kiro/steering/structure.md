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
**Location**: `apps/backend/src/`
**Purpose**: Cloudflare Worker source. Today this is a single `index.ts` that default-exports the
`Hono` app instance, which Wrangler runs as the fetch handler. New routes should validate against
`shared`'s zod schemas (`schemas/api.schema.ts`, `schemas/dataset.schema.ts`) rather than
redefining request/response shapes locally.
**Example**: `apps/backend/src/index.ts`

### Frontend routes (file-based)
**Location**: `apps/frontend/src/app/`
**Purpose**: `expo-router` file-based routing — each file is a screen/route, `_layout.tsx` defines
shared layout/navigation for its directory.
**Example**: `src/app/index.tsx` (home route), `src/app/explore.tsx`, `src/app/_layout.tsx`

### Frontend components
**Location**: `apps/frontend/src/components/`
**Purpose**: Shared UI. Platform-specific variants use a `.web.tsx` suffix resolved automatically
by Metro/Expo (e.g. `app-tabs.tsx` + `app-tabs.web.tsx`). Lower-level UI primitives live under
`components/ui/`.
**Example**: `themed-text.tsx`, `themed-view.tsx`, `ui/collapsible.tsx`

### Frontend hooks & constants
**Location**: `apps/frontend/src/hooks/`, `apps/frontend/src/constants/`
**Purpose**: Cross-cutting hooks (with `.web.ts` platform variants where needed) and shared
constants like theming.
**Example**: `hooks/use-color-scheme.ts` + `hooks/use-color-scheme.web.ts`, `constants/theme.ts`

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

The backend has no path aliases yet (single-file scaffold).

## Code Organization Principles

- **`packages/shared`**: the barrel (`src/index.ts`) is the only sanctioned import surface; add a
  new export there whenever a new module should be consumable by an app. No build step — TS
  source is imported directly, so there's no dist/ staleness to manage.
- **Backend**: the exported `Hono` app instance is the single integration point — new routes and
  middleware extend this instance; new Cloudflare bindings are declared in `wrangler.jsonc` and
  typed via `pnpm --filter backend cf-typegen`. Request/response validation should go through
  `shared`'s zod schemas via `parseToResult` (`packages/shared/src/utils/validation.ts`).
- **Frontend**: routing is dictated by the filesystem under `src/app/` (expo-router), not a
  central route table — adding a screen means adding a file.

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
_Last synced with codebase: 2026-08-04 (kiro-steering sync)_
