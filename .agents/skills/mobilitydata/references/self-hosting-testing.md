# Self-Hosting & Testing Conventions

Source: github.com/MobilityData/mobility-feed-api README, github.com/MobilityData/mobility-database-catalogs,
github.com/MobilityData/gtfs-validator, github.com/MobilityData/gbfs-validator (confirmed Aug 2026).

## mobility-feed-api architecture

- **Language/framework**: Python 3.11, FastAPI, generated **spec-first** — the OpenAPI YAML
  (`docs/DatabaseCatalogAPI.yaml` etc.) is the source of truth; running the generator produces stub
  code into `src/feeds_gen`, and hand-written logic lives in `src/feeds/impl`. If modifying the API
  shape, edit the YAML first and regenerate, don't hand-edit the generated stubs directly.
- **Database**: PostgreSQL, migrations via Liquibase.
- **Hosting**: Google Cloud Platform — the repo has `functions/`, `functions-python/`,
  `functions-data/`, and `bigquery/` directories reflecting a Cloud Functions-based architecture,
  plus `infra/` and `workflows/` for deployment.

## Self-hosting: local dev is genuinely documented

The README gives a real, usable local development setup:

```bash
# Postgres via Docker Compose
docker compose up -d   # (or equivalent per the repo's compose file)

# Generate API stubs from the OpenAPI spec
./scripts/api-gen.sh

# Generate/migrate the database schema
./scripts/db-gen.sh

# Populate with a sources CSV
./scripts/populate-db.sh <sources.csv>

# Start the API locally
./scripts/api-start.sh
```

(Confirm exact script names/flags against the current README before running — script names are the
kind of detail that drifts between repo versions.)

**Production self-hosting is not documented as a generic guide.** `docs/GCP.md` exists but describes
MobilityData's own GCP infrastructure, not a "how to deploy this yourself on arbitrary
infrastructure" walkthrough. If a user wants to self-host a production instance, set the expectation
that they're adapting MobilityData's own deployment (GCP-specific: Cloud Functions, Cloud SQL-style
Postgres) rather than following an official generic-cloud guide.

## Testing conventions by repo

- **`mobility-feed-api`**:
  - Style: Flake8 + Black, enforced via pre-commit hooks.
  - CI: GitHub Actions ("Deploy Feeds API - QA," "Build and Test").
  - `integration-tests/` — real Python integration tests (using `requests`, `pandas`, `gtfs_kit`,
    `rich`) that run against an actual running instance, not mocks. Distinct from unit tests.
  - `load-test/` — a separate load-testing directory, a third test tier beyond unit/integration.
  - Practical implication: when deciding what to run for a given change, treat these as three
    genuinely different tiers (unit → fast, integration → needs a running instance, load → slow/
    infra-dependent) rather than one undifferentiated "run the tests" step.

- **`mobility-database-catalogs`**:
  - `tests/test_integration.py` — schema and integration checks that gate every PR to the catalog
    data. Run this locally before opening a PR (see `catalogs-contributing.md`) rather than
    discovering a schema violation only after CI runs.

- **`gtfs-validator`**:
  - Build: Gradle.
  - CI stages: "Test Package Document," "End to end," **"Rule acceptance tests"** (runs against
    real datasets pulled from the live Mobility Database — a strong signal that validator
    regressions are caught against real-world feed diversity, not just synthetic cases), plus a
    Docker image build/publish stage.

- **`gbfs-validator`**:
  - Node.js/Yarn, GitHub Actions CI confirmed present.
  - Exact JS test runner (Jest, Mocha, etc.) was **not confirmed** in this skill's research — check
    `package.json`/the CI workflow file directly if contributing tests here, don't assume a specific
    framework.

## Why this matters for someone consuming the API/tools rather than contributing to them

Even if the goal is just "call the Mobility Database from my app" rather than contributing upstream,
knowing these testing tiers exist is useful context: it means the API and validators are tested
against real, messy, real-world transit data (not just clean synthetic fixtures), which is part of
why their validation output can reasonably be trusted as representative of real-world feed quality —
but it also means their behavior can shift as real-world data changes, reinforcing the point in
`SKILL.md`'s Test section about not treating validation results as permanently static.
