# REST API v2

Source: https://www.transit.land/documentation/rest-api/ ,
OpenAPI spec cross-verified between `https://transit.land/api/v2/rest/openapi.json` (hosted) and
`raw.githubusercontent.com/interline-io/transitland-lib/main/doc/openapi/rest.json` (source of
truth in the codebase powering the hosted API) — confirmed Aug 2026.

## Base URL & auth

```
https://transit.land/api/v2/rest
```

Auth is a flat API key, accepted as **either a query param or a header**, under any of these names
(all confirmed equivalent): `apikey`, `api_key`, `api_token`, `access_token`. There's no OAuth flow
— get a key by signing up (see SKILL.md quick reference for the current signup URL), it arrives by
email. No formal `securitySchemes` block exists in the OpenAPI spec itself — auth is enforced by
middleware outside the documented schema, which also means the OpenAPI doc alone won't tell you
which endpoints require a key (assume all of them do).

## Confirmed endpoints

```
GET /agencies
GET /agencies/{agency_key}
GET /feeds
GET /feeds/{feed_key}
GET /feeds/{feed_key}/download_latest_feed_version
GET /feeds/{feed_key}/download_latest_rt/{rt_type}.{format}
GET /feed_versions
GET /feed_versions/{feed_version_key}
GET /feed_versions/{feed_version_key}/download
POST /feed_versions/export
GET /operators
GET /operators/{operator_key}
GET /routes
GET /routes/{route_key}
GET /routes/{route_key}/trips
GET /routes/{route_key}/trips/{id}
GET /stops
GET /stops/{stop_key}
GET /stops/{stop_key}/departures
GET /onestop_id/{onestop_id}
```

This list was cross-checked between the hosted `openapi.json` and the static copy bundled in the
`transitland-lib` repo and matched — treat it as reliable, but a small chance exists that endpoints
were added after that file's last sync, so re-fetch `openapi.json` directly if precision matters.

**Key convention**: any `{..._key}` path parameter accepts either a plain integer database ID *or*
a composite key of the form `<feed onestop_id>:<gtfs id>` (e.g. looking up a route by its
feed-scoped GTFS `route_id` without knowing the integer ID). `GET /onestop_id/{onestop_id}` is a
generic cross-entity lookup — useful when you have a Onestop ID and don't know or care which entity
type it resolves to.

## Query parameters (confirmed on `/routes` and `/stops`, from OpenAPI `components.parameters`)

- `after` — opaque, server-generated pagination cursor (see Pagination below)
- `limit`
- `format` — `json` (default), plus `geojson` / `geojsonl` / `png` on geo-bearing endpoints
- `search` — full-text search
- `onestop_id`, `feed_onestop_id`, `feed_version_sha1`
- `lat`, `lon`, `radius` (meters) — proximity search
- `bbox` — `min_lon,min_lat,max_lon,max_lat`
- License filters tied to each feed's DMFR `license` block: `license_commercial_use_allowed`,
  `license_share_alike_optional`, and similar — useful for filtering results down to feeds whose
  license actually permits the intended use, rather than filtering after the fact.

## Pagination

Cursor-based, not page-number-based. The response's `meta` property carries the next cursor as an
`after` value; the response also includes a ready-made "next" link so you don't have to hand-build
the query string, but the raw `after` cursor is available if you need to construct the request
yourself (e.g. from a non-browser client). Pass it back as the `after` query param on the next
request. Don't assume offset/page-number semantics — this API doesn't have them.

## Response formats

JSON is the default and works everywhere. `geojson` and `geojsonl` are available on endpoints that
return geometry-bearing entities (routes, stops) — `geojsonl` is the newline-delimited variant
(one Feature per line, streamable) rather than one large `FeatureCollection`; see
`datasets-geojsonl.md` for the general format explanation (that reference file's primary subject is
Interline's separate OSM product, but the *format* itself — ndjson-of-GeoJSON-Features — is the
same convention used here). `png` is available for endpoints that can render a map tile/image.

## Proximity search results: sort order is unconfirmed

`/stops` and `/routes` accept `lat`/`lon`/`radius` as a proximity *filter*, but neither the REST
API docs page nor the OpenAPI parameter descriptions state whether results come back sorted by
distance from that point (confirmed absent — not just unfetched — as of this research pass). Don't
assume nearest-first ordering. If a use case genuinely needs "the closest N stops" rather than "any
N stops within radius," compute distance client-side (e.g. Haversine on the returned coordinates)
and sort there rather than trusting API response order.

## What's confirmed vs. not

Confirmed via the OpenAPI spec (structurally authoritative but prose-free): the endpoint list,
parameter names, and formats above. **Not independently fetched**: the prose documentation
subpages for individual endpoint groups (e.g. a dedicated "Feeds" or "Feed versions" walkthrough
page under `/documentation/rest-api/`) — if you need worked examples or field-by-field response
shape explanations beyond what the OpenAPI schema implies, fetch those specific pages fresh rather
than assuming this reference covers every nuance.
