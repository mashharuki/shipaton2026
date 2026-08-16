import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const API_KEY = "test-shared-key";

function authed(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...init.headers, "x-api-key": API_KEY },
  };
}

async function seed(name: string, version: string, payload: unknown) {
  await env.STATUS_CACHE.put(
    `dataset:${name}`,
    JSON.stringify({ version, payload }),
  );
}

beforeEach(async () => {
  // KV state is not test-isolated in this project's pool config, so each
  // test clears the keys it depends on rather than assuming a clean slate.
  await env.STATUS_CACHE.delete("dataset:timetable");
  await env.STATUS_CACHE.delete("dataset:congestion");
  await env.STATUS_CACHE.delete("dataset:correction");
});

describe("GET /v1/datasets/:name", () => {
  it("returns the payload when since is omitted", async () => {
    await seed("timetable", "3", {
      schemaVersion: 1,
      stations: [],
      trips: [],
    });

    const res = await SELF.fetch(
      "http://localhost/v1/datasets/timetable",
      authed(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      version: "3",
      payload: { schemaVersion: 1, stations: [], trips: [] },
    });
  });

  it("returns the payload when since does not match the stored version", async () => {
    await seed("congestion", "5", { schemaVersion: 1, profiles: [] });

    const res = await SELF.fetch(
      "http://localhost/v1/datasets/congestion?since=4",
      authed(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      version: "5",
      payload: { schemaVersion: 1, profiles: [] },
    });
  });

  it("returns notModified when since matches the stored version", async () => {
    await seed("correction", "2", { schemaVersion: 1, stats: [] });

    const res = await SELF.fetch(
      "http://localhost/v1/datasets/correction?since=2",
      authed(),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: "2", notModified: true });
  });

  it("returns 404 when the dataset has not been pushed to KV", async () => {
    const res = await SELF.fetch(
      "http://localhost/v1/datasets/timetable",
      authed(),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "http_error" } });
  });
});
