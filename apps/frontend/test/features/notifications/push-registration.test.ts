import { pushRegistrationRequestSchema } from "shared";
import { describe, expect, it, vi } from "vitest";

// push-registration.ts imports expo-notifications, expo-crypto, and (via
// lib/kv-store) expo-sqlite/kv-store at module scope for its zustand persist
// store -- none of these load under this project's Vite-based Vitest
// pipeline (native modules, same wall documented in purchases-client.test.ts
// and usage-limiter.test.ts). Only the two pure functions below are under
// test, so these mocks just need to make the module importable.
vi.mock("expo-notifications", () => ({
  requestPermissionsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  getLastNotificationResponseAsync: vi.fn(),
  clearLastNotificationResponseAsync: vi.fn(),
}));

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(),
}));

vi.mock("expo-sqlite/kv-store", () => ({
  Storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

import {
  buildPushRegistrationRequestBody,
  type PushRegistrationSettings,
  resolveDeepLinkParams,
} from "@/features/notifications/push-registration";

const localRegistration: PushRegistrationSettings = {
  id: "push-reg-local-1",
  fromStationId: "STA_SHINJUKU",
  toStationId: "STA_TOKYO",
  weekdays: ["mon", "tue", "wed", "thu", "fri"],
  notifyAt: "07:45",
  leadMinutes: 20,
  locale: "ja",
};

describe("buildPushRegistrationRequestBody", () => {
  it("should build a request body that satisfies the shared schema", () => {
    const body = buildPushRegistrationRequestBody(
      localRegistration,
      "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    );

    expect(pushRegistrationRequestSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      expoPushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      weekdays: ["mon", "tue", "wed", "thu", "fri"],
      notifyAt: "07:45",
      leadMinutes: 20,
      locale: "ja",
    });
  });
});

describe("resolveDeepLinkParams", () => {
  it("should prefer station ids from the notification payload over local state", () => {
    const params = resolveDeepLinkParams(
      { fromStationId: "STA_A", toStationId: "STA_B" },
      localRegistration,
    );

    expect(params).toEqual({
      fromStationId: "STA_A",
      toStationId: "STA_B",
      departureTime: "07:45",
    });
  });

  it("should fall back to the local registration when the payload has no station ids", () => {
    const params = resolveDeepLinkParams(undefined, localRegistration);

    expect(params).toEqual({
      fromStationId: "STA_SHINJUKU",
      toStationId: "STA_TOKYO",
      departureTime: "07:45",
    });
  });

  it("should return null when neither the payload nor local state has enough data", () => {
    expect(resolveDeepLinkParams(undefined, null)).toBeNull();
  });

  it("should return null when local registration is missing even if the payload has station ids", () => {
    expect(
      resolveDeepLinkParams(
        { fromStationId: "STA_A", toStationId: "STA_B" },
        null,
      ),
    ).toBeNull();
  });
});
