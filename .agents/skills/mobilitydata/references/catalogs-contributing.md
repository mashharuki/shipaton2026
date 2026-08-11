# mobility-database-catalogs

Source: github.com/MobilityData/mobility-database-catalogs (confirmed Aug 2026).

## What it is

The actual registry data underlying the Mobility Database — "a list of open mobility data feeds
from across the world." This is the raw, git-hosted source of truth that `mobility-feed-api` reads,
merges with other sources, validates, and republishes as the API/CSV layer that
mobilitydatabase.org and `api.mobilitydatabase.org` serve.

## Format: one JSON file per feed

Unlike Transitland's DMFR (a small number of flat registry files, one per domain — see that skill's
`dmfr-atlas.md` if present), this registry is structured as **one JSON file per individual feed**,
organized under `catalogs/`. A `schemas/` directory defines the JSON Schema each file must satisfy,
and `tests/test_integration.py` enforces that schema (plus other integration checks) against every
file — this test suite is what gates every PR to the repo, not just a style linter.

The per-feed JSON files are exported through an automated pipeline into the public CSV at
`https://files.mobilitydatabase.org/feeds_v2.csv` (schema documented in
`mobility-feed-api`'s `docs/SpreadsheetSchemaV2.md`).

## Registering makes a feed public — don't do it for private/internal feeds

Both registration paths below add an entry to the **public** Mobility Database catalog, visible to
anyone via mobilitydatabase.org, the CSV export, and the API. If the goal is validating or
tracking a company's own private/internal GTFS feed (not meant for public consumption), don't
register it here just to get validation results — run the GTFS/GBFS Validator directly against the
feed instead (see `validators.md`'s "Practical guidance" section), which needs no registration,
account, or auth at all. Reserve registration for feeds actually intended to be publicly
discoverable.

## Registering or editing a feed — two paths

1. **Direct PR to this repo** — add/edit the relevant per-feed JSON file, must pass
   `tests/test_integration.py` and schema validation to merge. This is the path worth scripting or
   automating if registering feeds at any scale; run the integration test locally before opening
   the PR rather than relying on CI to catch schema problems first (faster iteration than a
   CI-fail → fix → re-review round trip).
2. **Web contribution form** on mobilitydatabase.org — no API behind this path; MobilityData staff
   manually convert submissions into a PR, with a documented turnaround of roughly a week. Fine for
   a one-off registration, not something to build automation around.

## Reading the catalog directly (bypassing the live API)

The repo exposes Python helper functions for querying the catalog data directly — e.g.
`get_sources_by_bounding_box(lat, lon, ...)` — a legitimate integration path distinct from calling
`mobility-feed-api`'s REST endpoints. This matters if a use case wants to work against a pinned
snapshot of the catalog (e.g. vendored into a build, or queried offline) rather than a live,
authenticated API call — no token exchange or rate limits apply when working against the JSON files
directly, at the cost of needing to keep your own copy in sync (e.g. via periodic `git pull` or
watching the CSV export) rather than always seeing live data.

## Relationship to the API and validators

`mobility-feed-api`'s own README describes the project as "the effort to convert the current
Mobility Database Catalogs... into an API service" — i.e. this repo is upstream of the API, not a
mirror of it. Validation results from the GTFS Validator and GBFS Validator (see `validators.md`)
are associated with specific dataset/feed records that trace back to entries originating here,
though the exact ingestion trigger/schedule connecting a catalog change to a fresh validation run
wasn't confirmed in this skill's research — don't promise a specific latency between "feed added to
catalog" and "validation report available via the API."
