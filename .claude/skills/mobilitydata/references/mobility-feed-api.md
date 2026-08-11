# Mobility Feed API

Source: `docs/DatabaseCatalogAPI.yaml`, `docs/DatabaseCatalogTokenAPI.yaml`,
`docs/BearerTokenSchema.yaml`, and the README in
github.com/MobilityData/mobility-feed-api (confirmed Aug 2026). The public Swagger UI
(mobilitydata.github.io/mobility-feed-api/SwaggerUI/) is JS-rendered — if you need to browse it
interactively, open it in an actual browser; a plain fetch won't return the endpoint list, use the
YAML spec files in the repo instead (that's what this reference is built from).

## Base URLs

```
Prod:      https://api.mobilitydatabase.org/
Pre-prod:  https://api-qa.mobilitydatabase.org/
Dev:       https://api-dev.mobilitydatabase.org/
Local:     http://localhost:8080/
```

## Auth: JWT bearer via refresh-token exchange

An account is required (sign up at mobilitydatabase.org). Auth is OAuth2-flavored JWT bearer, not a
flat static API key:

1. Get a **refresh token** (long-lived) from your account page on mobilitydatabase.org.
2. Exchange it for a short-lived **access token** (confirmed valid for **1 hour**):

   ```bash
   curl --location 'https://api.mobilitydatabase.org/v1/tokens' \
     --header 'Content-Type: application/json' \
     --data '{ "refresh_token": "[Your Refresh Token]" }'
   ```

   Response: `access_token`, `expiration_datetime_utc`, `token_type: "Bearer"`.

3. Use the access token on subsequent calls: `Authorization: Bearer <access_token>`.

**Implementation implication**: because the access token expires hourly, any backend integration
needs a refresh strategy — re-exchange proactively before expiry, or reactively on a 401 — not a
single token set once at startup. This is a real design point to raise with the user up front, not
something to discover after a service starts failing an hour into a deploy.

**Unresolved auth detail**: `POST /v1/licenses:match` is specified with `security: [ApiKeyAuth: []]`
instead of the bearer scheme every other endpoint uses, but the OpenAPI spec's
`securitySchemes:` block never actually defines what `ApiKeyAuth` is. Don't assume a second,
separate API-key auth system exists — treat this endpoint's real auth requirement as unconfirmed
and test it empirically (or check for updates to the spec) before depending on it.

**Rate limits**: confirmed to exist and to be surfaced in response headers (per a tracked GitHub
issue in the repo), but no exact numeric limit was found in any primary source. Don't quote a
specific requests-per-minute number to a user — read the actual rate-limit response headers from a
live call if the exact figure matters.

## Core endpoints (all under `/v1`)

```
GET  /v1/feeds                          # all feeds, common fields only
GET  /v1/feeds/{id}
GET  /v1/gtfs_feeds                     # GTFS-specific fields
GET  /v1/gtfs_feeds/{id}
GET  /v1/gtfs_feeds/{id}/datasets       # dataset (feed-version) history for a GTFS feed
GET  /v1/gtfs_feeds/{id}/gtfs_rt_feeds  # realtime feeds linked to this schedule feed
GET  /v1/gtfs_feeds/{id}/availability
GET  /v1/gtfs_rt_feeds                  # GTFS-Realtime feeds
GET  /v1/gtfs_rt_feeds/{id}
GET  /v1/gbfs_feeds                     # GBFS feeds
GET  /v1/gbfs_feeds/{id}
GET  /v1/datasets/gtfs/{id}             # one specific dataset (feed-version) snapshot
GET  /v1/metadata                       # API metadata (good smoke-test endpoint)
GET  /v1/search                         # full-text search
GET  /v1/locations
GET  /v1/licenses
GET  /v1/licenses/{id}
POST /v1/licenses:match                 # resolve a license URL to a known license (auth unresolved, see above)
```

## Conceptual model: feed vs. dataset

A **feed** is the stable registry entry for a data source (a provider's GTFS/GTFS-RT/GBFS feed). A
**dataset** is a specific fetched snapshot/version of a GTFS feed at a point in time — this is the
same distinction as Transitland's "feed" vs. "feed_version" if that skill is also in scope, just
named differently. `/v1/gtfs_feeds/{id}/datasets` lists the version history; `/v1/datasets/gtfs/{id}`
fetches one specific snapshot.

## Query params

- `feeds` / most list endpoints: `limit`, `offset`, `status`, `provider`, `producer_url`,
  `is_official`
- `/v1/search`: `limit`, `offset`, `statuses`, `feed_id`, `data_type`, `is_official`, `version`,
  `search_text`, `feature`, `license_ids`, `license_is_spdx`, `license_tags`. Full-text matching is
  Postgres `plainto_tsquery` with English lexemes, terms AND-combined, order-independent — so
  `search_text` behaves like "all these words must appear somewhere," not phrase matching.

## Pagination

`limit` + `offset`, consistently — **not** cursor-based. This is a real, confirmed difference from
Transitland's `after`-cursor pagination (see that skill's `rest-api.md` if both are in scope) —
don't carry offset/limit assumptions into cursor-paginated code or vice versa.

## Client integration

No dedicated SDK/client library was found under the MobilityData org — integration is plain
REST + the token-exchange flow above, documented via curl examples in the README. The Swagger UI
also supports pasting a token directly for interactive testing, useful for confirming an integration
manually before writing client code. If instead consuming the catalog data directly (bypassing the
live API), `mobility-database-catalogs` exposes Python helper functions (e.g.
`get_sources_by_bounding_box(lat, lon, ...)`) as an alternative integration path — see
`catalogs-contributing.md`.
