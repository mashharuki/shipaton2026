import type { AppError } from "../errors/app-error";
import { createAppError } from "../errors/app-error";
import { err, ok, type Result } from "../result";

/**
 * Transitland REST API v2 `/feeds` license flag values (DMFR `license` block).
 * https://www.transit.land/documentation/onestop-id-scheme/ — "unknown" means
 * the feed's DMFR entry never set the field, not that permission was granted.
 */
export const LICENSE_FLAG_VALUES = [
  "yes",
  "no",
  "unknown",
  "exclude_no",
] as const;
export type LicenseFlag = (typeof LICENSE_FLAG_VALUES)[number];

/**
 * The subset of a Transitland feed's DMFR license block this app cares
 * about. Field names mirror Transitland's `/feeds` query parameters
 * (`license_commercial_use_allowed` etc.) so a feed record can be built
 * directly from the API response.
 */
export type FeedLicenseInfo = {
  commercialUseAllowed: LicenseFlag;
  createDerivedProduct: LicenseFlag;
  redistributionAllowed: LicenseFlag;
  shareAlikeOptional: LicenseFlag;
  useWithoutAttribution: LicenseFlag;
};

export type LicenseGateResult = {
  /** true when the feed's license text must be displayed to end users. */
  attributionRequired: boolean;
};

/**
 * Machine license gate (design doc §3.6/§5.1): this app persists a derived,
 * redistributed timetable dataset (GTFS -> our own schema -> served via
 * KV/API), so a feed only clears the gate when commercial use, derived
 * products, and redistribution are all explicitly "yes". "unknown" fails
 * closed on purpose -- the ODPT incident this gate exists to prevent was
 * exactly "found out about the license after ingesting", so an unset flag
 * must not be read as permission.
 */
export function assertLicenseCompatible(
  license: FeedLicenseInfo,
): Result<LicenseGateResult, AppError> {
  const blockingFields: Array<[string, LicenseFlag]> = [
    ["commercialUseAllowed", license.commercialUseAllowed],
    ["createDerivedProduct", license.createDerivedProduct],
    ["redistributionAllowed", license.redistributionAllowed],
  ];

  const failed = blockingFields.filter(([, value]) => value !== "yes");
  if (failed.length > 0) {
    const fields = failed.map(([name, value]) => `${name}=${value}`).join(", ");
    return err(
      createAppError(
        "license_incompatible",
        `Feed license does not clear the gate (${fields})`,
      ),
    );
  }

  return ok({
    attributionRequired: license.useWithoutAttribution !== "yes",
  });
}
