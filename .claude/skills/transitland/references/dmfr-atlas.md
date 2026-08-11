# Onestop IDs, DMFR & the Feed Registry (transitland-atlas)

Source: https://www.transit.land/documentation/onestop-id-scheme/ ,
github.com/transitland/distributed-mobility-feed-registry ,
github.com/transitland/transitland-atlas (confirmed Aug 2026).

## Onestop IDs — the stable cross-reference key

Raw GTFS IDs (`stop_id`, `route_id`, etc.) are only guaranteed unique *within one feed version* —
they can change between feed updates and obviously differ across independent feeds even for the
same real-world entity. Onestop IDs solve "is this the same operator/route/stop I saw before" with
a stable, human-readable, globally-unique identifier layered on top.

**Structure**: `<entity-prefix>-<geohash>-<name>` (3-part, most common) or
`<entity-prefix>-<name>` (2-part, geohash omitted for entities where a geographic focal point
doesn't apply as cleanly).

**Entity prefixes**: `f-` feed, `o-` operator, `r-` route, `s-` stop/station.

**Geohash component**: a geographic *focal point*, not a strict boundary — the entity's centroid is
guaranteed to fall in that geohash cell, but its actual geometry can extend beyond it (documented
example: the London Underground's geohash cell doesn't contain the full network, which spans the
prime meridian).

**Name rules**: alphanumeric UTF-8; `~` is the only allowed word separator (no spaces, no other
punctuation). With a geohash present, the name only needs to be unique *within that geohash cell*;
in the 2-part form (no geohash), the name must be globally unique.

**Real confirmed examples** (from the DMFR spec repo, not invented):
`f-9q9-bart` (feed), `o-9q9-bart` (operator), `f-bart~rt` (GTFS-RT feed, 2-part form),
`f-west~virginia~university`, `o-dpp1s-wvuprt`.

**Practical implication**: when a design needs to track a transit entity across feed
updates/versions, or join data about the same operator/route/stop coming from more than one
source, join on the Onestop ID — not on the feed-internal GTFS ID. See the "Test" section of
`SKILL.md` for how this affects test assertions too (assert on Onestop ID for identity, not raw
GTFS IDs).

## DMFR (Distributed Mobility Feed Registry)

DMFR is a JSON schema for publishing machine-readable feed lists, covering GTFS, GTFS-RT, GBFS, and
MDS uniformly. Current schema reference:
`$schema: https://dmfr.transit.land/json-schema/dmfr.schema-v0.5.1.json`.

Shape:
- Top-level `feeds[]` array — each entry has `spec` (`gtfs` / `gtfs-rt` / `gbfs` / `mds`), `id`
  (the Onestop ID), and `urls` (spec-specific keys — see below).
- Optional top-level `operators[]` array — each with `onestop_id`, `name`, `associated_feeds`
  (linking one operator to one or more feeds). Operators can alternatively be nested inside a
  single feed entry for the simple 1:1 case.
- `license_spdx_identifier` on the DMFR file covers licensing of *the DMFR file itself* — it does
  not describe the license of the underlying transit data (that's the feed content's own concern,
  reflected in the REST API's `license_*` query filters, see `rest-api.md`).

Per-spec `urls` keys (don't guess these — they differ by spec type):
- `gtfs` → `static_current`, `static_historic`, `static_planned`, `static_hypothetical`
- `gtfs-rt` → `realtime_vehicle_positions`, `realtime_trip_updates`, `realtime_alerts`
- `gbfs` → `gbfs_auto_discovery`
- `mds` → `mds_provider`

Optional `authorization` block describes *how* to authenticate against a feed's own URL (not
Transitland's API — the upstream data source itself): `type` is one of
`header | basic_auth | query_param | path_segment | replace_url`, plus `param_name`/`info_url`.
**Actual credentials are never stored in DMFR** — it only describes the auth mechanism, the
consuming tool supplies the secret separately (relevant if self-hosting and fetching an
authenticated upstream feed — see `self-hosting-lib.md`'s `--secrets` flag).

## transitland-atlas — the canonical registry

`github.com/transitland/transitland-atlas` (Python, actively maintained) is the actual source-of-
truth feed registry: one `.dmfr.json` file per domain/agency (e.g. `bart.gov.dmfr.json`),
explicitly described as "the source of truth for both Transitland v1 and v2's Feed Registry."

**License note**: the atlas repo itself is CC-BY as of a recent licensing change — attribution to
the repo or transit.land is required when reusing its contents, separate from whatever license
applies to each individual feed's actual transit data.

**Contributing a new feed** (e.g. registering a transit agency's feed that isn't yet tracked):
1. Add or edit a `.dmfr.json` file, propose a new Onestop ID following the scheme above.
2. Run the formatting tool — `transitland dmfr format` (a `transitland-lib` CLI subcommand) —
   which enforces the atlas's opinionated formatting (indentation, key order, trailing newline).
   This is checked in CI, so run it before opening a PR rather than after a failed check.
3. Open a PR; GitHub Actions runs DMFR schema validation automatically; a human moderator reviews
   and merges.

GBFS and MDS entries in the atlas are auto-synced from upstream registries (MobilityData's
`systems.csv` for GBFS, the Open Mobility Foundation's `providers.csv` for MDS) rather than
hand-maintained — don't advise manually editing those entries the same way as GTFS/GTFS-RT ones.
