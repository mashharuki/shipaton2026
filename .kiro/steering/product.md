# Product Overview

`shipaton2026` is a monorepo for **SeatSignal**, an entry in RevenueCat's **Shipaton** hackathon.
SeatSignal is a commuter-train companion app: instead of optimizing for fastest/cheapest route
like conventional transit apps, it predicts expected standing/seating time and physical/mental
comfort for a route, and lets a user trade a few extra minutes for a meaningfully more comfortable
ride. It does not reserve seats — it predicts the probability of getting one and recommends action
(which train, car, boarding position). Full concept doc: `docs/memo.md`. Approved feature spec:
`.kiro/specs/seat-signal/{requirements,design,tasks}.md` (all three approved,
`ready_for_implementation: true`).

## Core Capabilities

- Route comparison across "fastest / balanced / most comfortable" options for a fixed
  origin–destination pair, each annotated with expected standing minutes, seating probability, and
  prediction confidence — not just arrival time.
- **Expected Standing Minutes (ESM)** as the differentiating, academically-grounded core metric,
  computed from timetable data, ridership patterns, weather/events/delays, and anonymized
  user feedback (see `packages/shared/src/prediction/scoring.ts` for the scoring model).
- In-app monetization via RevenueCat (Pro tier), gating unlimited search / weekly comfort
  reports / multiple saved routes — the intended core mechanic for the Shipaton submission.

## Target Use Cases

- Daily commuters on a fixed weekday rush-hour route who value predictable comfort over shaving a
  few minutes off arrival time.
- Riders for whom standing is a real cost (older adults, parents with children, large luggage,
  anyone who can't comfortably stand for a long ride).

## Value Proposition

Existing route-search and transit apps optimize for time/cost/congestion snapshots; none turn that
into an actionable, personalized comfort prediction with an honest confidence signal. SeatSignal's
differentiators: a single legible metric (ESM), privacy-first data collection (no per-individual
tracking, short-lived trip IDs, on-device aggregation, k-anonymity thresholds before displaying
predictions), and an explicit refusal to assert precision the underlying data doesn't support
(range/rank display below a confidence threshold instead of a false point estimate).

## Scope Discipline

A red-team/pre-mortem review (`docs/pm/review-seatsignal-idea-2026-08-04.md`, verdict: Conditional
Go) identified the plan's load-bearing unvalidated assumptions and attached kill-criteria to each.
Before expanding product scope, check that review — it currently constrains the MVP to one line,
no transfers, 5–10 stations, weekday rush hours, and treats per-car (号車別) seating detail as
the least-validated Pro feature rather than its core value driver.

---
_Focus on patterns and purpose, not exhaustive feature lists_
_Last synced with codebase: 2026-08-04 (kiro-steering sync — see `.kiro/specs/seat-signal/` and `docs/pm/review-seatsignal-idea-2026-08-04.md`)_
