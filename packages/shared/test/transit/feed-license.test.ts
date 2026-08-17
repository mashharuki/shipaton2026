import { describe, expect, it } from "vitest";
import { isErr, isOk } from "../../src/result";
import {
  assertLicenseCompatible,
  type FeedLicenseInfo,
} from "../../src/transit/feed-license";

function license(overrides: Partial<FeedLicenseInfo> = {}): FeedLicenseInfo {
  return {
    commercialUseAllowed: "yes",
    createDerivedProduct: "yes",
    redistributionAllowed: "yes",
    shareAlikeOptional: "no",
    useWithoutAttribution: "no",
    ...overrides,
  };
}

describe("assertLicenseCompatible", () => {
  it("passes a Toei-like CC BY 4.0 feed and flags attribution as required", () => {
    const result = assertLicenseCompatible(license());

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.attributionRequired).toBe(true);
    }
  });

  it("does not require attribution when the feed explicitly waives it", () => {
    const result = assertLicenseCompatible(
      license({ useWithoutAttribution: "yes" }),
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data.attributionRequired).toBe(false);
    }
  });

  it("rejects a feed like JR East's timetable that forbids commercial use", () => {
    const result = assertLicenseCompatible(
      license({ commercialUseAllowed: "no" }),
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("license_incompatible");
    }
  });

  it("rejects when derived products are not allowed", () => {
    const result = assertLicenseCompatible(
      license({ createDerivedProduct: "no" }),
    );

    expect(isErr(result)).toBe(true);
  });

  it("rejects when redistribution is not allowed", () => {
    const result = assertLicenseCompatible(
      license({ redistributionAllowed: "no" }),
    );

    expect(isErr(result)).toBe(true);
  });

  it("fails closed when a blocking flag is unknown rather than explicitly yes", () => {
    const result = assertLicenseCompatible(
      license({ redistributionAllowed: "unknown" }),
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain("redistributionAllowed=unknown");
    }
  });

  it("fails closed on exclude_no the same as an explicit no", () => {
    const result = assertLicenseCompatible(
      license({ commercialUseAllowed: "exclude_no" }),
    );

    expect(isErr(result)).toBe(true);
  });

  it("reports every blocking field that failed, not just the first", () => {
    const result = assertLicenseCompatible(
      license({ commercialUseAllowed: "no", redistributionAllowed: "no" }),
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain("commercialUseAllowed=no");
      expect(result.error.message).toContain("redistributionAllowed=no");
    }
  });
});
