# Project Structure

## Organization Philosophy

pnpm workspace monorepo split by deployable unit, not by layer: `apps/backend` and `apps/frontend` are independent apps with their own `package.json`/`tsconfig.json`, sharing only root-level tooling (Biome, knip, pnpm workspace config). `packages/` exists for future shared code but is currently empty — nothing is extracted there yet.

## Directory Patterns

### Backend Worker entry
**Location**: `apps/backend/src/`
**Purpose**: Cloudflare Worker source. Today this is a single `index.ts` that default-exports the `Hono` app instance, which Wrangler runs as the fetch handler.
**Example**: `apps/backend/src/index.ts`

### Frontend routes (file-based)
**Location**: `apps/frontend/src/app/`
**Purpose**: `expo-router` file-based routing — each file is a screen/route, `_layout.tsx` defines shared layout/navigation for its directory.
**Example**: `src/app/index.tsx` (home route), `src/app/explore.tsx`, `src/app/_layout.tsx`

### Frontend components
**Location**: `apps/frontend/src/components/`
**Purpose**: Shared UI. Platform-specific variants use a `.web.tsx` suffix resolved automatically by Metro/Expo (e.g. `app-tabs.tsx` + `app-tabs.web.tsx`). Lower-level UI primitives live under `components/ui/`.
**Example**: `themed-text.tsx`, `themed-view.tsx`, `ui/collapsible.tsx`

### Frontend hooks & constants
**Location**: `apps/frontend/src/hooks/`, `apps/frontend/src/constants/`
**Purpose**: Cross-cutting hooks (with `.web.ts` platform variants where needed) and shared constants like theming.
**Example**: `hooks/use-color-scheme.ts` + `hooks/use-color-scheme.web.ts`, `constants/theme.ts`

### Cross-repo agent context
**Location**: `.claude/rules/`, `.kiro/steering/`, `.kiro/specs/`
**Purpose**: `.claude/rules/` holds engineering rules (git workflow, code style, testing, security) applied repo-wide by Claude Code. `.kiro/steering/` (this directory) is persistent project memory; `.kiro/specs/` holds spec-driven feature work (empty until a feature spec is started).

## Naming Conventions

- **Files**: kebab-case everywhere (`themed-text.tsx`, `use-color-scheme.ts`, `animated-icon.module.css`)
- **Platform variants**: `.web.tsx` / `.web.ts` suffix for a web-specific implementation alongside the native default
- **Components**: PascalCase export name inside a kebab-case file

## Import Organization

```typescript
// Frontend — path alias resolves to src/
import { ThemedText } from "@/components/themed-text";

// Relative import for same-directory/local files
import { useColorScheme } from "./use-color-scheme";
```

**Path Aliases** (`apps/frontend/tsconfig.json`):
- `@/*` → `src/*`
- `@/assets/*` → `assets/*`

The backend has no path aliases yet (single-file scaffold).

## Code Organization Principles

- **Backend**: the exported `Hono` app instance is the single integration point — new routes and middleware extend this instance; new Cloudflare bindings are declared in `wrangler.jsonc` and typed via `npm run cf-typegen`.
- **Frontend**: routing is dictated by the filesystem under `src/app/` (expo-router), not a central route table — adding a screen means adding a file.

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
