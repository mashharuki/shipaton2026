# Build & Deploy

Source: https://docs.opentripplanner.org/en/latest/Basic-Tutorial/ ,
https://docs.opentripplanner.org/en/latest/BuildConfiguration/ ,
https://docs.opentripplanner.org/en/latest/Container-Image/ ,
https://docs.opentripplanner.org/en/latest/Getting-OTP/
(confirmed against the docs site, Aug 2026, current stable release 2.9.0 — the CLI examples in the
official Basic Tutorial were sourced from a 2.8.1 page; the flags below have been stable across
that gap but re-check `/en/latest/Basic-Tutorial/` if the user is on a much older or newer version).

## Getting the jar

- GitHub Releases: `otp-shaded-<version>.jar`
- Maven Central: `https://repo1.maven.org/maven2/org/opentripplanner/otp-shaded/<version>/otp-shaded-<version>-shaded.jar`
- Building from source needs JDK — docs currently recommend "preferably version 25."

## CLI invocations (confirmed)

At least one of `--load`, `--loadStreet`, `--build`, `--buildStreet` is required. Default port is
8080 (`--port` to override). The data directory is the final positional argument.

```
# Build a graph and immediately start serving it (fastest dev loop)
java -Xmx2G -jar otp-shaded-2.9.0.jar --build --serve /path/to/data-dir

# Build the graph and save graph.obj to disk, don't serve
java -Xmx2G -jar otp-shaded-2.9.0.jar --build --save /path/to/data-dir

# Load a previously-saved graph.obj and start serving
java -Xmx2G -jar otp-shaded-2.9.0.jar --load /path/to/data-dir

# Street-graph-only build (no transit) — useful for iterating on OSM/street config in isolation
java -Xmx2G -jar otp-shaded-2.9.0.jar --buildStreet /path/to/data-dir

# Load a street-only graph, then add transit data and save the combined graph
java -Xmx2G -jar otp-shaded-2.9.0.jar --loadStreet --save /path/to/data-dir
```

`-Xmx` is a normal JVM heap flag, not OTP-specific — size it per the memory guidance in
`troubleshooting.md`, not the `2G` shown in the docs' toy example.

## Data directory conventions

Everything lives in one base directory, passed as the CLI's last argument:

- OpenStreetMap extract: any file recognized as OSM data, must be `.pbf`.
- GTFS feed(s): a `.zip` file whose **filename must contain the letters "gtfs"** — this is how OTP
  auto-classifies it (see `localFileNamePatterns` below if you need non-default naming).
- `build-config.json`, `router-config.json`, `otp-config.json` — all optional, all in this same
  directory.
- Output graph file: `graph.obj`, written here by `--save`.

`localFileNamePatterns` in `build-config.json` is a set of regexes controlling how OTP classifies
files it finds in the data directory into `osm` / `gtfs` / `netex` / `dem` — override it if the
default filename-based detection doesn't fit an existing data pipeline.

## Docker

Official image: `docker.io/opentripplanner/opentripplanner:latest`. Data directory mounts to
`/var/opentripplanner` inside the container.

```bash
# Build
docker run --rm -e JAVA_TOOL_OPTIONS='-Xmx8g' \
  -v "$(pwd)/berlin:/var/opentripplanner" \
  docker.io/opentripplanner/opentripplanner:latest --build --save

# Serve
docker run -it --rm -p 8080:8080 -e JAVA_TOOL_OPTIONS='-Xmx8g' \
  -v "$(pwd)/berlin:/var/opentripplanner" \
  docker.io/opentripplanner/opentripplanner:latest --load --serve
```

No official docker-compose example was found in the current docs — if the user wants
compose/orchestration, that's something to author fresh (build step as an init container or
one-shot job, serve step as the long-running service, sharing a volume for `graph.obj`), not
something to copy from docs verbatim.

## `build-config.json` — confirmed keys

Baked into the graph at build time — **changing any of these requires a full rebuild**, unlike
`router-config.json`.

- `graph`, `streetGraph`, `configVersion`
- `transitModelTimeZone`
- `osm[]` / `osmDefaults` — each entry takes a `source`; `osmDefaults` includes `osmTagMapping`
  (region-specific OSM tag interpretation — don't leave this at a mismatched default for the
  target region, see `troubleshooting.md`) and `includeOsmSubwayEntrances`
- `dem[]` / `demDefaults` — elevation data; `demDefaults.elevationUnitMultiplier`
- `transitFeeds[]` — each entry takes a `source` plus either:
  - `gtfsDefaults`: `blockBasedInterlining`, `discardMinTransferTimes`,
    `stationTransferPreference`, `maxInterlineDistance`
  - `netexDefaults`: `groupFilePattern`, `sharedFilePattern`, `ignoreParking`
- `transitServiceStart` / `transitServiceEnd` — service date window, defaults `-P1Y` / `P3Y`
  (ISO 8601 durations relative to build time)
- Elevation tuning: `distanceBetweenElevationSamples` (default 10.0),
  `readCachedElevations` / `writeCachedElevations` (cuts a multi-hour elevation calc down to
  minutes on rebuild — see the perf note in `troubleshooting.md`),
  `multiThreadElevationCalculations`
- `islandPruning` block, `transferParametersForMode`, `localFileNamePatterns`, `areaVisibility`,
  `dataImportReport` (enables the HTML import-issues report), `osmCacheDataInMem`,
  `staticParkAndRide`, `subwayAccessTime`

Full source: https://docs.opentripplanner.org/en/latest/BuildConfiguration/ — this is a long
reference page; fetch it directly for any key not listed above rather than guessing its shape.
