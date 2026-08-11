# Troubleshooting & sizing

Source: https://docs.opentripplanner.org/en/latest/Troubleshooting-Routing/ ,
https://docs.opentripplanner.org/en/latest/System-Requirements/ (confirmed Aug 2026). Note the live
page is `/Troubleshooting-Routing/` — a plain `/Troubleshooting/` URL 404s, so navigate via the
site nav rather than guessing the slug if you need to re-fetch.

## Graph-build import issues — always check before trusting a build

A successful build (`--build` exits 0, `graph.obj` gets written) does **not** mean the data is
routable-correct. OTP logs data problems through a `DATA_IMPORT_ISSUES` logger, and
`"dataImportReport": true` in `build-config.json` produces a browsable HTML report. Confirmed issue
types worth specifically looking for:

- `TurnRestrictionBad` — a turn restriction in the OSM data that OTP couldn't apply correctly
- `StopLinkedTooFar` — a GTFS stop that couldn't be matched to a nearby street/path within the
  expected distance (often a sign of bad stop coordinates or an OSM extract that doesn't fully
  cover the transit network's footprint)
- `GraphConnectivity` — parts of the street/transit graph that end up disconnected from the rest,
  which silently produces "no route found" for real trips between reachable places

Treat any nonzero count of these as something to actually look at before declaring a graph
production-ready, not just a log line to ignore.

## OSM routability rules that silently break routing

These are real, specific tag-based rules — misconfigured or default `osmTagMapping` in a new region
is a common cause of "routing works in one country's extract but produces nonsense in another's":

- Foot and bike traffic are **not** allowed on `highway=trunk`, `trunk_link`, `motorway`,
  `motorway_link`, or `construction` ways.
- Bikes are prohibited on `footway=sidewalk`, `public_transport=platform`, and
  `railway=platform` ways.
- Bicycle safety scoring ranges from 0.6 (dedicated bike lane) to 100 (sand) based on OSM tags
  combined with incline — this feeds into how OTP ranks candidate bike routes, so bad tagging in the
  source OSM data (not an OTP bug) is a common root cause of "OTP suggests a terrible bike route
  here."
- `osmTagMapping` in `build-config.json` should be set per-region rather than left at whatever
  default was copied from another deployment — different countries/OSM communities tag things
  differently enough that a mismatched mapping degrades routing quality without throwing any error.

## Debugging tools

- **Graph Visualizer** — requires familiarity with the OTP codebase itself, not a lightweight
  end-user tool.
- **Transfer debug export** — enable the `TRANSFERS_EXPORT` logger to get a `transfers-debug.csv`
  showing computed transfer connections, useful when transit transfers look wrong or missing.
- **Report API** (sandbox feature) — lets you review the bike-safety scoring report interactively
  rather than just reading raw logs.

## Memory & CPU sizing

**There is no fixed minimum** — required memory scales with the size of the input data (OSM extract
+ GTFS/NeTEx feeds), not a constant. Docs give concrete reference points:

| Region example | Approx. graph-build memory |
|---|---|
| Finland (national extract) | ~10 GB |
| Germany (national extract) | ~95 GB |

Implication: size the `-Xmx` JVM heap (and the machine) against the *actual* target region's data
volume before deploying — never copy a memory setting from a tutorial or a different region's
deployment and assume it'll fit. A build that OOMs partway through is the most common first-deploy
failure mode.

CPU guidance from the docs: single-thread performance and cache size matter more than core count for
the graph-build/routing-search hot path; more cores mainly help with concurrent *request* handling
once serving, not build speed. The docs' own benchmarking note found AMD 3rd-gen CPUs slightly
outperforming Intel 3rd-gen for OTP2. Cloud instance examples cited: Azure `D2as`–`D96as v5` family
(Entur uses `D8as v5` in production), GCP `c4-standard-8` (also an Entur example).

No explicit disk-space guidance was found in the docs — budget for the input data size plus the
serialized `graph.obj` (which can be substantial for large regions) plus working space for any
elevation-data caching (`writeCachedElevations`).

## Elevation build time

Computing elevation over every street edge can take roughly 1.5 hours for a large multi-state
region on a cold build. Enabling `writeCachedElevations` / `readCachedElevations` in
`build-config.json` cuts subsequent rebuilds to roughly 9 minutes by reusing the cached elevation
samples instead of recomputing from the DEM. Worth enabling from the start on any deployment that
rebuilds its graph regularly (e.g. nightly for schedule updates) rather than only after noticing
slow builds.
