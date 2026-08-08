import type { CustomerInfo } from "react-native-purchases";
import type { PAYWALL_RESULT as PaywallResultEnum } from "react-native-purchases-ui";
import { PRO_ENTITLEMENT_ID } from "shared";
import { describe, expect, it, vi } from "vitest";

// react-native-purchases-ui hosts native view managers at module load time
// (same wall as react-native itself under this project's Vitest pipeline) --
// mock it down to just the PAYWALL_RESULT enum this test actually needs. Cast
// through the real (string) enum's type-only import so call sites below
// don't need per-call casts.
const PAYWALL_RESULT: Record<string, PaywallResultEnum> = {
  NOT_PRESENTED: "NOT_PRESENTED" as PaywallResultEnum,
  ERROR: "ERROR" as PaywallResultEnum,
  CANCELLED: "CANCELLED" as PaywallResultEnum,
  PURCHASED: "PURCHASED" as PaywallResultEnum,
  RESTORED: "RESTORED" as PaywallResultEnum,
};

vi.mock("react-native-purchases-ui", () => ({
  default: { presentPaywall: vi.fn() },
  PAYWALL_RESULT,
}));

vi.mock("@/features/subscription/purchases-client", () => ({
  isRevenueCatNativeUiAvailable: vi.fn(() => true),
  restorePurchases: vi.fn(),
}));

describe("toPaywallOutcome", () => {
  it("should map every PAYWALL_RESULT value to its PaywallOutcome", async () => {
    const { toPaywallOutcome } = await import(
      "@/features/subscription/use-purchases"
    );

    expect(toPaywallOutcome(PAYWALL_RESULT.PURCHASED)).toEqual({
      type: "purchased",
    });
    expect(toPaywallOutcome(PAYWALL_RESULT.RESTORED)).toEqual({
      type: "restored",
    });
    expect(toPaywallOutcome(PAYWALL_RESULT.CANCELLED)).toEqual({
      type: "cancelled",
    });
    expect(toPaywallOutcome(PAYWALL_RESULT.NOT_PRESENTED)).toEqual({
      type: "not_presented",
    });
    expect(toPaywallOutcome(PAYWALL_RESULT.ERROR)).toEqual({ type: "error" });
  });
});

function customerInfoWithPeriodType(periodType: string): CustomerInfo {
  return {
    entitlements: {
      active: { [PRO_ENTITLEMENT_ID]: { periodType } },
      all: {},
    },
  } as unknown as CustomerInfo;
}

describe("isTrialPeriod", () => {
  it("should be true when the pro entitlement's periodType is TRIAL", async () => {
    const { isTrialPeriod } = await import(
      "@/features/subscription/use-purchases"
    );
    expect(isTrialPeriod(customerInfoWithPeriodType("TRIAL"))).toBe(true);
  });

  it("should be false when the pro entitlement's periodType is NORMAL", async () => {
    const { isTrialPeriod } = await import(
      "@/features/subscription/use-purchases"
    );
    expect(isTrialPeriod(customerInfoWithPeriodType("NORMAL"))).toBe(false);
  });

  it("should be false when there is no active pro entitlement", async () => {
    const { isTrialPeriod } = await import(
      "@/features/subscription/use-purchases"
    );
    const info = {
      entitlements: { active: {}, all: {} },
    } as unknown as CustomerInfo;
    expect(isTrialPeriod(info)).toBe(false);
  });
});

describe("outcomeToAnalyticsEvent", () => {
  it("should map purchased/restored/error to their funnel events", async () => {
    const { outcomeToAnalyticsEvent } = await import(
      "@/features/subscription/use-purchases"
    );
    expect(outcomeToAnalyticsEvent({ type: "purchased" })).toBe(
      "purchase_completed",
    );
    expect(outcomeToAnalyticsEvent({ type: "restored" })).toBe(
      "purchase_restored",
    );
    expect(outcomeToAnalyticsEvent({ type: "error" })).toBe("purchase_failed");
  });

  it("should return null for non-purchase outcomes", async () => {
    const { outcomeToAnalyticsEvent } = await import(
      "@/features/subscription/use-purchases"
    );
    expect(outcomeToAnalyticsEvent({ type: "cancelled" })).toBeNull();
    expect(outcomeToAnalyticsEvent({ type: "not_presented" })).toBeNull();
    expect(outcomeToAnalyticsEvent({ type: "unavailable" })).toBeNull();
  });
});

describe("withTimeout", () => {
  it("should resolve with the underlying promise's value when it settles first", async () => {
    const { withTimeout } = await import(
      "@/features/subscription/use-purchases"
    );
    await expect(withTimeout(Promise.resolve("ok"), 20000)).resolves.toBe("ok");
  });

  it("should reject once the timeout elapses before the promise settles", async () => {
    vi.useFakeTimers();
    try {
      const { withTimeout } = await import(
        "@/features/subscription/use-purchases"
      );
      const neverSettles = new Promise<string>(() => {});
      const result = withTimeout(neverSettles, 20000);
      const assertion = expect(result).rejects.toThrow("timeout");
      await vi.advanceTimersByTimeAsync(20000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
