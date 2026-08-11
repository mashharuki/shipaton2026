# Runtime config: router-config.json & otp-config.json

Source: https://docs.opentripplanner.org/en/latest/RouterConfiguration/ ,
https://docs.opentripplanner.org/en/latest/Configuration/ ,
https://docs.opentripplanner.org/en/latest/SandboxExtension/
(confirmed Aug 2026 against current docs).

Unlike `build-config.json`, these two files are **not baked into the graph** — they're read at
server runtime. Treat "runtime-changeable" as meaning you don't need to rebuild the graph to change
them, but don't assume the running server hot-reloads on file edit without checking — OTP2
deliberately dropped OTP1's hot-reload-via-Routers-API model, so confirm whether the user's
deployment process is "edit config → restart the serve process" (safe assumption) vs. true
hot-reload (verify against the live docs for their version before promising it).

## `router-config.json` — confirmed top-level keys

- `configVersion`
- `server` — server-level settings
- `routingDefaults` — default routing parameters applied unless overridden per-request
- `transit` — RAPTOR (the multi-criteria range-RAPTOR transit search algorithm) tuning
- `flex` — flex/demand-responsive transit tuning (only meaningful if the Flex Routing sandbox
  feature is enabled — see below)
- `timetableUpdates`
- `updaters[]` — real-time feed configuration, see below
- `transmodelApi`, `gtfsApi`, `triasApi`, `ojpApi` — per-API config blocks (TRIAS and OJP are
  themselves sandbox/feature-gated protocols, not on by default)
- `vectorTiles` — Mapbox Vector Tiles API config (sandbox feature)
- `vehicleRentalServiceDirectory` — GBFS v3 rental service directory
- `rideHailingServices`

Full reference (this is a large page, fetch directly for any key not covered here):
https://docs.opentripplanner.org/en/latest/RouterConfiguration/

## Real-time updaters (`updaters[]`)

Each entry has a `type` and type-specific fields. Confirmed example shapes from the docs:

```json
{
  "type": "stop-time-updater",
  "frequency": "1m",
  "url": "https://example.com/gtfs-rt/trip-updates",
  "feedId": "example-agency"
}
```

```json
{
  "type": "siri-et-updater",
  "url": "https://example.com/siri/estimated-timetable",
  "timeout": "30s"
}
```

```json
{
  "type": "vehicle-rental",
  "sourceType": "gbfs",
  "url": "https://example.com/gbfs.json",
  "frequency": "1m"
}
```

Implication for implementation: real-time updaters are a **standing operational dependency** — a
feed URL that must stay reachable and correctly formatted for as long as the server runs, not a
one-time setup step. If a user is debugging "real-time data isn't showing up," check updater logs
first (feed unreachable / malformed / wrong `feedId` mismatching the static GTFS feed it's meant to
update) before assuming the static graph build is at fault.

## `otp-config.json` — sandbox feature flags

"Simple switches that enable or disable system-wide features" — this file's main content is
`otpFeatures`, a map of feature-name → boolean. Most deployments that only need core static+realtime
transit routing don't need this file at all.

Confirmed sandbox feature *names* that exist (from the SandboxExtension nav) — **the exact JSON
flag identifier for each was not verified from the fetched docs excerpt, so confirm the precise key
by fetching `https://docs.opentripplanner.org/en/latest/SandboxExtension/<FeatureName>/` before
writing it into a config file**:

Flex Routing, Ride Hailing, Emissions, Carpooling, Fares, Geocoder API, IBI Accessibility Score,
Stop Consolidation, Empirical Delay, Sørlandsbanen, TRIAS API, OpenJourneyPlanner (OJP) API,
Mapbox Vector Tiles API, Vehicle Parking Updaters, Vehicle Rental Service Directory API, Report
API, Park and Ride API, Data Overlay, Actuator API, Debug Raster Tiles, Direct Transfer Analyzer,
Google Cloud Storage, SIRI Google/Azure/MQTT updaters, Smoove Bike Rental Updater, Interactive OTP
Launcher.

`ActuatorAPI` and `APIBikeRental` are two flag names that appear directly in `Configuration/` docs
prose as examples of `otpFeatures` entries — these two are higher-confidence than the list above,
which was sourced only from page titles, not confirmed JSON keys.

**Don't hand-write a sandbox feature flag name from memory or from this list without a fresh check
if it matters** (e.g. the user is about to deploy with it) — feature flags in fast-moving OSS
projects are exactly the kind of detail that silently renames between releases.
