import { applyD1Migrations, type D1Migration, env } from "cloudflare:test";
import { isErr, isOk } from "shared";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  isInNotifyWindow,
  runNotifyCommuters,
} from "../../src/cron/notify-commuters";
import {
  upsertCorrectionStats,
  upsertPushRegistration,
} from "../../src/db/queries";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

// JST 2026-08-05 (Wed) 07:25 == UTC 2026-08-04T22:25:00.000Z.
const NOW = new Date("2026-08-04T22:25:00.000Z");
const LEG = "STA_A-STA_B";

const CONGESTION_DATASET = {
  version: "1",
  payload: {
    schemaVersion: 1,
    profiles: [
      {
        railwayId: "RAIL_CHUO",
        legKey: LEG,
        timeBucket: "07:45",
        dayType: "weekday",
        carNumber: 1,
        loadScore: 0.7,
        sampleSize: 20,
      },
      {
        railwayId: "RAIL_CHUO",
        legKey: LEG,
        timeBucket: "07:15",
        dayType: "weekday",
        carNumber: 1,
        loadScore: 0.3,
        sampleSize: 20,
      },
    ],
  },
};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM push_registrations").run();
  await env.DB.prepare("DELETE FROM correction_stats").run();
  await env.STATUS_CACHE.put(
    "dataset:congestion",
    JSON.stringify(CONGESTION_DATASET),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expoPushResponse(): Response {
  return Response.json({ data: [{ status: "ok" }] });
}

describe("isInNotifyWindow", () => {
  it("matches a registration whose notifyAt - leadMinutes lands in the current 5-minute window", () => {
    expect(
      isInNotifyWindow(
        { weekdays: ["wed"], notifyAt: "07:45", leadMinutes: 20 },
        NOW,
      ),
    ).toBe(true);
  });

  it("does not match a registration whose target time falls outside the window", () => {
    expect(
      isInNotifyWindow(
        { weekdays: ["wed"], notifyAt: "09:00", leadMinutes: 15 },
        NOW,
      ),
    ).toBe(false);
  });

  it("does not match a registration not scheduled for the current weekday", () => {
    expect(
      isInNotifyWindow(
        { weekdays: ["mon"], notifyAt: "07:45", leadMinutes: 20 },
        NOW,
      ),
    ).toBe(false);
  });
});

describe("runNotifyCommuters", () => {
  it("extracts window matches, sends a notification with an alternative candidate, and marks it sent", async () => {
    await upsertPushRegistration(env.DB, {
      id: "push-1",
      expoPushToken: "ExponentPushToken[xxx]",
      fromStationId: "STA_A",
      toStationId: "STA_B",
      weekdays: ["wed"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
      lastSentDate: null,
    });
    await upsertCorrectionStats(env.DB, {
      railwayId: "RAIL_CHUO",
      legKey: LEG,
      timeBucket: "07:45",
      dayType: "weekday",
      deltaScore: 0.1,
      sampleN: 8,
      computedAt: NOW.toISOString(),
    });

    let sentBody: unknown;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      sentBody = JSON.parse((init as RequestInit).body as string);
      return expoPushResponse();
    });

    const result = await runNotifyCommuters(env.DB, env.STATUS_CACHE, NOW);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({
        windowMatched: 1,
        notified: 1,
        skippedAlreadySent: 0,
      });
    }

    expect(sentBody).toEqual([
      expect.objectContaining({
        to: "ExponentPushToken[xxx]",
        body: expect.stringContaining("07:15"),
        data: expect.objectContaining({
          registrationId: "push-1",
          alternative: { timeBucket: "07:15", standingMinutesSaved: 12 },
          reasonFactor: "feedback_correction",
        }),
      }),
    ]);
    // The delivered body must also carry a human-readable reason, not just
    // the alternative -- Requirement 10.3 ("変化の理由を含めて通知する").
    expect((sentBody as [{ body: string }])[0]?.body).toContain(
      "混雑が多めに報告",
    );

    const row = await env.DB.prepare(
      "SELECT last_sent_date FROM push_registrations WHERE id = ?",
    )
      .bind("push-1")
      .first<{ last_sent_date: string }>();
    expect(row?.last_sent_date).toBe("2026-08-05");
  });

  it("does not send when the registration is outside the current window", async () => {
    await upsertPushRegistration(env.DB, {
      id: "push-outside",
      expoPushToken: "ExponentPushToken[xxx]",
      fromStationId: "STA_A",
      toStationId: "STA_B",
      weekdays: ["wed"],
      notifyAt: "09:00",
      leadMinutes: 15,
      locale: "ja",
      lastSentDate: null,
    });
    await upsertCorrectionStats(env.DB, {
      railwayId: "RAIL_CHUO",
      legKey: LEG,
      timeBucket: "07:45",
      dayType: "weekday",
      deltaScore: 0.1,
      sampleN: 8,
      computedAt: NOW.toISOString(),
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runNotifyCommuters(env.DB, env.STATUS_CACHE, NOW);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({
        windowMatched: 0,
        notified: 0,
        skippedAlreadySent: 0,
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not send when no correction cell indicates above-normal crowding", async () => {
    await upsertPushRegistration(env.DB, {
      id: "push-no-signal",
      expoPushToken: "ExponentPushToken[xxx]",
      fromStationId: "STA_A",
      toStationId: "STA_B",
      weekdays: ["wed"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
      lastSentDate: null,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runNotifyCommuters(env.DB, env.STATUS_CACHE, NOW);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.data).toEqual({
        windowMatched: 1,
        notified: 0,
        skippedAlreadySent: 0,
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is idempotent -- does not resend to a registration already notified today", async () => {
    await upsertPushRegistration(env.DB, {
      id: "push-dedup",
      expoPushToken: "ExponentPushToken[xxx]",
      fromStationId: "STA_A",
      toStationId: "STA_B",
      weekdays: ["wed"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
      lastSentDate: null,
    });
    await upsertCorrectionStats(env.DB, {
      railwayId: "RAIL_CHUO",
      legKey: LEG,
      timeBucket: "07:45",
      dayType: "weekday",
      deltaScore: 0.1,
      sampleN: 8,
      computedAt: NOW.toISOString(),
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => expoPushResponse());

    const first = await runNotifyCommuters(env.DB, env.STATUS_CACHE, NOW);
    expect(isOk(first)).toBe(true);
    if (isOk(first)) {
      expect(first.data.notified).toBe(1);
    }

    fetchSpy.mockClear();
    const second = await runNotifyCommuters(env.DB, env.STATUS_CACHE, NOW);

    expect(isOk(second)).toBe(true);
    if (isOk(second)) {
      expect(second.data).toEqual({
        windowMatched: 1,
        notified: 0,
        skippedAlreadySent: 1,
      });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("propagates a push-send failure without marking the registration as sent", async () => {
    await upsertPushRegistration(env.DB, {
      id: "push-fail",
      expoPushToken: "ExponentPushToken[xxx]",
      fromStationId: "STA_A",
      toStationId: "STA_B",
      weekdays: ["wed"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
      lastSentDate: null,
    });
    await upsertCorrectionStats(env.DB, {
      railwayId: "RAIL_CHUO",
      legKey: LEG,
      timeBucket: "07:45",
      dayType: "weekday",
      deltaScore: 0.1,
      sampleN: 8,
      computedAt: NOW.toISOString(),
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("nope", { status: 500 }),
    );

    const result = await runNotifyCommuters(env.DB, env.STATUS_CACHE, NOW);
    expect(isErr(result)).toBe(true);

    const row = await env.DB.prepare(
      "SELECT last_sent_date FROM push_registrations WHERE id = ?",
    )
      .bind("push-fail")
      .first<{ last_sent_date: string | null }>();
    expect(row?.last_sent_date).toBeNull();
  });
});
