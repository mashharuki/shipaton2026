import {
  applyD1Migrations,
  type D1Migration,
  env,
  SELF,
} from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const API_KEY = "test-shared-key";

function authed(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { ...init.headers, "x-api-key": API_KEY },
  };
}

function put(id: string, body: unknown) {
  return SELF.fetch(
    `http://localhost/v1/push-registrations/${id}`,
    authed({
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function del(id: string) {
  return SELF.fetch(
    `http://localhost/v1/push-registrations/${id}`,
    authed({ method: "DELETE" }),
  );
}

const validBody = {
  expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  fromStationId: "STA_SHINJUKU",
  toStationId: "STA_TOKYO",
  weekdays: ["mon", "tue", "wed", "thu", "fri"],
  notifyAt: "07:45",
  leadMinutes: 20,
  locale: "ja",
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("PUT /v1/push-registrations/:id", () => {
  it("creates a registration with only the minimal fields", async () => {
    const res = await put("push-create", validBody);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = await env.DB.prepare(
      "SELECT * FROM push_registrations WHERE id = ?",
    )
      .bind("push-create")
      .first<Record<string, unknown>>();
    expect(row).toMatchObject({
      id: "push-create",
      expo_push_token: validBody.expoPushToken,
      from_station_id: "STA_SHINJUKU",
      to_station_id: "STA_TOKYO",
      notify_at: "07:45",
      lead_minutes: 20,
      locale: "ja",
    });
    expect(Object.keys(row ?? {}).sort()).toEqual(
      [
        "id",
        "expo_push_token",
        "from_station_id",
        "to_station_id",
        "weekdays",
        "notify_at",
        "lead_minutes",
        "locale",
        "last_sent_date",
      ].sort(),
    );
  });

  it("updates an existing registration in place rather than duplicating it", async () => {
    await put("push-update", validBody);
    const res = await put("push-update", { ...validBody, notifyAt: "08:00" });
    expect(res.status).toBe(200);

    const rows = await env.DB.prepare(
      "SELECT notify_at FROM push_registrations WHERE id = ?",
    )
      .bind("push-update")
      .all<{ notify_at: string }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]?.notify_at).toBe("08:00");
  });

  it("rejects a payload carrying a field outside the minimal contract", async () => {
    const res = await put("push-reject", { ...validBody, userId: "user-1" });
    expect(res.status).toBe(400);

    const row = await env.DB.prepare(
      "SELECT * FROM push_registrations WHERE id = ?",
    )
      .bind("push-reject")
      .first();
    expect(row).toBeNull();
  });
});

describe("DELETE /v1/push-registrations/:id", () => {
  it("deletes an existing registration", async () => {
    await put("push-delete", validBody);

    const res = await del("push-delete");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = await env.DB.prepare(
      "SELECT * FROM push_registrations WHERE id = ?",
    )
      .bind("push-delete")
      .first();
    expect(row).toBeNull();
  });

  it("returns 404 for a registration that does not exist", async () => {
    const res = await del("push-does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "http_error" } });
  });
});
