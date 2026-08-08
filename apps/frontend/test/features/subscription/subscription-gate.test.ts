import type { CustomerInfo } from "react-native-purchases";
import { PRO_ENTITLEMENT_ID } from "shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchCustomerInfoMock = vi.fn();
const addCustomerInfoListenerMock = vi.fn();
const hasReachedDailySearchLimitMock = vi.fn();
const ensureUsageLimiterHydratedMock = vi.fn();
const mockPlatform = { OS: "ios" as string };

vi.mock("react-native", () => ({ Platform: mockPlatform }));

vi.mock("@/features/subscription/purchases-client", () => ({
  fetchCustomerInfo: fetchCustomerInfoMock,
  addCustomerInfoListener: addCustomerInfoListenerMock,
}));

vi.mock("@/features/subscription/usage-limiter", () => ({
  hasReachedDailySearchLimit: hasReachedDailySearchLimitMock,
  ensureUsageLimiterHydrated: ensureUsageLimiterHydratedMock,
}));

function freeCustomerInfo(): CustomerInfo {
  return { entitlements: { active: {}, all: {} } } as unknown as CustomerInfo;
}

function proCustomerInfo(): CustomerInfo {
  return {
    entitlements: {
      active: { [PRO_ENTITLEMENT_ID]: {} },
      all: { [PRO_ENTITLEMENT_ID]: {} },
    },
  } as unknown as CustomerInfo;
}

type MinimalStorage = { getItem(key: string): string | null };

// This Vitest environment is "node" (no DOM), so `globalThis.localStorage`
// doesn't exist by default -- stubbed per-test to exercise
// subscription-gate.ts's e2eProOverride(), which reads it via a structural
// (not `Storage`-typed) global lookup for exactly this reason.
function setFakeLocalStorage(value: string | undefined): void {
  const globalWithStorage = globalThis as { localStorage?: MinimalStorage };
  globalWithStorage.localStorage = value ? { getItem: () => value } : undefined;
}

beforeEach(() => {
  vi.resetModules();
  fetchCustomerInfoMock.mockReset();
  addCustomerInfoListenerMock.mockReset();
  hasReachedDailySearchLimitMock.mockReset();
  ensureUsageLimiterHydratedMock.mockReset();
  hasReachedDailySearchLimitMock.mockReturnValue(false);
  addCustomerInfoListenerMock.mockReturnValue(() => {});
  ensureUsageLimiterHydratedMock.mockResolvedValue(undefined);
  mockPlatform.OS = "ios";
  setFakeLocalStorage(undefined);
});

describe("subscription-gate", () => {
  it("should default to isPro() false before initSubscriptionGate resolves", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: freeCustomerInfo(),
    });
    const { isPro } = await import("@/features/subscription/subscription-gate");
    expect(isPro()).toBe(false);
  });

  it("should become Pro after initSubscriptionGate resolves with an active pro entitlement", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: proCustomerInfo(),
    });
    const { initSubscriptionGate, isPro } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    expect(isPro()).toBe(true);
  });

  it("should allow search_limit while under the daily limit for a free user", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: freeCustomerInfo(),
    });
    hasReachedDailySearchLimitMock.mockReturnValue(false);
    const { initSubscriptionGate, guard } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    expect(guard({ type: "search_limit" })).toEqual({ allowed: true });
  });

  it("should block search_limit on the 4th search for a free user", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: freeCustomerInfo(),
    });
    hasReachedDailySearchLimitMock.mockReturnValue(true);
    const { initSubscriptionGate, guard } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    expect(guard({ type: "search_limit" })).toEqual({
      allowed: false,
      trigger: { type: "search_limit" },
    });
  });

  it("should never block search_limit for a Pro user regardless of usage", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: proCustomerInfo(),
    });
    hasReachedDailySearchLimitMock.mockReturnValue(true);
    const { initSubscriptionGate, guard } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    expect(guard({ type: "search_limit" })).toEqual({ allowed: true });
  });

  it("should block a pro_feature trigger for a free user", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: freeCustomerInfo(),
    });
    const { initSubscriptionGate, guard } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    const trigger = { type: "pro_feature", feature: "coach" } as const;
    expect(guard(trigger)).toEqual({ allowed: false, trigger });
  });

  it("should allow a pro_feature trigger for a Pro user", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: proCustomerInfo(),
    });
    const { initSubscriptionGate, guard } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    expect(guard({ type: "pro_feature", feature: "coach" })).toEqual({
      allowed: true,
    });
  });

  it("should block a saved_route_limit trigger for a free user", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: freeCustomerInfo(),
    });
    const { initSubscriptionGate, guard } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    const trigger = { type: "saved_route_limit" } as const;
    expect(guard(trigger)).toEqual({ allowed: false, trigger });
  });

  it("should notify onEntitlementChange listeners when CustomerInfo updates flip Pro status", async () => {
    fetchCustomerInfoMock.mockResolvedValue({
      ok: true,
      data: freeCustomerInfo(),
    });
    let deliverCustomerInfoUpdate: ((info: CustomerInfo) => void) | undefined;
    addCustomerInfoListenerMock.mockImplementation(
      (listener: (info: CustomerInfo) => void) => {
        deliverCustomerInfoUpdate = listener;
        return () => {};
      },
    );
    const { initSubscriptionGate, onEntitlementChange, isPro } = await import(
      "@/features/subscription/subscription-gate"
    );
    await initSubscriptionGate();
    expect(isPro()).toBe(false);

    const onChange = vi.fn();
    onEntitlementChange(onChange);

    deliverCustomerInfoUpdate?.(proCustomerInfo());

    expect(isPro()).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  describe("e2e Pro override (10.2)", () => {
    it("should ignore the override on native platforms even if set", async () => {
      mockPlatform.OS = "ios";
      setFakeLocalStorage("true");
      fetchCustomerInfoMock.mockResolvedValue({
        ok: true,
        data: freeCustomerInfo(),
      });
      const { isPro } = await import(
        "@/features/subscription/subscription-gate"
      );
      expect(isPro()).toBe(false);
    });

    it("should force Pro on web when e2e_pro_override is 'true', overriding a Free CustomerInfo", async () => {
      mockPlatform.OS = "web";
      setFakeLocalStorage("true");
      fetchCustomerInfoMock.mockResolvedValue({
        ok: true,
        data: freeCustomerInfo(),
      });
      const { initSubscriptionGate, isPro } = await import(
        "@/features/subscription/subscription-gate"
      );
      await initSubscriptionGate();
      expect(isPro()).toBe(true);
    });

    it("should force Free on web when e2e_pro_override is 'false', overriding a Pro CustomerInfo", async () => {
      mockPlatform.OS = "web";
      setFakeLocalStorage("false");
      fetchCustomerInfoMock.mockResolvedValue({
        ok: true,
        data: proCustomerInfo(),
      });
      const { initSubscriptionGate, isPro } = await import(
        "@/features/subscription/subscription-gate"
      );
      await initSubscriptionGate();
      expect(isPro()).toBe(false);
    });

    it("should fall back to CustomerInfo on web when no override is set", async () => {
      mockPlatform.OS = "web";
      setFakeLocalStorage(undefined);
      fetchCustomerInfoMock.mockResolvedValue({
        ok: true,
        data: proCustomerInfo(),
      });
      const { initSubscriptionGate, isPro } = await import(
        "@/features/subscription/subscription-gate"
      );
      await initSubscriptionGate();
      expect(isPro()).toBe(true);
    });
  });
});
