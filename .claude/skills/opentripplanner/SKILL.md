---
name: opentripplanner
description: Use for designing, configuring, deploying, and testing systems built on OpenTripPlanner (OTP) — the open-source Java multi-modal trip planning server that routes over GTFS/NeTEx transit data, OpenStreetMap streets, GBFS bike/scooter share, and real-time GTFS-RT/SIRI feeds. Trigger whenever the user mentions OpenTripPlanner, OTP, a trip-planning or journey-planning server, building a transit routing graph, GTFS graph builds, multi-modal route planning APIs, or wants to stand up or integrate a backend that answers "how do I get from A to B by transit/bike/walk" — even if they just say "routing engine," "trip planner," or "GTFS server" without naming OTP explicitly. Also use when reviewing or debugging an existing OTP deployment (build-config.json / router-config.json / otp-config.json), writing GraphQL queries against OTP's GTFS GraphQL or Transmodel APIs, wiring real-time updaters, or writing tests for OTP itself or for a service that calls it.
---

# OpenTripPlanner (OTP)

OTP is a Java server with two jobs: (1) **build** a routable graph from OpenStreetMap streets plus
GTFS/NeTEx transit schedules (and optionally elevation, GBFS, real-time feeds), then (2) **serve**
multi-modal itinerary queries over that graph via GraphQL. There is no other supported query API —
the legacy REST API was permanently removed in 2025. Everything below assumes OTP2 (the only
actively developed line; OTP1 is dead).

## Before you rely on any specific detail

OTP ships roughly two major versions a year and has a history of breaking changes (it dropped the
entire REST API in 2025). The facts in this skill were verified against
`docs.opentripplanner.org` in August 2026 against the-then-current 2.9.0 release. **Before quoting
an exact CLI flag, config key, or version number to the user in a way that matters (writing a
deploy script, debugging a config error, telling them what version to pin), re-check the live docs
rather than trusting this file verbatim** — WebFetch `https://docs.opentripplanner.org/en/latest/`
and navigate to the relevant page. The `references/` files here note which specifics are
confirmed-from-docs vs. inferred; treat the "inferred" ones as a starting hypothesis to verify, not
as ground truth.

## The three phases

OTP work almost always falls into one of these. Figure out which one the user is in — it changes
what matters and which reference file to read.

### 1. Design

Someone is deciding *whether/how* to use OTP before writing config or code. Questions worth asking
or answering:

- **What modes and data does the user actually have?** OTP needs a GTFS feed (or NeTEx) and an OSM
  extract at minimum. No GTFS → OTP can still route walk/bike/GBFS-only, but there's no transit
  routing, which is usually the point of using OTP at all. Ask what data sources exist before
  assuming a full multi-modal deployment is in scope.
- **Real-time or static-only?** Static schedules only need the build-time GTFS feed. Live vehicle
  positions / delays need a GTFS-RT or SIRI updater wired into `router-config.json` at runtime —
  this is a separate, ongoing operational concern (a feed URL that must stay up), not a one-time
  config. Read `references/router-config.md`.
- **Where does it run, and how big is the graph?** Memory needed for a graph build ranges from
  under 1 GB (a small city) to 100 GB+ (a large country) — there is no fixed minimum, it scales with
  OSM + GTFS data volume. This is the single most common reason a first OTP deployment fails
  ("it works locally on a small extract, then OOMs on the real region"). Size this early. See the
  memory table in `references/troubleshooting.md`.
- **How will the app query it?** GraphQL only, two schemas: the GTFS GraphQL API (general-purpose,
  simpler) or the Transmodel/NeTEx API (used by NeTEx-based European deployments, Entur's schema).
  Pick based on which data model the user's transit data is already in — don't default to
  Transmodel unless they're actually using NeTEx feeds. See `references/graphql-apis.md`.
- **Sandbox features?** Anything beyond core routing (fares, flex/demand-responsive transit,
  emissions, ride-hailing, vector tiles, accessibility scoring, TRIAS/OJP protocol support) is
  gated behind `otpFeatures` flags in `otp-config.json`, off by default. If the user wants one of
  these, confirm the exact flag name against the live docs — see the caveat in
  `references/router-config.md`.

If the user is choosing between OTP and alternatives (e.g. a commercial routing API, a bespoke
routing engine), the deciding factors are usually: OTP is free/self-hosted/GTFS-native and strong
on public-transit + multi-modal combos, but requires the user to operate a JVM service and manage
graph rebuilds when schedule data changes — it is not a hosted SaaS.

### 2. Implement

Building, configuring, deploying, or wiring a client to OTP. Read
`references/build-and-deploy.md` first — it has the verified CLI invocations, directory
conventions, and Docker commands. Then:

- **Graph build config** → `references/build-and-deploy.md` (`build-config.json`: OSM/GTFS/DEM
  inputs, service date window, elevation).
- **Runtime/server config, real-time updaters, sandbox feature flags** →
  `references/router-config.md` (`router-config.json`, `otp-config.json`).
- **Querying OTP from an external backend or writing the GraphQL calls yourself** →
  `references/graphql-apis.md` (endpoints, example query, and an explicit note on what's
  *unverified* about calling the API from outside GraphiQL — read that caveat before writing
  fetch/HTTP-client code so you don't invent request-shape details docs don't confirm).

Core mental model to keep straight while implementing: **build-config.json changes require
rebuilding the graph; router-config.json and otp-config.json can be changed without a rebuild**
(router-config is read at server startup / is documented as runtime-changeable — verify reload
behavior for the user's exact version if they need hot-reload, since OTP2 dropped OTP1's
hot-reload-via-Routers-API model). Don't tell a user to "just edit router-config.json and it'll
pick it up live" without checking whether their deployment restarts on config change.

Typical implementation loop:
1. Get a minimal OSM extract + GTFS zip for the target region (small extracts speed up iteration —
   see the testing reference for how OTP's own test suite keeps extracts tiny).
2. Build config → `--build --save` → inspect the `DATA_IMPORT_ISSUES` log / HTML report for
   `GraphConnectivity`, `TurnRestrictionBad`, `StopLinkedTooFar` issues before treating the graph as
   good.
3. Serve (`--load --serve` or `--build --serve` for a one-shot dev loop) and sanity-check via
   GraphiQL at `/graphiql` before wiring any external client.
4. Add router-config for real-time updaters / sandbox features only after static routing looks
   correct — debugging real-time feed issues on top of a broken static graph is much harder.
5. If there's an external backend calling OTP, treat it as a normal GraphQL-over-HTTP POST to
   `/otp/gtfs/v1` (or `/otp/transmodel/v3`) — confirm exact request/response shape empirically
   against the running instance (GraphiQL's Network tab, or a manual curl) rather than assuming,
   since the official docs don't spell out the raw HTTP contract.

### 3. Test

Two distinct things get called "testing OTP" — don't conflate them:

- **Testing OTP itself** (contributing to the OTP codebase, or verifying a custom build/fork):
  Maven-based (`mvn package` runs the full build + test suite), snapshot tests for itinerary
  output, and a strong convention of trimming OSM fixtures down to "a few hundred ways" so tests
  stay fast. See `references/testing.md`.
- **Testing a system that *uses* OTP** (an app or backend that queries a running OTP instance):
  this is ordinary integration testing against a GraphQL API — spin up OTP (or point at a shared
  dev instance) with a known small fixture graph, assert on itinerary shape/duration/mode for a
  handful of known origin-destination pairs, and treat OTP itself as an external dependency to
  mock or containerize per the project's normal testing conventions (see this repo's
  `.claude/rules/testing.md` for the general mocking/test-data rules that still apply here — OTP
  doesn't get a special exemption). `references/testing.md` also covers this angle.

Either way, don't trust that a graph "built successfully" means the data is good — always check the
import-issues report (`references/troubleshooting.md`) before treating a build as ready to serve.

## Quick reference

```
# Build + serve in one step (dev loop)
java -Xmx2G -jar otp-shaded-<version>.jar --build --serve <data-dir>

# Build once, save graph.obj, serve later
java -Xmx2G -jar otp-shaded-<version>.jar --build --save <data-dir>
java -Xmx2G -jar otp-shaded-<version>.jar --load --serve <data-dir>

# Docker equivalent (mount data dir to /var/opentripplanner)
docker run --rm -e JAVA_TOOL_OPTIONS='-Xmx8g' -v "$(pwd)/<data-dir>:/var/opentripplanner" \
  docker.io/opentripplanner/opentripplanner:latest --build --save
docker run -it --rm -p 8080:8080 -e JAVA_TOOL_OPTIONS='-Xmx8g' \
  -v "$(pwd)/<data-dir>:/var/opentripplanner" \
  docker.io/opentripplanner/opentripplanner:latest --load --serve

# GraphiQL explorer once serving
http://localhost:8080/graphiql

# API endpoints
http://localhost:8080/otp/gtfs/v1        # GTFS GraphQL API (general purpose)
http://localhost:8080/otp/transmodel/v3  # Transmodel/NeTEx GraphQL API
```

Re-verify the version number in the jar filename and the exact flags against
`https://docs.opentripplanner.org/en/latest/Basic-Tutorial/` if it's been a while since this skill
was last updated — see the caveat at the top of this file.

## Reference files

| File | Read when |
|---|---|
| `references/build-and-deploy.md` | Standing up OTP: CLI flags, directory/file-naming conventions, Docker, `build-config.json` keys, memory sizing at build time |
| `references/router-config.md` | `router-config.json` (routing defaults, RAPTOR tuning, real-time updaters for GTFS-RT/SIRI/GBFS) and `otp-config.json` (`otpFeatures` sandbox flags) |
| `references/graphql-apis.md` | Writing GraphQL queries against OTP, choosing GTFS-GraphQL vs Transmodel, wiring an external client/backend |
| `references/testing.md` | Running OTP's own test suite (Maven, fixtures, snapshots) or integration-testing a service that calls OTP |
| `references/troubleshooting.md` | Graph-build import issues, OSM routability rules that silently break routing, memory/CPU sizing table, debugging tools |

Each reference file marks which facts are directly confirmed from the official docs (with the
source URL) versus flagged as unverified/needs-a-fresh-check — respect that distinction when
advising the user.
