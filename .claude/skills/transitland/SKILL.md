---
name: transitland
description: Use for designing, building, and testing systems that consume or work with Transitland — Interline's transit-data platform that aggregates GTFS, GTFS-RT, GBFS, and MDS feeds from transit operators worldwide into a queryable REST/GraphQL API, bulk datasets, and the DMFR feed registry (transitland-atlas). Trigger whenever the user mentions Transitland, transit.land, a GTFS feed registry or aggregator, Onestop IDs, DMFR, looking up transit stops/routes/operators/agencies/feeds via an API, bulk transit stop/route datasets, or self-hosting a GTFS feed-fetch/import/validate pipeline — even if they just say "transit data API," "GTFS source," or "where do I get GTFS feeds for X city" without naming Transitland explicitly. Also covers transitland-lib (the current Go CLI/library/server — transitland-server is archived, don't point users there), the REST API v2, the paid-tier-gated GraphQL API, and Interline's related OSM GeoJSONL extracts product.
model: opus
---

# Transitland

Transitland (run by Interline.io) is two things at once, and mixing them up is the most common
source of bad advice:

1. A **hosted data platform** at transit.land — a database of transit feeds/operators/routes/stops
   aggregated from GTFS/GTFS-RT/GBFS/MDS sources worldwide, queryable over REST (free tier) and
   GraphQL (paid tier only), plus pre-packaged bulk **datasets** for direct download.
2. An **open-source toolkit**, `transitland-lib` (Go), that does the actual fetch → import →
   validate pipeline behind that hosted platform — and which anyone can also run themselves against
   their own database, either as a CLI, a library, or a server exposing the same REST/GraphQL shape.

A request to "get transit data for a city" might want #1 (call the hosted API); a request to "run
our own feed registry / validation pipeline" wants #2. Figure out which before reaching for code.

## If the project also involves MobilityData / the Mobility Database

Both Transitland and MobilityData (see this repo's `mobilitydata` skill if present) are transit
feed registries built on GTFS/GTFS-RT/GBFS, and it's easy to reach for whichever one you used last
without thinking about why. Short version: MobilityData literally governs the GTFS/GBFS specs and
ships the canonical validators (pick it when spec-authoritative validation matters); Transitland is
a commercial aggregator with no formal spec authority but offers a paid GraphQL layer and Interline's
broader product ecosystem (pick it when GraphQL or bulk cross-agency aggregation matters more). See
`mobilitydata/SKILL.md`'s "MobilityData vs. Transitland" section for the fuller comparison table.

## Before you rely on any specific detail

This ecosystem moves fast and has a real trap in it: **`transitland-server`, the standalone API
server repo, was archived** — its functionality was folded into `transitland-lib`'s `server`
subcommand. If the user has an old blog post, tutorial, or their own memory pointing at
`transitland-server`, that's stale; point them at `transitland-lib` instead. Facts in this skill
were verified against transit.land's live docs/pricing pages and the `interline-io` GitHub org in
August 2026 — re-check anything version- or pricing-sensitive (API tiers, quotas, endpoint lists)
against `https://www.transit.land/documentation` and `https://www.transit.land/plans-pricing/`
before it matters (writing a paid integration, promising a quota to someone). The `references/`
files below mark confirmed-from-source facts vs. open questions the research pass couldn't verify —
respect that distinction.

## The three phases

### 1. Design

- **Free tier or paid?** This is the first fork in the road, not an afterthought. The Free plan
  gives 10,000 REST queries/month and **no GraphQL access at all** — GraphQL is gated to the
  Professional tier ($200–250/mo) and above. If a design assumes GraphQL, confirm the user actually
  has (or is budgeting for) a paid plan before writing GraphQL client code; otherwise scope the
  design to REST from the start. See `references/rest-api.md` and `references/graphql-api.md`.
- **Hosted API vs. bulk dataset vs. self-hosted pipeline?** Three different shapes for "get transit
  data," pick based on the actual need:
  - Need live, queryable, up-to-date lookups (stops near a point, routes for an agency) → the
    hosted REST/GraphQL API.
  - Need a big one-time or periodically-refreshed pile of data (e.g. all US/Canada stops for
    offline analysis) → the pre-packaged **datasets** at transit.land/datasets — note the licensing
    split (US: no share-alike; Canada: ODbL; commercial use needs a separate license from
    Interline) before assuming redistribution rights. See `references/datasets-geojsonl.md`.
  - Need to run your own registry/import/validation pipeline (self-hosting, air-gapped, custom feed
    sources, or contributing feed definitions upstream) → `transitland-lib` + DMFR. See
    `references/self-hosting-lib.md` and `references/dmfr-atlas.md`.
- **Cross-referencing entities over time?** Transitland's answer to "is this the same route/stop/
  operator I saw last month even though the raw GTFS IDs changed" is the **Onestop ID** scheme — a
  stable, human-readable, globally-unique identifier independent of any single feed's internal IDs.
  If a design needs to track transit entities across feed updates or across multiple data sources,
  Onestop IDs are the right join key, not raw GTFS `stop_id`/`route_id` values (those are only
  unique within one feed version). See `references/dmfr-atlas.md`.
- **Real-time?** GTFS-RT feeds are registered and fetched the same way static GTFS is (DMFR entries
  with a `gtfs-rt` spec), but real-time data isn't part of a "feed version" the way static schedules
  are — check `references/self-hosting-lib.md` for how the pipeline treats the two differently
  before assuming real-time data gets versioned/archived identically to static data.
- **Does this actually need OSM data too?** If the broader project is a routing/trip-planning system
  (e.g. paired with OpenTripPlanner), transit data from Transitland covers the *schedule* side but
  not streets — Interline's separate **OSM Extracts** product (the source of the GeoJSONL format
  the user asked about) is a different tool for the *street network* side. Don't conflate the two
  or assume GeoJSONL extracts contain transit stops/routes — see the explicit clarification in
  `references/datasets-geojsonl.md`.

### 2. Implement

- **Calling the hosted API** → `references/rest-api.md` (base URL, auth, endpoints, pagination,
  response formats) and, if the user is confirmed to be on a paid plan, `references/graphql-api.md`.
  Auth is a flat API key as a query param or header (`apikey`/`api_key`/`api_token`/`access_token`
  — any of those names work) obtained via signup at interline.io; there's no OAuth flow to build.
- **Looking up or registering feeds** → `references/dmfr-atlas.md` for the DMFR format and how
  `transitland-atlas` (the canonical feed registry repo) accepts contributions via PR.
- **Running your own fetch/import/validate pipeline, or self-hosting the API** →
  `references/self-hosting-lib.md`. Core mental model: a feed goes through **sync → fetch → import**
  as three distinct CLI steps (`transitland sync`, `transitland fetch`, `transitland import`), and
  **validate** (`transitland validate`) is a separate, composable step you can run standalone against
  any GTFS source, not just ones already in your database. Don't assume `fetch` alone makes data
  queryable — `import` (with `--activate` to make it the live version) is a separate step.
- **Bulk data instead of live queries** → `references/datasets-geojsonl.md` covers the
  transit.land/datasets bulk exports and their licensing, plus the actually-separate GeoJSONL/OSM
  extracts product.

General implementation habit worth calling out: this skill's own research hit a real example of why
verifying beats assuming — an older description of the v1 pipeline (Conveyal's gtfs-lib + Google's
feedvalidator.py) turned up in search results but doesn't match the current Go-native v2
`transitland-lib` pipeline. When something you find describes "how Transitland works" without a
version/date, treat it with suspicion and cross-check against `interline-io/transitland-lib`
directly (it's the actual current codebase powering both the hosted API and self-hosted use).

### 3. Test

Same split as the OTP skill in this repo (if present) applies here: testing *Transitland's own
tooling* vs. testing *a system that calls Transitland* are different tasks.

- **Testing/contributing to `transitland-lib` itself**: `go test ./...`, with CI spinning up real
  Postgres + Redis service containers and a `testdata/test_setup.sh` script that builds fixtures
  from bundled test GTFS feeds and a small DMFR file — not mocked dependencies. If the user is
  working on a fork or contribution, point them at that CI config
  (`.github/workflows/test.yml` in the repo) as the ground truth for how to reproduce test setup
  locally, rather than guessing at a `docker run` command.
- **Testing a system that calls the Transitland API**: ordinary API-integration testing — this repo's
  own `.claude/rules/testing.md` conventions apply (mock at the HTTP boundary, not internal
  functions; use factory functions for fixture data). Two Transitland-specific things worth
  building into the test design:
  - **Rate limits are real and monthly, not per-request-forgiving**: the Free tier's 10,000
    queries/month cap means a CI suite that hits the live API on every run can burn through quota
    fast. Prefer recording real responses once (VCR-style cassette/fixture recording) and replaying
    them in CI, hitting the live API only in a slower/manual integration-test tier.
  - **Onestop IDs are stable, GTFS IDs are not** — if a test asserts on entity identity across two
    calls or over time, assert on the Onestop ID, not a raw feed-internal `stop_id`/`route_id`,
    since those can legitimately change between feed versions.
- **Self-hosted pipeline testing**: if the user is running their own `transitland-lib` server against
  their own feeds, `transitland validate` against a feed URL or local file is the fastest smoke test
  — it doesn't require the full sync/fetch/import pipeline to be wired up first, so use it to
  isolate "is this GTFS file even valid" from "is our import pipeline configured correctly."

## Quick reference

```
# REST API (free tier)
GET https://transit.land/api/v2/rest/routes?apikey=YOUR_KEY&search=...
GET https://transit.land/api/v2/rest/stops?apikey=YOUR_KEY&lat=...&lon=...&radius=...
GET https://transit.land/api/v2/rest/feeds?apikey=YOUR_KEY
GET https://transit.land/api/v2/rest/onestop_id/{onestop_id}?apikey=YOUR_KEY

# GraphQL API (Professional tier and above ONLY — confirm plan before using)
POST https://transit.land/api/v2/query
{"query": "...", "variables": {...}}

# Self-hosted pipeline (transitland-lib CLI)
transitland sync feeds/*.dmfr.json          # register feeds from DMFR files
transitland fetch                            # download feed data, create feed_versions
transitland import --activate                # import fetched versions into the DB, make live
transitland validate <path-or-url-to-gtfs>   # standalone GTFS structural/best-practice validation

# Self-hosted server (replaces the archived transitland-server repo)
transitland server --dburl postgres://...    # serves REST at /rest, GraphQL at /query
```

Get an API key: signup flow at `app.interline.io/products/tlv2_api/orders/new` — re-check this URL
against `https://www.transit.land/documentation` if it's been a while, signup flows change more
often than API shapes do.

## Reference files

| File | Read when |
|---|---|
| `references/rest-api.md` | Calling the free-tier REST API: auth, endpoints, pagination, query params, formats |
| `references/graphql-api.md` | Writing GraphQL queries — and confirming the user is actually on a plan that has access before building around it |
| `references/dmfr-atlas.md` | Onestop IDs, the DMFR feed-registry format, and how `transitland-atlas` accepts/reviews new feed registrations |
| `references/self-hosting-lib.md` | Running your own fetch/import/validate pipeline or API server with `transitland-lib`; testing conventions for the tool itself |
| `references/datasets-geojsonl.md` | Bulk `transit.land/datasets` exports and their licensing, plus the clarification that GeoJSONL extracts are Interline's separate OSM product, not a transit-data format |

Each reference file marks which facts are directly confirmed from official sources (with URLs)
versus flagged as unverified — respect that distinction when advising the user, especially around
pricing/quotas and exact endpoint behavior.
