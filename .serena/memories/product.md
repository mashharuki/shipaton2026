# Product — SeatSignal

Commuter train app that predicts **expected standing/seating time and comfort** for a route,
not just fastest/cheapest route (differentiator metric: ESM — Expected Standing Minutes).
Not a seat-reservation service; predicts probability of getting a seat and lets users trade a few
extra minutes for a much more comfortable ride. Full concept: `docs/memo.md`. Spec (approved,
`ready_for_implementation: true`): `.kiro/specs/seat-signal/{requirements,design,tasks}.md`.

## Scope guardrails from the red-team review (`docs/pm/review-seatsignal-idea-2026-08-04.md`)

Conditional-Go verdict with kill-criteria — check this doc before expanding scope:
- Target locked to **1 line, no transfers, 5–10 stations, weekday rush hours** — route search is
  timetable enumeration + ESM comparison, not a real routing engine.
- Per-car (号車別) seating detail is explicitly the least-validated data source — do not treat it
  as core Pro value until real-world sampling shows a stable pattern; Pro value should center on
  unlimited search / weekly report / multi-route save instead.
- Standing-time prediction: MAE target ≤ 8min from real sampling; below a confidence threshold,
  show a range/rank instead of a point estimate — never assert precision the data doesn't support.
- ODPT (open transit data) commercial-use licensing/attribution must be confirmed before shipping
  a paid app on it — treat as a release blocker, not a nice-to-have.
- App Store subscription review buffer: target submission 14 days before the Shipaton deadline.

## Implementation status (check `.kiro/specs/seat-signal/tasks.md` for current truth)

Phase 1 ("共有基盤" — shared foundation) is the only phase complete: shared Result/error utils,
API/dataset/analytics-events zod schemas, prediction scoring pure functions (all in
`packages/shared/src/`), and the CI pipeline. Phases 2–7 (backend Workers/D1/KV infra & routes,
frontend screens, monetization/paywall, notifications, i18n, store submission) are **not started**
— `apps/backend/src/index.ts` is still the Hono starter route, `apps/frontend/src/app/` is still
the Expo template screen. Don't assume routes, screens, or bindings exist beyond what's in
`packages/shared`.

## Key domain types (packages/shared/src)

- `prediction/scoring.ts` — `scorePrediction()`: combines base load + day-type/weather/event
  adjustments + feedback correction + delay into a standing-minutes estimate; confidence
  (`low`/`medium`/`high`) derived from `sampleSize` vs `CONFIDENCE_SAMPLE_THRESHOLDS`; low/medium
  confidence returns a `{rangeMin, rangeMax}` estimate instead of a point value (enforces the MAE
  guardrail above at the type level).
- `schemas/api.schema.ts`, `schemas/dataset.schema.ts`, `schemas/analytics-events.ts` — zod
  contracts for the not-yet-built backend API, dataset ingestion, and analytics events. Treat
  these as the source of truth for backend route shapes when Phase 2/3 tasks are implemented.
- `constants/plan-limits.ts` — free-tier limits + `PRO_ENTITLEMENT_ID` (RevenueCat entitlement
  key referenced from constants, not hardcoded per call site).
- `errors/` — `ErrorCode` union + `AppError` + `createAppError`/`toAppError`/`isAppError`, per the
  Result-pattern convention in `.claude/rules/code-style.md`.
