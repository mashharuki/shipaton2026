# Bulk Datasets & GeoJSONL Extracts

Source: https://www.transit.land/datasets , https://www.interline.io/blog/geojsonl-extracts/
(confirmed Aug 2026).

## `transit.land/datasets` — pre-packaged bulk exports

Distinct from the live REST/GraphQL API and distinct from the raw per-operator DMFR feeds
(`dmfr-atlas.md`): these are **pre-packaged, regularly-updated bulk exports** covering (per the
site, at time of research) over 780,000 transit stops plus routes across the US and Canada. The
pitch is explicit — a shortcut so you don't have to fetch and parse thousands of individual raw
GTFS feeds yourself if what you actually want is "all the stops/routes in a region," not live
per-agency lookups.

**Licensing is not uniform — check before assuming redistribution rights**:
- US data: licensed with "no share-alike" restriction
- Canada data: ODbL (Open Database License — does carry share-alike-style obligations, unlike the
  US data)
- Downloading requires accepting Transitland's Terms
- **Commercial use requires a separate license from Interline** — this is stated directly on the
  page, not inferred. Don't assume the datasets page's free availability implies free commercial
  use.

This licensing split is a real, documented difference between the two countries' data on this page
— don't treat US and Canada data as interchangeably licensed.

## GeoJSONL extracts — important scope clarification

**This is Interline's separate OSM (OpenStreetMap) Extracts product, not a Transitland/GTFS transit
data feature.** If the user asked about this expecting it to relate to transit stops/routes data,
correct that assumption early — GeoJSONL extracts (per the blog post) provide **street/map data
from OpenStreetMap**, not transit schedule data. The two products live in the same Interline
ecosystem (relevant together if the user is also building something like a trip-planning system
that needs both transit schedules *and* street data — pairing naturally with something like
OpenTripPlanner, which needs an OSM `.pbf` extract as one of its two core inputs, see this repo's
`opentripplanner` skill if present) but they are not the same data or the same API.

**What GeoJSONL is** (a general format, not Transitland-specific): newline-delimited GeoJSON — one
GeoJSON `Feature` object per line, instead of one giant `FeatureCollection` array. This enables
streaming/line-by-line parsing (read one line, process one feature, discard, read the next) instead
of loading an entire large file into memory to parse a single top-level JSON structure.

**Why it matters, with the concrete number from the blog post**: a ~27 MB standard GeoJSON extract
(the post's Honolulu example) required roughly 240 MB of memory and several seconds to fully parse
as a single JSON document, because a `FeatureCollection` can't be meaningfully partially parsed.
The GeoJSONL equivalent avoids that entirely — sequential line-by-line reads keep memory use
negligible regardless of total file size.

**Format specifics**: standard ndjson convention — each line is one complete, valid GeoJSON
`Feature` (with normal OSM-derived `properties` like `highway` tags, `name`, etc.), no
`FeatureCollection` wrapper around the whole file. Compatible with plain streaming JSON parsers,
`jq` (line-by-line), GNU parallel (one line = one unit of work), Osmium, and Tippecanoe (vector tile
generation) — this is the practical reason the format is useful: it composes with Unix-style
line-oriented tooling that a giant single-array GeoJSON file doesn't.

**How to actually get one — genuinely unconfirmed**: the blog post announces that Interline's OSM
Extracts product "now provides geojsonl" and points at the interactive extract viewer at
`app.interline.io/osm_extracts/interactive_view`, but does not spell out a concrete download
URL/API request pattern in the post itself. **Don't invent a specific endpoint or query-string
pattern for this** — if the user needs to script/automate a GeoJSONL extract download rather than
use the interactive viewer, that requires a fresh look at the current OSM Extracts product
docs/UI (or the `interline-io/osm-extracts` repo) rather than anything confirmed in this reference
file.

**Licensing**: the blog post itself doesn't restate a license for the extracted data. OpenStreetMap
data is ODbL by default via OSM's own project-wide license — treat that as the baseline assumption
for OSM-derived extracts, but confirm against the OSM Extracts product's own terms rather than
assuming Interline's redistribution terms exactly mirror the datasets-page terms described above
(those are for transit data, a separate product).
