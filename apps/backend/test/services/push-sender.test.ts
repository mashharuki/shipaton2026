import { isErr, isOk } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendExpoPushNotifications } from "../../src/services/push-sender";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendExpoPushNotifications", () => {
  it("does nothing and succeeds when there are no messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await sendExpoPushNotifications([]);

    expect(isOk(result)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the message batch to the Expo push API", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json({ data: [{ status: "ok" }] }),
    );

    const result = await sendExpoPushNotifications([
      { to: "ExponentPushToken[abc]", title: "t", body: "b" },
    ]);

    expect(isOk(result)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns an http_error result when the Expo push API responds with an error status", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response("nope", { status: 500 }),
    );

    const result = await sendExpoPushNotifications([
      { to: "ExponentPushToken[abc]", title: "t", body: "b" },
    ]);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe("http_error");
    }
  });

  it("returns an error result when the request throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await sendExpoPushNotifications([
      { to: "ExponentPushToken[abc]", title: "t", body: "b" },
    ]);

    expect(isErr(result)).toBe(true);
  });
});
