import { isErr, isOk } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadLatestFeedVersion,
  searchLicenseCompatibleFeeds,
} from "../../../scripts/ingest/transitland-client";

afterEach(() => {
  vi.restoreAllMocks();
});

function feedsResponse(feeds: unknown[]) {
  return Response.json({ feeds });
}

describe("searchLicenseCompatibleFeeds", () => {
  it("returns a Toei-like CC BY 4.0 feed that clears the license gate", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      feedsResponse([
        {
          onestop_id: "f-xn76-toei",
          name: "Toei Subway",
          spec: "gtfs",
          license: {
            commercial_use_allowed: "yes",
            create_derived_product: "yes",
            redistribution_allowed: "yes",
            share_alike_optional: "no",
            use_without_attribution: "no",
          },
          urls: { static_current: "https://example.test/toei/gtfs.zip" },
        },
      ]),
    );

    const result = await searchLicenseCompatibleFeeds("test-key", {
      operatorOnestopId: "o-xn76-toei",
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        onestopId: "f-xn76-toei",
        originUrl: "https://example.test/toei/gtfs.zip",
      });
    }
  });

  it("drops a feed like JR East's that fails the license gate even if the response includes it", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      feedsResponse([
        {
          onestop_id: "f-xn76-jreast",
          spec: "gtfs",
          license: {
            commercial_use_allowed: "no",
            create_derived_product: "unknown",
            redistribution_allowed: "unknown",
          },
          urls: { static_current: "https://example.test/jreast/gtfs.zip" },
        },
      ]),
    );

    const result = await searchLicenseCompatibleFeeds("test-key", {});

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("treats a feed with no license block at all as unknown and drops it (fail closed)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      feedsResponse([{ onestop_id: "f-no-license", spec: "gtfs" }]),
    );

    const result = await searchLicenseCompatibleFeeds("test-key", {});

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("returns an http_error result when Transitland responds with an error status", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("nope", { status: 500 }),
    );

    const result = await searchLicenseCompatibleFeeds("test-key", {});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("http_error");
    }
  });

  it("returns an offline error result when the request throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await searchLicenseCompatibleFeeds("test-key", {});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("offline");
    }
  });

  it("sends the three blocking license filters and the API key on every request", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => feedsResponse([]));

    await searchLicenseCompatibleFeeds("test-key", {
      searchText: "toei",
    });

    const calledUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get("apikey")).toBe("test-key");
    expect(calledUrl.searchParams.get("license_commercial_use_allowed")).toBe(
      "yes",
    );
    expect(calledUrl.searchParams.get("license_create_derived_product")).toBe(
      "yes",
    );
    expect(calledUrl.searchParams.get("license_redistribution_allowed")).toBe(
      "yes",
    );
    expect(calledUrl.searchParams.get("search")).toBe("toei");
  });
});

describe("downloadLatestFeedVersion", () => {
  it("fetches the archived zip from Transitland's download_latest_feed_version endpoint, not an origin URL", async () => {
    const zipBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(zipBytes));

    const result = await downloadLatestFeedVersion("test-key", "f-xn76-toei");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual(zipBytes);
    }
    const calledUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(calledUrl.pathname).toBe(
      "/api/v2/rest/feeds/f-xn76-toei/download_latest_feed_version",
    );
    expect(calledUrl.searchParams.get("apikey")).toBe("test-key");
  });

  it("returns an http_error result when the download responds with an error status", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("nope", { status: 404 }),
    );

    const result = await downloadLatestFeedVersion("test-key", "f-missing");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("http_error");
    }
  });

  it("returns an offline error result when the request throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await downloadLatestFeedVersion("test-key", "f-xn76-toei");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("offline");
    }
  });
});
