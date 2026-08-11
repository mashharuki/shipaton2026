# Testing

Source: https://docs.opentripplanner.org/en/latest/Developers-Guide/ (confirmed Aug 2026). Two
different things get called "testing OTP" — separate them before advising.

## A. Testing the OTP codebase itself

Relevant if the user is contributing to OpenTripPlanner, maintaining a fork, or verifying a custom
build compiles and passes its own suite.

- `mvn package` — downloads dependencies, builds, and runs the test suite. This is the standard
  entry point; there's no separate documented "just run tests" shortcut beyond normal Maven
  test-phase commands (`mvn test`).
- `mvn clean -Pclean-test-snapshots` — resets snapshot test fixtures. OTP uses snapshot testing for
  itinerary/API output validation: expected results are stored as versioned `.snap` files and
  compared against actual output on each run. If a legitimate routing-behavior change makes
  snapshots fail, this is the command to regenerate them — but do that deliberately, not
  reflexively, since it can also paper over a real regression.
- **OSM fixture convention**: unit tests that need real geographic data use the *smallest possible*
  extract — docs specify "should not contain more than a few hundred ways." Trim extracts with
  `osmium-extract` / `osmium filter-tags` (osmium-tool) rather than checking in a full-city or
  full-region PBF. This matters for anyone writing new tests against OTP internals: a multi-MB OSM
  file in a test fixture is a sign something's wrong.
- **Process**: two approvals required from the OTP Review Team before merge; GitHub Actions CI
  validates compile + tests; dates in commit/config content should be ISO 8601.
- A "speed test" tool is referenced in the docs navigation under Development but its specifics were
  **not verified** in the research pass behind this skill — fetch
  `https://docs.opentripplanner.org/en/latest/` and look under the Development section for the
  current page before citing details about it.
- No documented Docker-based test-fixture pattern was found for the core test suite — don't assume
  one exists without checking.

## B. Testing a system that *uses* OTP

Relevant for an app/backend that queries a running OTP instance as an external dependency — this is
ordinary integration testing, not something OTP has special tooling for. Apply the project's normal
testing conventions (see this repo's own `.claude/rules/testing.md` for the general rules — mock at
module boundaries, factory functions for test data, etc. — OTP doesn't get a carve-out from those).

Practical approach:

1. **Build a small, fast, deterministic fixture graph** rather than testing against a full
   production-scale region. Apply the same "smallest useful extract" discipline the OTP project
   itself uses for its own tests (see part A) — a tiny OSM extract plus a trimmed GTFS feed covering
   just the origin/destination pairs the tests actually exercise.
2. **Stand up OTP as a real dependency for integration tests**, not a mock of its GraphQL responses
   — the value of testing against OTP is catching real routing/config regressions, which a
   hand-written mock response can't do. Reserve mocking for unit tests of code that merely *consumes*
   an OTP response shape (e.g. a formatter or UI component), per the "mock at module boundaries, not
   internal functions" rule.
3. **Assert on stable properties, not exact itinerary text**: transit routing output can shift with
   schedule updates, real-time delays, or minor OTP version changes even when the code under test is
   unchanged. Prefer assertions like "at least one itinerary exists," "the itinerary uses mode X,"
   "duration is under N minutes," "arrives before the requested constraint" over asserting an exact
   step-by-step itinerary string — the latter is brittle and will flake on OTP/data updates unrelated
   to the code being tested.
4. **Pin the OTP version and fixture data** used in CI so failures are attributable to the code
   change under test, not an upstream OTP or schedule-data drift. Rebuild/refresh the fixture graph
   deliberately (like a dependency bump), not silently.
5. **Smoke-test via GraphiQL first** when debugging a failing integration test — reproduce the exact
   failing query by hand against the same instance/fixture before assuming the bug is in the calling
   code. This separates "OTP returned something unexpected" from "our client code parsed the response
   wrong."
