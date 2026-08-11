# GraphQL API

Source: https://www.transit.land/documentation/graphql-api/ ,
https://www.transit.land/plans-pricing/ (confirmed Aug 2026).

## Gate: confirm the user's plan before building around this

**GraphQL access is a paid-tier feature.** The Free plan (10,000 REST queries/month) does **not**
include GraphQL at all — it's gated starting at the Professional plan
($200/mo annual-prepay or $250/mo month-to-month, 25,000 GraphQL queries/month included). This is
confirmed directly from the current pricing page, not an assumption. If a user asks for a GraphQL
integration and hasn't mentioned a paid plan, say so explicitly before writing client code against
it — the REST API (`rest-api.md`) covers the same underlying data on the Free tier, per the docs'
own note that "REST API is actually powered behind the scenes by the GraphQL API" (REST is a
simplified, pre-optimized front door onto the same data).

## Endpoint

```
POST https://transit.land/api/v2/query
```

Standard GraphQL-over-HTTP: POST a JSON body of `{"query": "...", "variables": {...}}`. Same API
key auth as REST (`apikey`/`api_key`/`api_token`/`access_token` as header or query param).

## Exploring the schema

An interactive playground is available at `/saas/graphql-playground` for authenticated Professional
(and above) users — browsable schema, hover docs, example queries. It's explicitly read-only:
mutations/subscriptions are rejected client-side, consistent with GraphQL being a query interface
onto Transitland's data, not a way to write/modify it (feed registration and data changes go
through DMFR/`transitland-atlas` and the fetch/import pipeline instead — see `dmfr-atlas.md` and
`self-hosting-lib.md`).

## Self-hosted GraphQL

If self-hosting via `transitland-lib` (see `self-hosting-lib.md`), running `transitland server`
exposes GraphQL at `/query` on your own instance plus a browsable GraphQL UI at `/` — this is not
gated by transit.land's pricing tiers since it's your own deployment against your own database, but
you're then responsible for whatever data you've imported (it isn't the full hosted dataset unless
you've fetched/imported everything yourself).

## What's not verified

No verbatim example GraphQL query was retrieved during this skill's research pass (the playground
is interactive/JS-rendered, not something a plain page fetch reproduces as text). Before writing
GraphQL queries into production code: open the playground with a Professional-tier key and use its
schema browser to confirm exact field/argument names, the same discipline recommended for OTP's
`planConnection` query in this repo's `opentripplanner` skill — don't hand-write field names from
memory or by analogy to the REST API's shape, since GraphQL schemas commonly diverge from their
REST counterparts even when they're backed by the same data.
