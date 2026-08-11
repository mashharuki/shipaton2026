# GTFS Validator & GBFS Validator

Source: github.com/MobilityData/gtfs-validator , github.com/MobilityData/gbfs-validator
(confirmed Aug 2026). Two separate tools, separate languages, separate invocation surfaces — don't
conflate them or assume one handles the other's format.

## GTFS Validator (static/schedule GTFS)

- Described explicitly as the **"Canonical GTFS Validator project for schedule (static) files,"**
  maintained by MobilityData — this is the reference implementation the ecosystem treats as
  authoritative for GTFS spec compliance, not one validator among many.
- **Language**: Java.
- **Invocation surfaces**:
  - Web UI: `https://gtfs-validator.mobilitydata.org/`
  - Desktop installers: Windows `.msi`, Mac `.dmg`, Linux `.deb`
  - CLI via JAR
  - Docker image
- **CI/testing** (relevant if debugging validator behavior or contributing): GitHub Actions run
  "Test Package Document," "End to end," and a "Rule acceptance tests" stage — the acceptance-test
  stage specifically runs against **real datasets pulled from the Mobility Database**, not just
  synthetic fixtures. If a validator result looks wrong for a specific real-world feed, that's
  exactly the kind of case the project's own test suite is built to catch — worth checking whether
  an open issue already covers that feed's data before assuming a bug of your own.
- Built with Gradle.

## GBFS Validator (bikeshare/micromobility GBFS)

- **"The canonical GBFS validator, maintained by the GBFS community, facilitated by MobilityData."**
  Same "reference implementation" status as the GTFS validator, for the GBFS spec instead.
- **Language**: Node.js (≥14.x; 18.x recommended), Yarn-based.
- **Invocation surfaces**:
  - Web UI: `https://gbfs-validator.mobilitydata.org/`
  - CLI: `node ./gbfs-validator/cli.js <gbfs.json URL>`
- Validates against the official GBFS JSON Schemas; has a documented `RULES.md` listing the
  specific rules it checks.
- GitHub Actions CI is present in the repo; the exact test runner (Jest/Mocha/etc.) was not
  confirmed in this skill's research — check the repo's `package.json`/CI workflow directly if you
  need to reproduce or extend its test suite.

## How results connect back to the Mobility Database

Confirmed via source inspection of `mobility-feed-api`: a Cloud Function at
`functions-python/process_validation_report/` is triggered with `{dataset_id, feed_id,
validator_version}`, fetches the corresponding validation report JSON, and writes
validation-report/feature/notice records into the database tied to that dataset. A parallel
`functions-python/gbfs_validator/` directory indicates the same pattern exists for GBFS results.

**What's confirmed**: validation results genuinely do flow into the Database and become visible via
the API (e.g. as part of a feed/dataset's returned fields).
**What's not confirmed**: the exact trigger — who calls this function and how often (on every
catalog update? on a schedule? on-demand only?). Don't tell a user "your feed will be re-validated
within X hours of an update" without checking current behavior; say the mechanism exists but the
cadence isn't confirmed.

## Practical guidance

- **Running either validator directly requires no Mobility Database account, no auth, and no feed
  registration.** The CLI/Docker/web-UI invocations above work standalone against any GTFS/GBFS
  file or URL you point them at. This matters for validating a **private/internal feed you don't
  want public**: registering a feed in `mobility-database-catalogs` (see `catalogs-contributing.md`)
  makes it part of the public catalog, so for an internal tool that just needs spec-compliance
  checking, run the validator directly and skip registration entirely rather than registering a
  feed only to get validation results.
- If the question is "is my GTFS feed spec-compliant," running the GTFS Validator directly (CLI or
  Docker) is faster than registering the feed and waiting for the Database's own validation
  pipeline anyway — use direct validation for iterative development, and treat the Database's
  validation report as the eventually-consistent public record only for feeds that are actually
  meant to be public.
- Same logic applies to GBFS: validate directly against a feed URL during development rather than
  registering-then-waiting.
- Don't assume a feed passing the GTFS Validator's structural checks means it also passes every
  "best practices" style check — some GTFS validators (e.g. `transitland-lib`'s `validate` command,
  see this repo's `transitland` skill if present) separate strict structural validity from optional
  best-practice recommendations behind a flag. Check whether an equivalent distinction exists in the
  current MobilityData GTFS Validator version/docs before assuming a report covers both by default.
