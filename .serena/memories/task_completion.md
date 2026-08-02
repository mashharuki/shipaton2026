# Task Completion Checklist

No test runner exists in this repo yet (no vitest/jest config found at onboarding time) — do not
assume `pnpm test` works anywhere; verify first if a task later adds tests.

Before considering a coding task done:
1. `pnpm format` (Biome write) and `pnpm check` (Biome lint) from repo root — covers both
   `apps/frontend` and `apps/backend` since Biome runs over the whole repo, not per-package.
2. `pnpm knip` — check no new unused exports/files/deps were introduced (tag with a lintignore
   comment per `mem:conventions` if intentionally unused).
3. Frontend-only changes: also run `pnpm --dir apps/frontend lint` (`expo lint`).
4. Backend-only changes touching `wrangler.jsonc` bindings: run
   `pnpm --dir apps/backend cf-typegen` to refresh `CloudflareBindings` types before typechecking.
5. For any visible UI change in the frontend, actually run the app (simulator/emulator/web) and
   exercise the change — per root CLAUDE.md instructions, don't claim UI success from
   lint/typecheck alone.
