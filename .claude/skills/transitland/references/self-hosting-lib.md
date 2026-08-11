# Self-hosting: transitland-lib

Source: github.com/interline-io/transitland-lib README and `doc/cli/` (confirmed Aug 2026).

## The one fact that matters most here

**`transitland-server` (the old standalone API server repo) is archived (Nov 2025).** Its
functionality was folded into `transitland-lib`, which is now the unified library + CLI + server —
one Go codebase does fetching, importing, validation, and serving REST/GraphQL. If you encounter an
older tutorial, Stack Overflow answer, or blog post that references `transitland-server` as
something to clone and run, treat it as outdated and redirect to `transitland-lib`'s `server`
subcommand instead. This is exactly the kind of stale-but-plausible detail worth actively
double-checking rather than reproducing.

## Installation

- Prebuilt binary from GitHub Releases
- Homebrew: `brew install interline-io/transitland-lib/transitland-lib`
- `go get` (Go toolchain required) for building from source or using as a library

## The pipeline: sync → fetch → import → validate

Four distinct CLI subcommands, each a separate step — don't assume one implies the next:

```bash
# 1. Register feeds from DMFR file(s) into the database (new feeds default to public)
transitland sync feeds/*.dmfr.json

# 2. Download each registered feed's current data; creates a feed_version only if content changed
transitland fetch [feed-ids...]
#   --strict              reject the fetch on validation error instead of importing anyway
#   --validation-report    attach a validation report to the resulting feed_version
#   supports S3 / local filesystem / FTP sources in addition to plain HTTP
#   SSRF-protected HTTP fetching by default (relevant if fetching from user-supplied/dynamic URLs)

# 3. Import a fetched feed_version into the queryable database
transitland import [feed-ids...]
#   --activate            make this the live/current version (without it, imported but not serving)
#   --latest               import only the most recently fetched version per feed
#   --error-threshold      fail the import if a file's row error rate exceeds a threshold
#   normalization options for shapes, timezones, calendars

# 4. Validate — standalone, does NOT require the feed to be registered/synced first
transitland validate <path-or-url-to-gtfs>
transitland validate "https://www.bart.gov/dev/schedules/google_transit.zip"
transitland validate --dmfr feeds/wmata.com.dmfr.json --feed-id f-dqc-wmata~rail --secrets secrets.json
#   --best-practices       adds MobilityData-style best-practice checks beyond structural validity
#   --rt                   also validates a GTFS-RT protobuf feed
#   -o <file>               write a JSON validation report
#   --save-fvid             attach the report to a specific feed_version record
```

`validate` being standalone matters for troubleshooting: if something looks wrong after a fetch or
import, run `validate` directly against the source GTFS to isolate "is the upstream data actually
bad" from "did our own pipeline configuration break something."

**Historical note, don't repeat as current fact**: older descriptions of the v1-era pipeline
mention Conveyal's `gtfs-lib` and Google's `feedvalidator.py` as the underlying validation tooling.
That does not match the current v2 `transitland-lib`, which is a native Go implementation with its
own `validate` command. If you see that older description in search results or an old blog post,
don't carry it forward as describing the current system.

## Running as a server

```bash
transitland server --dburl postgres://...
```

Serves REST at `/rest/...`, GraphQL at `/query`, and a browsable GraphQL UI at `/`. **The shipped
example runs without built-in authentication/authorization** — the README is explicit that auth
middleware was removed from the example and is left for each installation to add. Don't assume a
self-hosted instance is safe to expose publicly without adding an auth layer yourself; this is
different from the hosted transit.land API, which does enforce API-key auth.

Can also be used purely as a Go **library** (not CLI/server) — the README points to
`doc/library-example.md` for code-level usage if embedding the fetch/import/validate logic directly
into another Go program rather than shelling out to the CLI.

## Testing conventions (relevant if contributing, forking, or debugging a self-hosted instance)

- `go test ./...` is the standard entry point.
- CI (`.github/workflows/test.yml`) spins up **real service containers** — Postgres
  (`postgis/postgis:16-3.4-alpine`, note: PostGIS-enabled, not plain Postgres — geospatial queries
  are exercised in tests) and Redis — rather than mocking the database layer.
- `testdata/test_setup.sh` builds test fixtures: bundled Natural Earth data plus
  `testdata/server/server-test.dmfr.json` feeds and `testdata/server/gtfs` sample data. Run this
  before `go test` when reproducing CI locally, not just `go test` alone.
- Optional env vars gate extra test coverage: `TL_TEST_REDIS_URL` enables GBFS-related tests,
  `TL_TEST_FGA_ENDPOINT` enables OpenFGA-based authorization tests (OpenFGA being an optional
  fine-grained-authorization layer some deployments add on top of the auth-free example server
  mentioned above).
- Schema migrations use `golang-migrate`, with migration files under
  `internal/schema/postgres/migrations`. SQLite is supported as a lighter-weight option for
  short-lived/local use, but the CI fixture setup above targets Postgres.

This is a genuinely different testing posture than mocking a database — if a user is contributing
upstream or debugging a failing test, point them at the real CI config as ground truth rather than
guessing a `docker run` invocation, since the exact image tags/fixture scripts are the actual
source of truth and change over time.
