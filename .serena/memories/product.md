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

Phases 1–5 done: shared foundation (Result/errors/schemas/scoring), backend Workers infra + all 5
API routes + aggregation/notification cron logic + OpenAPI generation, frontend app shell +
dataset sync + i18n + analytics client + Playwright infra, and the core loop (preferences → route
search → prediction → 3-route comparison → route-detail/boarding-position screens). Not started:
phase 6 (RevenueCat subscription/paywall — `packages/shared`'s `PRO_ENTITLEMENT_ID`/plan-limit
constants exist as the contract only), phase 7 (Live Comfort Coach + ride feedback), phase 8
(saved routes/push notification client/weekly report), phase 9 (onboarding/settings/attribution),
phase 10 (integration/E2E/sandbox-billing verification).

Known unresolved gap (see tasks.md Implementation Notes, tasks 2.2/3.4/3.7): `wrangler.jsonc`
configures daily + 5-min Cron Triggers and both batch jobs are implemented+tested as callable
functions, but `apps/backend/src/index.ts` has no `scheduled` export — neither cron actually fires
in a real deployment yet. Needs human sign-off on which task owns adding it.

## Key domain types (packages/shared/src)

- `prediction/scoring.ts` — `scorePrediction()`: combines base load + day-type/weather/event
  adjustments + feedback correction + delay into a standing-minutes estimate; confidence
  (`low`/`medium`/`high`) derived from `sampleSize` vs `CONFIDENCE_SAMPLE_THRESHOLDS`; low/medium
  confidence returns a `{rangeMin, rangeMax}` estimate instead of a point value (enforces the MAE
  guardrail above at the type level). Consumed directly by backend's `services/prediction.ts` and
  frontend's `features/prediction/prediction-engine.ts` — same function, both runtimes.
- `schemas/api.schema.ts`, `schemas/dataset.schema.ts`, `schemas/analytics-events.ts` — zod
  contracts, now the live backend route/dataset/analytics-event shapes (not aspirational).
- `constants/plan-limits.ts` — free-tier limits + `PRO_ENTITLEMENT_ID` (RevenueCat entitlement
  key referenced from constants, not hardcoded per call site) — still unconsumed until phase 6.
- `errors/` — `ErrorCode` union + `AppError` + `createAppError`/`toAppError`/`isAppError`, per the
  Result-pattern convention in `.claude/rules/code-style.md`.
