/**
 * Transitland REST API v2 `/feeds` client -- the license gate's data source
 * (design doc §3.6/§5.1: docs/superpowers/specs/2026-08-13-transit-data-sourcing-design.md).
 *
 * This module is ingestion tooling (run offline via `ingest-toei-gtfs.ts`),
 * not a deployed Workers dependency -- see apps/backend/CLAUDE.md: `src/`
 * is the Workers bundle, `scripts/` is Node-only tooling and is never
 * bundled or deployed.
 *
 * GTFS zip bytes are pulled from Transitland's own **Feed Archive**
 * (`GET /feeds/{feed_key}/download_latest_feed_version`), not from a feed's
 * `urls.static_current` (the operator's own hosted URL, which is what
 * Transitland's *own* fetcher uses internally -- fetching it ourselves would
 * duplicate that fetch against a source we don't control, with no guarantee
 * it's still up or unchanged since Transitland last archived it).
 * `references/rest-api.md` in this repo's `transitland` skill confirms both
 * `download_latest_feed_version` and `/feed_versions/{key}/download` exist
 * in the OpenAPI spec -- the endpoint list there is cross-verified against
 * `interline-io/transitland-lib`'s source, unlike the rest of this file's
 * response-shape assumptions (see below).
 *
 * The `/feeds` response shape below is transcribed from the OpenAPI spec
 * referenced in the design doc (https://transit.land/api/v2/rest/openapi.json)
 * but has not been exercised against a live response in this environment
 * (outbound network access is unavailable here) -- verify field names
 * against a real response before trusting this for production ingestion.
 */
import {
  type AppError,
  assertLicenseCompatible,
  createAppError,
  err,
  type FeedLicenseInfo,
  type LicenseFlag,
  ok,
  type Result,
} from "shared";

const TRANSITLAND_REST_BASE = "https://transit.land/api/v2/rest";

export type TransitlandFeed = {
  onestopId: string;
  name: string | null;
  spec: string;
  license: FeedLicenseInfo;
  /** The operator's own hosted URL, kept for attribution/provenance display only -- never fetched directly. See module header. */
  originUrl: string | null;
};

type RawLicenseBlock = Partial<
  Record<
    | "commercial_use_allowed"
    | "create_derived_product"
    | "redistribution_allowed"
    | "share_alike_optional"
    | "use_without_attribution",
    string
  >
>;

type RawFeed = {
  onestop_id?: string;
  name?: string | null;
  spec?: string;
  license?: RawLicenseBlock;
  urls?: { static_current?: string | null };
};

type RawFeedsResponse = { feeds?: RawFeed[] };

function toLicenseFlag(value: string | undefined): LicenseFlag {
  return value === "yes" || value === "no" || value === "exclude_no"
    ? value
    : "unknown";
}

function toFeed(raw: RawFeed): TransitlandFeed | null {
  if (!raw.onestop_id) {
    return null;
  }
  const license = raw.license ?? {};
  return {
    onestopId: raw.onestop_id,
    name: raw.name ?? null,
    spec: raw.spec ?? "unknown",
    license: {
      commercialUseAllowed: toLicenseFlag(license.commercial_use_allowed),
      createDerivedProduct: toLicenseFlag(license.create_derived_product),
      redistributionAllowed: toLicenseFlag(license.redistribution_allowed),
      shareAlikeOptional: toLicenseFlag(license.share_alike_optional),
      useWithoutAttribution: toLicenseFlag(license.use_without_attribution),
    },
    originUrl: raw.urls?.static_current ?? null,
  };
}

/**
 * Searches Transitland for feeds, applying the license filters at the query
 * level (belt) so incompatible feeds are excluded from the API response
 * itself, in addition to `assertLicenseCompatible` re-checking every result
 * (suspenders) -- a feed's license can change between calls, and design
 * principle 1 is that license compliance is machine-checked, not assumed
 * from a query parameter alone.
 */
export async function searchLicenseCompatibleFeeds(
  apiKey: string,
  params: { operatorOnestopId?: string; searchText?: string },
): Promise<Result<TransitlandFeed[], AppError>> {
  const url = new URL(`${TRANSITLAND_REST_BASE}/feeds`);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("license_commercial_use_allowed", "yes");
  url.searchParams.set("license_create_derived_product", "yes");
  url.searchParams.set("license_redistribution_allowed", "yes");
  if (params.operatorOnestopId) {
    url.searchParams.set("operator_onestop_id", params.operatorOnestopId);
  }
  if (params.searchText) {
    url.searchParams.set("search", params.searchText);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return err(
        createAppError(
          "http_error",
          `Transitland /feeds responded ${response.status}`,
        ),
      );
    }
    const body = (await response.json()) as RawFeedsResponse;
    const feeds = (body.feeds ?? [])
      .map(toFeed)
      .filter((feed): feed is TransitlandFeed => feed !== null)
      .filter((feed) => {
        const gate = assertLicenseCompatible(feed.license);
        return gate.ok;
      });
    return ok(feeds);
  } catch (cause) {
    return err(
      createAppError("offline", "Transitland /feeds request failed", cause),
    );
  }
}

/**
 * Downloads the latest archived GTFS static zip for a feed from
 * Transitland's own Feed Archive, not the operator's origin URL -- see
 * module header. `feedOnestopId` is passed as `{feed_key}`, which accepts
 * a Onestop ID directly per rest-api.md's "Key convention" (no need to
 * resolve it to an integer database ID first).
 */
export async function downloadLatestFeedVersion(
  apiKey: string,
  feedOnestopId: string,
): Promise<Result<Uint8Array, AppError>> {
  const url = new URL(
    `${TRANSITLAND_REST_BASE}/feeds/${encodeURIComponent(feedOnestopId)}/download_latest_feed_version`,
  );
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return err(
        createAppError(
          "http_error",
          `Transitland download_latest_feed_version responded ${response.status} for ${feedOnestopId}`,
        ),
      );
    }
    return ok(new Uint8Array(await response.arrayBuffer()));
  } catch (cause) {
    return err(
      createAppError(
        "offline",
        `Transitland download_latest_feed_version request failed for ${feedOnestopId}`,
        cause,
      ),
    );
  }
}
