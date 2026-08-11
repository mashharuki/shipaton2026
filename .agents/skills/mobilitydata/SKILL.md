---
name: mobilitydata
description: Use for designing, implementing, and testing systems that use MobilityData's tooling and data — the Mobility Database (mobilitydatabase.org, the official successor to TransitFeeds.com), the Mobility Feed API, the canonical GTFS Validator, the canonical GBFS Validator, or the underlying mobility-database-catalogs feed registry. MobilityData is the nonprofit that actually stewards the GTFS and GBFS specifications themselves (not just a product built on top of them), so trigger this whenever the user mentions MobilityData, the Mobility Database, mobilitydatabase.org, GTFS Validator, GBFS Validator, gbfs.org, mobility-database-catalogs, or wants to look up/validate/register a GTFS, GTFS-RT, or GBFS feed — even if they just say "check if my GTFS feed is valid," "find bike-share feeds for a city," or "is there an official transit data registry" without naming MobilityData explicitly. If the user's project also involves Transitland (Interline.io's separate, similarly-shaped transit feed registry/API — covered by the `transitland` skill in this repo if present), read this skill's "MobilityData vs. Transitland" section before picking one, since they overlap heavily in surface area but differ in authority and licensing.
model: opus
---

# MobilityData

MobilityData is a nonprofit that plays three roles at once, and which role matters changes what
you should reach for:

1. **Spec steward** — it governs the GTFS specification's community change-voting process and, since
   2022, is the official host of the GBFS (bikeshare/micromobility) specification. This is real
   standards-body authority, not just "a company that uses GTFS."
2. **Tooling provider** — it builds and maintains the **canonical GTFS Validator** and **canonical
   GBFS Validator**, the reference implementations the ecosystem treats as ground truth for spec
   compliance.
3. **Registry operator** — it runs the **Mobility Database** (mobilitydatabase.org), the official
   successor to the now-shut-down TransitFeeds.com/OpenMobilityData, aggregating GTFS/GTFS-RT/GBFS
   feed metadata plus their validation results into a searchable catalog and API.

## MobilityData vs. Transitland — pick based on this, not habit

If this repo also has a `transitland` skill, both cover "look up a transit feed via an API," and
it's easy to reach for whichever one you used last without thinking about why. The real
differences:

- **Authority over the spec**: MobilityData literally governs GTFS/GBFS's evolution and ships the
  reference validators. Transitland (Interline.io) is a commercial product built on top of those
  specs with no governance role over them. If validation *correctness against the official spec* is
  what matters, MobilityData's validators are the ones to trust as canonical.
- **Access model**: MobilityData's API requires account signup and OAuth2-style JWT bearer auth
  (access + refresh tokens) for every authenticated call, with no free-vs-paid tier split
  documented — it's one access model. Transitland has a Free/Professional/Enterprise tier split
  where GraphQL is paid-only. If the user needs GraphQL specifically, that's a Transitland
  consideration, not a MobilityData one — no GraphQL layer was found in MobilityData's API.
- **Registry format**: MobilityData's `mobility-database-catalogs` is one JSON file per feed,
  schema-validated in CI. Transitland's `transitland-atlas` uses DMFR, a different flat-file JSON
  schema. Similar spirit (git-hosted, PR-reviewed, machine-readable), different conventions — don't
  assume a file written for one registry format is valid for the other.
- **When both track the same real-world feed**: this can happen (both are aggregating the same
  public GTFS feeds). If a design needs to cross-reference an entity between the two systems, there
  is no shared ID scheme confirmed between them (Transitland's Onestop IDs are Transitland-internal)
  — match on the feed's own producer URL or GTFS-level identifiers, not an assumption that one
  system's ID means anything to the other.

Neither replaces the other; pick MobilityData when spec-authoritative validation or GBFS coverage
matters, pick Transitland when GraphQL or Interline's broader product ecosystem (e.g. OSM Extracts,
if this repo's `opentripplanner`/`transitland` skills are relevant) matters more.

## Before you rely on any specific detail

MobilityData's API and catalogs are actively developed (the catalogs repo, API repo, and both
validators all show recent activity). Facts here were verified against live sources in August 2026
— re-check version-sensitive details (GBFS spec version, exact endpoint list, rate limits) against
`https://github.com/MobilityData/mobility-feed-api` and `https://github.com/MobilityData/gbfs`
before something depends on them being current. One confirmed-ambiguous spec detail worth flagging
proactively: the API's OpenAPI spec defines one endpoint (`POST /v1/licenses:match`) with a
different auth scheme (`ApiKeyAuth`) than everything else (JWT bearer), but never actually defines
what `ApiKeyAuth` is — treat that endpoint's auth as unresolved rather than assuming a second,
undocumented API-key system exists alongside the bearer-token one.

## The three phases

### 1. Design

- **API access vs. bulk catalog vs. self-hosting?**
  - Need live, queryable, per-feed lookups with validation status → the Mobility Feed API
    (`references/mobility-feed-api.md`).
  - Need the whole catalog at once for offline analysis → the published CSV at
    `https://files.mobilitydatabase.org/feeds_v2.csv` (no account needed, per the FAQ) or the raw
    per-feed JSON files in `mobility-database-catalogs` (`references/catalogs-contributing.md`).
  - Need your own instance (custom feed set, air-gapped, contributing upstream) → self-hosting
    `mobility-feed-api` (`references/self-hosting-testing.md`) — genuinely documented for local dev,
    not just aspirational.
- **Do you need GTFS validation, GBFS validation, or both?** These are two separate tools
  (`gtfs-validator` is Java, `gbfs-validator` is Node.js) with two separate invocation surfaces
  (web UI, CLI, Docker for GTFS; web UI, CLI for GBFS). Don't assume one validates the other's
  format. See `references/validators.md`.
- **Registering a new feed?** Two paths exist — a direct PR to `mobility-database-catalogs` (fast,
  requires passing schema/integration tests) or the web contribution form on mobilitydatabase.org
  (slower, MobilityData staff convert it to a PR, documented as roughly a week's turnaround). If the
  user is automating feed registration at any scale, the PR path is the one worth scripting; the
  form path doesn't have an API. See `references/catalogs-contributing.md`.
- **GBFS-specific design decisions**: current spec version is v3.0 (with v3.1 as an
  implementation-ready release candidate) — v3.0 introduced `manifest.json` for operators
  publishing multiple GBFS datasets (e.g. per-city feeds under one provider) and renamed
  `free_bike_status.json` to `vehicle_status.json`. If a design targets an older GBFS deployment,
  confirm which major version it actually implements before assuming v3.0 field/file names apply —
  see `references/gbfs.md`.
- **Auth planning**: every authenticated call needs a short-lived (1 hour) access token obtained
  by exchanging a long-lived refresh token — this means any backend integration needs a token-
  refresh strategy (re-exchange before expiry, or on 401), not a single static key set once. Plan
  for that from the start rather than bolting it on. See `references/mobility-feed-api.md`.

### 2. Implement

- **Calling the API** → `references/mobility-feed-api.md` — base URLs, the token exchange flow,
  endpoint list, pagination (`limit`/`offset`, not cursor-based — different from Transitland's
  cursor pagination if that skill is also in play), and the `/v1/search` full-text query shape.
- **Registering/editing feed entries** → `references/catalogs-contributing.md` — the per-feed-JSON
  format, schema location, and what the integration tests check before a PR can merge.
- **Running validation** → `references/validators.md` — CLI/Docker invocation for both validators,
  and how validation results flow back into the Database via `mobility-feed-api`'s Cloud Functions
  (confirmed to happen; exact trigger schedule/mechanism is not fully documented, so don't promise
  a specific "validation runs every N hours" cadence to a user without checking current behavior).
- **GBFS-specific implementation** → `references/gbfs.md` — auto-discovery file requirements
  (`gbfs.json` required, must link into `manifest.json` only when multiple datasets exist, never
  the reverse), and the `systems.csv` registration requirement for spec compliance.
- **Self-hosting** → `references/self-hosting-testing.md` — the local dev setup is real and
  documented (Docker Compose Postgres, `scripts/api-gen.sh`, `scripts/populate-db.sh`), but treat
  production self-hosting as uncharted: only MobilityData's own GCP setup is documented, not a
  generic deployment guide.

### 3. Test

- **Testing a system that calls the Mobility Feed API**: this repo's `.claude/rules/testing.md`
  conventions apply — mock at the HTTP boundary, factory functions for fixture data. Two things
  specific to this API worth building into test design:
  - **Token expiry is real and short (1 hour)** — a test suite that records a live response once
    and replays it (VCR-style) avoids both hitting undocumented rate limits repeatedly and dealing
    with token refresh inside CI. Reserve live-token, live-API calls for a slower/manual integration
    tier, same reasoning as this repo's `transitland` skill gives for that API's monthly quota.
  - **Don't assert on validation results as static** — a feed's GTFS Validator report can change
    when either the feed's own data changes or the validator itself is updated (it's an actively
    developed tool with its own release cadence). If a test needs a stable validation-report fixture,
    freeze a specific historical report rather than asserting against "whatever the live validator
    currently says" about a live feed.
- **Contributing to `mobility-database-catalogs`**: `tests/test_integration.py` gates every PR —
  run it locally before opening a PR rather than relying on CI to catch schema issues, since the
  turnaround on a failed CI check plus fix plus re-review is slower than a local test run.
- **Contributing to/testing `mobility-feed-api`**: the repo has both unit-style tests and a real
  `integration-tests/` directory (Python, using `requests`/`pandas`/`gtfs_kit`) that runs against an
  actual running instance, plus a separate `load-test/` directory — treat these as three different
  test tiers (unit, integration-against-live-instance, load) rather than one undifferentiated
  "tests" bucket when deciding what to run for a given change.
- **Contributing to `gtfs-validator`**: its CI explicitly includes a "Rule acceptance tests" stage
  that runs against real datasets pulled from the Mobility Database — meaning validator changes are
  tested against real-world feed diversity, not just synthetic fixtures. Worth knowing if debugging
  a validator regression: check whether a specific real feed's data is what triggered the failure
  before assuming a synthetic test case is the right way to reproduce it.

## Quick reference

```
# Get an access token (refresh token comes from your mobilitydatabase.org account page)
curl --location 'https://api.mobilitydatabase.org/v1/tokens' \
  --header 'Content-Type: application/json' \
  --data '{ "refresh_token": "YOUR_REFRESH_TOKEN" }'
# -> { "access_token": "...", "expiration_datetime_utc": "...", "token_type": "Bearer" }

# Use the access token (valid ~1 hour)
curl --location 'https://api.mobilitydatabase.org/v1/metadata' \
  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'

# Full catalog without an account
curl -O https://files.mobilitydatabase.org/feeds_v2.csv

# GTFS Validator (Docker)
docker run --rm -v "$(pwd)/data:/data" ghcr.io/mobilitydata/gtfs-validator \
  --input /data/feed.zip --output_base /data/report

# GBFS Validator (CLI, Node.js)
node ./gbfs-validator/cli.js https://example.com/gbfs.json
```

Re-verify exact image names/CLI invocations against the live repos before scripting them into a
pipeline — `references/validators.md` has the fuller picture and caveats.

## Reference files

| File | Read when |
|---|---|
| `references/mobility-feed-api.md` | Calling the API: token exchange/auth, base URLs, endpoints, pagination, `/v1/search` |
| `references/catalogs-contributing.md` | The `mobility-database-catalogs` per-feed JSON format and how to register/edit a feed |
| `references/validators.md` | Running the GTFS Validator and/or GBFS Validator, and how results connect back to the Database |
| `references/gbfs.md` | GBFS spec version, auto-discovery file requirements, `systems.csv`, what changed in v3.0/v3.1 |
| `references/self-hosting-testing.md` | Self-hosting `mobility-feed-api` locally; testing conventions across the MobilityData repos |

Each reference file marks which facts are directly confirmed from official sources (with URLs)
versus flagged as unverified — respect that distinction, especially around rate limits, validator
trigger timing, and the ambiguous `ApiKeyAuth` endpoint noted above.
