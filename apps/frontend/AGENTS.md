# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Context

This app (`apps/frontend`, Expo Router, `src/app/`) is still the Expo template scaffold — the
product is **SeatSignal**, see root `CLAUDE.md` and `.kiro/specs/seat-signal/`. Frontend
implementation (Phase 4+ of `.kiro/specs/seat-signal/tasks.md`) hasn't started yet.

`shared` (workspace package, `"shared": "workspace:*"` dep) is already available: use its
prediction types (`packages/shared/src/prediction/scoring.ts`), zod schemas
(`packages/shared/src/schemas/`), `Result`/`AppError` helpers, and plan-limit constants
(`PRO_ENTITLEMENT_ID`, free-tier limits) rather than redefining them in this app.
