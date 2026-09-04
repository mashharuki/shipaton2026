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

Implemented: phases 1–9, automated integration (10.1/10.2), and data-redesign milestones M1,
M2, M5. This includes native RevenueCat/Paywall integration (with web-safe fallback), Live Comfort
Coach + feedback/history, saved routes/push/report, onboarding/settings/attribution, and the
Playwright core flows. `apps/backend/src/index.ts` now attaches a `scheduled` handler to the same
`OpenAPIHono` export; it dispatches the two configured cron expressions using `scheduledTime` and
is covered by `test/scheduled.test.ts`.

Remaining work is external verification rather than missing core implementation: 10.3 physical
device E2E, 10.4 sandbox purchase E2E, M3 live Transitland/Toei GTFS import, and M4 live TfNSW
occupancy validation. M3/M4 code and fixture tests exist, but require provider credentials and
outbound network access. M5 verifies the accuracy pipeline with fixtures only; it does not prove
Tokyo model accuracy.

## Key domain types (packages/shared/src)

- `prediction/scoring.ts` — `scorePrediction()`: combines base load + day-type/weather/event
  adjustments + feedback correction + delay into a standing-minutes estimate; confidence
  (`low`/`medium`/`high`) derived from `sampleSize` vs `CONFIDENCE_SAMPLE_THRESHOLDS`; low/medium
  confidence returns a `{rangeMin, rangeMax}` estimate instead of a point value (enforces the MAE
  guardrail above at the type level). Consumed directly by backend's `services/prediction.ts` and
  frontend's `features/prediction/prediction-engine.ts` — same function, both runtimes.
- `schemas/api.schema.ts`, `schemas/dataset.schema.ts`, `schemas/analytics-events.ts` — zod
  contracts, now the live backend route/dataset/analytics-event shapes (not aspirational).
- `constants/plan-limits.ts` — free-tier limits + `PRO_ENTITLEMENT_ID`, consumed by the frontend
  subscription gate/paywall flow rather than hardcoded per call site.
- `prediction/comfort.ts` — region-neutral `ComfortEstimate` contract; `accuracy.ts` compares
  measured/modelled pairs (MAE, bias, carriage-rank correlation) and degrades to rank-only over
  `MAE_DEGRADE_THRESHOLD_MINUTES` (10). `transit/` holds fail-closed feed-license and occupancy
  primitives.
- `errors/` — `ErrorCode` union + `AppError` + `createAppError`/`toAppError`/`isAppError`, per the
  Result-pattern convention in `.claude/rules/code-style.md`.
