# Task Completion Checklist

Before considering a coding task done:
1. `pnpm format` (Biome write) and `pnpm check` (Biome lint) from repo root — covers all three
   workspaces (`shared`, `apps/frontend`, `apps/backend`) since Biome runs over the whole repo.
2. `pnpm knip` — check no new unused exports/files/deps were introduced (tag with a lintignore
   comment per `mem:conventions` if intentionally unused).
3. `pnpm --filter <workspace> run typecheck` for any workspace touched (`shared`, `backend`,
   `frontend` each have this script; matches the CI typecheck matrix job).
4. Changes under `packages/shared`: run `pnpm --filter shared test` (vitest) — this is currently
   the only workspace with a real test suite. New/changed domain logic (scoring, schemas, errors)
   should get a corresponding test under `packages/shared/test/`, mirroring `.claude/rules/testing.md`.
5. Frontend-only changes: also run `pnpm --filter frontend lint` (`expo lint`).
6. Backend-only changes touching `wrangler.jsonc` bindings: run
   `pnpm --filter backend cf-typegen` to refresh `CloudflareBindings` types before typechecking.
7. For any visible UI change in the frontend, actually run the app (simulator/emulator/web) and
   exercise the change — per root CLAUDE.md instructions, don't claim UI success from
   lint/typecheck alone.
8. Product-shaping changes (new requirement, scope change, pricing/paywall behavior): check
   against `.kiro/specs/seat-signal/requirements.md` and the kill-criteria in
   `docs/pm/review-seatsignal-idea-2026-08-04.md` (see `mem:product`) before implementing —
   several Must-scope items are explicitly gated on unvalidated assumptions.
9. `.github/workflows/ci.yaml` is the authoritative CI gate — steps 1–4 above mirror it, so a
   clean local run of those should mean CI is green.
