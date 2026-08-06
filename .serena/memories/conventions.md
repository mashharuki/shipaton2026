# Conventions

- Formatting/linting is Biome-only (`biome.json` at root, schema 2.5.6) — not ESLint/Prettier.
  Quote style: double quotes for JS/TS. Import organization auto-applied
  (`assist.actions.source.organizeImports: on`) — don't hand-order imports.
  VCS-aware (`vcs.useIgnoreFile: true`) — respects `.gitignore`.
- Knip config (`knip.json`) uses tag-based ignore: mark intentionally-unused exports with a
  `// lintignore`-tagged comment convention rather than deleting/restructuring for knip's sake.
- Cross-app shared logic goes in `packages/shared` (workspace package name `shared`), consumed as
  `"shared": "workspace:*"` — don't duplicate types/constants/pure functions across
  `apps/frontend`/`apps/backend`. No build step — new exports must be re-exported from
  `packages/shared/src/index.ts` to be consumable.
- Result pattern (`.claude/rules/code-style.md`) implemented in `packages/shared/src/result.ts`
  (`Result<T, E>`, `ok`/`err`/`isOk`/`isErr`) and `packages/shared/src/errors/app-error.ts`
  (`AppError`, `createAppError`/`toAppError`/`isAppError` keyed by `ErrorCode`) — reuse, don't
  invent a parallel shape. Used end-to-end: backend `db/queries.ts` returns `Result`, frontend
  `api-client.ts` normalizes fetch/HTTP/validation failures to `Result<T, AppError>`.
- API/dataset/analytics payload shapes are zod schemas in `packages/shared/src/schemas/` — the
  live contract for backend routes now, not aspirational. Validate at boundaries with
  `parseToResult` (`packages/shared/src/utils/validation.ts`), not raw `.parse()`/`.safeParse()`.
  Schemas needing OpenAPI `$ref`s use zod4 `.meta({id})` (see `ErrorResponse`/`OkResponse`).
- Backend module-ownership convention (`tasks.md` task 2.2): `apps/backend/src/index.ts` is the
  single assembly file (CORS, auth middleware, route mounting, OpenAPI document metadata) —
  individual route/feature work should stay inside its own `routes/`/`services/`/`cron/` module,
  not touch `index.ts`. Treat an `index.ts` edit as cross-cutting.
- Frontend: business/domain logic goes in `src/features/<feature>/` as plain functions/stores
  behind typed ports (e.g. `dataset-repository.ts` depends on a `DatasetStore` port, never
  `expo-sqlite` directly) — this is *why* it's Vitest-testable (see `mem:frontend/core`), keep new
  logic in that shape rather than folding it into a screen component.
- Frontend file naming is kebab-case for components/hooks/features (`themed-text.tsx`,
  `use-color-scheme.ts`, `route-search-engine.ts`), not PascalCase filenames.
- Frontend platform-specific file variants via Expo/Metro resolution: `*.web.tsx`/`*.web.ts`
  override alongside the default (native) file — follow this pattern for platform-diverging code.
- Routing is Expo Router file-based under `apps/frontend/src/app/` (typed routes enabled;
  `(tabs)/` route group for the 3-tab shell) — add screens as files, don't hand-roll a navigator.
- Test dirs mirror `src/` 1:1 by subdirectory in both `apps/backend/test/` and
  `apps/frontend/test/` — put a new test at the same relative path as the module it covers.
- See also root `.claude/rules/code-style.md`, `.claude/rules/testing.md`,
  `.claude/rules/security.md`, `.claude/rules/git-workflow.md` for cross-cutting agent-facing
  conventions — enforced project instructions, read directly when doing related work.
