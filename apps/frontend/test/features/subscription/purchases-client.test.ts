import { beforeEach, describe, expect, it, vi } from "vitest";

// react-native / expo-constants / react-native-purchases all pull in native
// code that this project's Vite-based Vitest pipeline can't parse (same wall
// documented for expo-sqlite/kv-store elsewhere) -- mock them so only
// purchases-client.ts's own branching logic is under test.
const configureSpy = vi.fn();
const mockPlatform = { OS: "ios" as string };
const mockConstants = { appOwnership: null as string | null };

vi.mock("react-native", () => ({
  Platform: mockPlatform,
}));

vi.mock("expo-constants", () => ({
  default: mockConstants,
  AppOwnership: { Expo: "expo" },
}));

vi.mock("react-native-purchases", () => ({
  default: {
    configure: configureSpy,
    setLogLevel: vi.fn(),
    getOfferings: vi.fn(),
    getCustomerInfo: vi.fn(),
    addCustomerInfoUpdateListener: vi.fn(),
    removeCustomerInfoUpdateListener: vi.fn(),
  },
  LOG_LEVEL: { DEBUG: "debug" },
}));

vi.mock("@/lib/config", () => ({
  REVENUECAT_IOS_API_KEY: "appl_ios_key",
  REVENUECAT_ANDROID_API_KEY: "goog_android_key",
  REVENUECAT_TEST_STORE_API_KEY: "test_store_key",
}));

beforeEach(() => {
  vi.resetModules();
  configureSpy.mockClear();
  mockPlatform.OS = "ios";
  mockConstants.appOwnership = null;
});

describe("configurePurchases", () => {
  it("should use the iOS key on native iOS outside Expo Go", async () => {
    mockPlatform.OS = "ios";
    const { configurePurchases } = await import(
      "@/features/subscription/purchases-client"
    );
    configurePurchases();
    expect(configureSpy).toHaveBeenCalledWith({ apiKey: "appl_ios_key" });
  });

  it("should use the Android key on native Android outside Expo Go", async () => {
    mockPlatform.OS = "android";
    const { configurePurchases } = await import(
      "@/features/subscription/purchases-client"
    );
    configurePurchases();
    expect(configureSpy).toHaveBeenCalledWith({ apiKey: "goog_android_key" });
  });

  it("should use the Test Store key when running inside Expo Go", async () => {
    mockPlatform.OS = "ios";
    mockConstants.appOwnership = "expo";
    const { configurePurchases } = await import(
      "@/features/subscription/purchases-client"
    );
    configurePurchases();
    expect(configureSpy).toHaveBeenCalledWith({ apiKey: "test_store_key" });
  });

  it("should not call Purchases.configure on web", async () => {
    mockPlatform.OS = "web";
    const { configurePurchases } = await import(
      "@/features/subscription/purchases-client"
    );
    configurePurchases();
    expect(configureSpy).not.toHaveBeenCalled();
  });

  it("should only configure once even when called multiple times", async () => {
    mockPlatform.OS = "ios";
    const { configurePurchases } = await import(
      "@/features/subscription/purchases-client"
    );
    configurePurchases();
    configurePurchases();
    expect(configureSpy).toHaveBeenCalledTimes(1);
  });
});
