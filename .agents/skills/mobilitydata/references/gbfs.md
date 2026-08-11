# GBFS (General Bikeshare Feed Specification)

Source: github.com/MobilityData/gbfs (`gbfs.md`), NABSA's 2022 host-transfer announcement
(confirmed Aug 2026).

## Stewardship

MobilityData was formally selected by NABSA (North American Bikeshare & Scootershare Association)
as the new host/steward of GBFS in 2022 — MobilityData governs its development, hosts the spec
repo, and runs the community contribution/governance process. This is the same kind of formal
standing MobilityData has over GTFS, extended to bikeshare/micromobility data.

## Current version

**v3.0** is the current recommended release (April 11, 2024). A **v3.1-RC3** release candidate
exists and is described as implementation-ready. If a design or integration targets "GBFS" without
specifying a version, confirm which major version the actual data source implements before assuming
v3.0 field/file names apply — v2.x deployments are still common in the wild and use different file
names for some things (see below).

## Auto-discovery

- **`gbfs.json` is REQUIRED (as of spec v2.0)** — the auto-discovery file every compliant system
  must publish, linking to all the other files it exposes.
- **`gbfs.json` must NOT link to `manifest.json`** — the relationship only goes the other direction.
- **New in v3.0: `manifest.json`** — conditionally required for providers publishing **more than
  one** GBFS dataset (e.g. separate feeds per city under one operator). It's a directory of
  `gbfs.json` URLs, one per dataset. A single-dataset provider doesn't need one.
- Discovery is also advertised via an HTML tag on the operator's public landing page:
  `<link rel="gbfs" type="application/json" href="...">`.
- URLs should embed the major version in the path (e.g. `/gbfs/v3/gbfs.json`) and must not require
  login to fetch.
- To be spec-compliant, a system **must have an entry in `systems.csv`** (the catalog file in this
  same repo) — this is also what `mobility-feed-api` ingests to populate `/v1/gbfs_feeds`, so an
  unregistered system won't show up in the Mobility Database's GBFS coverage even if its feed itself
  is technically valid.

## Files (per the spec's table of contents)

Required (for applicable system types): `gbfs.json`, `system_information.json`,
`station_information.json` / `station_status.json` (docked systems), `vehicle_status.json`
(free-floating/hybrid systems — **renamed from `free_bike_status.json` in v3.0**, a real breaking
rename worth checking for when working with older feeds).

Optional/conditional: `gbfs_versions.json`, `vehicle_types.json`, `vehicle_availability.json` (new
in v3.1-RC2), `system_regions.json`, `system_pricing_plans.json`, `system_alerts.json`,
`geofencing_zones.json`, `manifest.json` (see above).

## GBFS Validator

Covered in `validators.md` — separate Node.js tool (`MobilityData/gbfs-validator`), web UI at
`gbfs-validator.mobilitydata.org`, CLI via `node ./gbfs-validator/cli.js <url>`, validates against
the official GBFS JSON Schemas.

## Practical implications

- If building something that consumes GBFS from an arbitrary/unknown operator, **don't hardcode
  `free_bike_status.json`** as the free-floating-vehicle file name — check `gbfs_versions.json` (if
  present) or the discovered `gbfs.json` version field to know whether you're looking at a v2.x feed
  (`free_bike_status.json`) or v3.0+ (`vehicle_status.json`).
- If an operator publishes multiple cities/regions under one brand, check for `manifest.json`
  before assuming a single `gbfs.json` URL covers everything — multi-dataset operators are exactly
  what `manifest.json` exists to handle, and treating them as single-dataset will silently miss
  regions.
