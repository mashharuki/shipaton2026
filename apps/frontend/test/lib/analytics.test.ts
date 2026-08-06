import { afterEach, describe, expect, it, vi } from "vitest";

// expo-crypto transitively imports expo-modules-core -> react-native, which
// (like every RN import) can't be parsed under this project's Vitest/Vite
// pipeline (Flow syntax, see api-client/dataset-repository tasks' notes).
// Mocking the module means it's never actually loaded/parsed.
vi.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

import { createAnalyticsClient } from "@/lib/analytics";

function mockFetchAccepting(count: number) {
  globalThis.fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ accepted: count }), { status: 200 }),
    ) as unknown as typeof fetch;
}

function mockFetchOffline() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(
      new TypeError("Network request failed"),
    ) as unknown as typeof fetch;
}

function lastRequestBody(): { events: Array<Record<string, unknown>> } {
  const [, init] = vi.mocked(globalThis.fetch).mock.calls.at(-1) ?? [];
  return JSON.parse((init as RequestInit).body as string);
}

describe("analytics client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should not send anything until flush is called or the batch threshold is reached", () => {
    mockFetchAccepting(1);
    const client = createAnalyticsClient();

    client.track("search_started", {});

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("should batch-send tracked events on flush and clear them on success", async () => {
    mockFetchAccepting(2);
    const client = createAnalyticsClient();

    client.track("search_started", {});
    client.track("search_completed", {});
    await client.flush();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(lastRequestBody().events).toHaveLength(2);

    // flushing again with nothing new buffered should not re-send
    await client.flush();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("should auto-flush once the buffer reaches 20 events", () => {
    mockFetchAccepting(20);
    const client = createAnalyticsClient();

    for (let i = 0; i < 20; i++) {
      client.track("search_started", {});
    }

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(lastRequestBody().events).toHaveLength(20);
  });

  it("should send at most 20 events per request, keeping the rest buffered", async () => {
    mockFetchAccepting(20);
    const client = createAnalyticsClient();

    for (let i = 0; i < 20; i++) {
      client.track("search_started", {});
    }
    // the 21st push crosses the threshold again only once 20 more accumulate;
    // manually flush to confirm the remainder is still queued.
    client.track("search_started", {});
    await client.flush();

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(lastRequestBody().events).toHaveLength(1);
  });

  it("should keep events buffered for retry when the send fails", async () => {
    mockFetchOffline();
    const client = createAnalyticsClient();
    client.track("search_started", {});

    await client.flush();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    mockFetchAccepting(1);
    await client.flush();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(lastRequestBody().events).toHaveLength(1);
  });

  it("should merge common properties into every event, with event-specific props taking precedence", async () => {
    mockFetchAccepting(1);
    const client = createAnalyticsClient();

    client.setCommonProps({ planType: "free", railwayId: "RAIL_CHUO" });
    client.track("search_started", { planType: "pro" });
    await client.flush();

    const [event] = lastRequestBody().events;
    expect(event.props).toEqual({ planType: "pro", railwayId: "RAIL_CHUO" });
  });

  it("should attach a sessionId and occurredAt timestamp to every event", async () => {
    mockFetchAccepting(1);
    const client = createAnalyticsClient();

    client.track("search_started", {});
    await client.flush();

    const [event] = lastRequestBody().events;
    expect(typeof event.sessionId).toBe("string");
    expect(event.sessionId).not.toHaveLength(0);
    expect(() =>
      new Date(event.occurredAt as string).toISOString(),
    ).not.toThrow();
  });

  it("should reuse the same sessionId across events from the same client", async () => {
    mockFetchAccepting(2);
    const client = createAnalyticsClient();

    client.track("search_started", {});
    client.track("search_completed", {});
    await client.flush();

    const [first, second] = lastRequestBody().events;
    expect(first.sessionId).toBe(second.sessionId);
  });
});
