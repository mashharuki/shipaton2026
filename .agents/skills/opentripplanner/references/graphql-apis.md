# Querying OTP: GraphQL APIs

Source: https://docs.opentripplanner.org/en/latest/apis/GTFS-GraphQL-API/ ,
https://docs.opentripplanner.org/en/latest/apis/TransmodelApi/ ,
https://docs.opentripplanner.org/en/latest/apis/GraphQL-Tutorial/ ,
https://docs.opentripplanner.org/en/latest/Version-Comparison/
(confirmed Aug 2026).

## There is no REST API anymore

OTP1 and early OTP2 had a REST API. **It was permanently removed in 2025.** If the user's mental
model, an old tutorial, a Stack Overflow answer, or your own training data references
`/otp/routers/default/plan` or similar REST endpoints, that is stale — GraphQL is the only
supported query interface on current OTP. Flag this explicitly if you see the user working from an
old REST-API example.

## Two schemas — pick based on the data model, not by default

- **GTFS GraphQL API** — endpoint `http://localhost:8080/otp/gtfs/v1`. Described in the docs as a
  "general purpose API... created for the Digitransit project." This is the natural default when
  the underlying transit data is GTFS.
- **Transmodel (NeTEx) GraphQL API** — endpoint `http://localhost:8080/otp/transmodel/v3`. "The
  official OTP2 API for Transmodel (NeTEx)." Originated in Entur's fork before being merged
  upstream; Entur (Norway's national transit data platform) runs a large-scale public deployment
  and exposes a public explorer at `https://api.entur.io/graphql-explorer` — useful as a real-world
  reference for query shapes and scale if the user is doing NeTEx work.

Don't default to Transmodel just because it sounds more "official" — use it only when the
underlying data is actually NeTEx, or when integrating with a Transmodel-based ecosystem (European
national transit data platforms commonly are).

Two more protocol APIs exist as **sandbox/feature-gated** options, off by default: `triasApi`
(TRIAS) and `ojpApi` (OpenJourneyPlanner) — relevant mainly for European interop with those
specific standards. See `router-config.md` for the feature-flag caveat.

## Exploring interactively

Once the server is running:

```
http://localhost:8080/graphiql
```

This is the officially documented way to explore the schema and test queries — the GraphQL
Tutorial page walks through using this in-browser tool, not an external HTTP client.

## Confirmed example query (GTFS GraphQL API)

```graphql
query stops {
  stops {
    gtfsId
    name
  }
}
```

No verbatim example query for the Transmodel API was found in the fetched docs — use GraphiQL's
schema explorer against `/otp/transmodel/v3` to build one, or reference Entur's public explorer.

## Actually planning a trip: `planConnection` (not `plan`)

The query most users actually want — "give me an itinerary from A to B" — is not the `stops` query
above. Confirmed from the GTFS GraphQL schema docs
(https://docs.opentripplanner.org/api/dev-2.x/graphql-gtfs/queries/planConnection):

- **`planConnection` is the current query field for trip planning.** A separate `plan` field also
  exists but is **documented as deprecated in favor of `planConnection`** — don't reach for `plan`
  in new code even though it may still work.
- `planConnection` follows the **GraphQL Cursor Connections Specification** (Relay-style pagination:
  `first`/`after`, `last`/`before`), unlike the simpler `plan` query — this is a real shape
  difference, not just a rename, so a `plan`-based example from an older tutorial won't map 1:1
  onto `planConnection`.
- Confirmed top-level arguments:
  - `origin: PlanLabeledLocationInput!` (required) — "The origin where the search starts"
  - `destination: PlanLabeledLocationInput!` (required) — "The destination where the search ends"
  - `dateTime: PlanDateTimeInput` — lets you specify either earliest departure time or latest
    arrival time (earliest-departure-now is the default when omitted)
  - `modes: PlanModesInput` — street and transit modes used during the search
- Confirmed return shape: `PlanConnection` → `edges[].node` → a `Plan` → `itineraries[]` →
  `legs[]` (per-leg routing detail — mode, times, etc.)

**What's NOT independently confirmed** (a direct fetch of the `PlanLabeledLocationInput` input-type
page 404'd during this skill's research pass): the exact leaf field names for supplying a
lat/lon coordinate inside `PlanLabeledLocationInput` (e.g. whether it's
`location: { coordinate: { latitude, longitude } }` or something flatter), and the exact shape of
`PlanDateTimeInput`/`PlanModesInput`. Do not guess these field names from memory or invent a
plausible-looking nesting — the docs page for `planConnection` itself displays a full worked
example (Query/Variables/Response tabs) at
https://docs.opentripplanner.org/api/dev-2.x/graphql-gtfs/queries/planConnection — either fetch
that page fresh (it may need a JS-rendering-capable fetch; a plain WebFetch returned only prose,
not the example tabs, during this research) or, more reliably, open a running instance's
`/graphiql`, autocomplete into `planConnection(...)`, and let the schema explorer show the exact
input shape. That's also the fastest way to confirm whether the same argument/return shape applies
to the Transmodel API's planning query, which was not separately checked here.

## Calling OTP from an external backend — what's actually unverified

The official GraphQL Tutorial only demonstrates GraphiQL. **It does not document the raw HTTP
contract** (exact required headers, whether `variables`/`operationName` are supported the standard
way, error response shape) for calling the API from outside a browser tool. This is very likely
just a standard GraphQL-over-HTTP POST endpoint — `Content-Type: application/json`, body
`{"query": "...", "variables": {...}}` — because that's the universal GraphQL convention and OTP is
a normal GraphQL server, but **do not present this as docs-confirmed**. Before writing production
fetch/HTTP-client code against it:

1. Start OTP locally (or point at a shared instance) and run a query through GraphiQL.
2. Open the browser's network inspector on that GraphiQL request to see the actual request/response
   shape being sent — this is empirical ground truth for the current version, more reliable than
   any cached assumption.
3. Only then write the equivalent `fetch`/`axios`/GraphQL-client call in the target backend
   language.

If the target backend is TypeScript/Node (common for this kind of integration), any standard
GraphQL client (`graphql-request`, `urql`, plain `fetch` with a JSON body) works against a
GraphQL-over-HTTP endpoint — there's nothing OTP-specific needed on the client side once you've
confirmed the request shape per above. Don't reach for a heavier client library than the project
already uses elsewhere.

## Client libraries maintained by the OTP org

- `otp-react-redux` — React/Redux application framework for building OTP-backed trip planner UIs
- `otp-ui` — React component library (map, itinerary display, etc.) for the same
- `otp-java-client` — Java client

These are UI/application-framework libraries, not thin API-wrapper SDKs — evaluate whether they fit
before adopting one; for a simple backend-to-backend integration, a plain GraphQL HTTP call (per
above) is usually simpler than pulling in a React-oriented framework.
