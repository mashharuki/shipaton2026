import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const API_KEY = "test-shared-key";

function authed(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...init.headers, "x-api-key": API_KEY },
  };
}

describe("GET /doc", () => {
  it("responds without an api key and lists all 5 route operations", async () => {
    const res = await SELF.fetch("http://localhost/doc");
    expect(res.status).toBe(200);
    const doc = await res.json<{
      info: { title: string };
      paths: Record<string, unknown>;
    }>();
    expect(doc.info.title).toBe("SeatSignal API");
    expect(Object.keys(doc.paths).sort()).toEqual([
      "/v1/datasets/{name}",
      "/v1/events",
      "/v1/feedback",
      "/v1/push-registrations/{id}",
      "/v1/train-status/{railwayId}",
    ]);
  });
});

describe("x-api-key auth", () => {
  it("rejects /v1/* requests without a valid key", async () => {
    const missing = await SELF.fetch("http://localhost/v1/datasets/timetable");
    expect(missing.status).toBe(401);

    const wrong = await SELF.fetch("http://localhost/v1/datasets/timetable", {
      headers: { "x-api-key": "wrong-key" },
    });
    expect(wrong.status).toBe(401);
  });
});

describe("route stubs", () => {
  it("GET /v1/datasets/:name returns 501", async () => {
    const res = await SELF.fetch(
      "http://localhost/v1/datasets/timetable",
      authed(),
    );
    expect(res.status).toBe(501);
  });

  it("GET /v1/train-status/:railwayId returns 501", async () => {
    const res = await SELF.fetch(
      "http://localhost/v1/train-status/RAIL_CHUO",
      authed(),
    );
    expect(res.status).toBe(501);
  });

  it("PUT /v1/push-registrations/:id returns 501", async () => {
    const res = await SELF.fetch(
      "http://localhost/v1/push-registrations/push-1",
      authed({
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
          fromStationId: "STA_SHINJUKU",
          toStationId: "STA_TOKYO",
          weekdays: ["mon", "tue", "wed", "thu", "fri"],
          notifyAt: "07:45",
          leadMinutes: 20,
          locale: "ja",
        }),
      }),
    );
    expect(res.status).toBe(501);
  });

  it("DELETE /v1/push-registrations/:id returns 501", async () => {
    const res = await SELF.fetch(
      "http://localhost/v1/push-registrations/push-1",
      authed({ method: "DELETE" }),
    );
    expect(res.status).toBe(501);
  });
});

describe("IP rate limit on write endpoints", () => {
  it("returns 429 after exceeding the feedback quota for one IP", async () => {
    const body = JSON.stringify({
      seatedOutcome: "seated_from_start",
      tripId: "6f9a2b3e-4b7a-4a4b-8b2b-9b6b1e2e3f4a",
      railwayId: "RAIL_CHUO",
      legKey: "STA_SHINJUKU-STA_TOKYO",
      boardedAt: "07:30",
    });
    const request = () =>
      SELF.fetch(
        "http://localhost/v1/feedback",
        authed({
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }),
      );

    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await request();
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 501).length).toBe(30);
    expect(statuses.at(-1)).toBe(429);
  });

  it("returns 429 after exceeding the events quota independently of feedback", async () => {
    const body = JSON.stringify({
      events: [
        {
          name: "route_selected",
          props: { railwayId: "RAIL_CHUO" },
          sessionId: "session-1",
          occurredAt: "2026-08-04T07:30:00.000Z",
        },
      ],
    });
    const request = () =>
      SELF.fetch(
        "http://localhost/v1/events",
        authed({
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }),
      );

    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      const res = await request();
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 501).length).toBe(30);
    expect(statuses.at(-1)).toBe(429);
  });
});
