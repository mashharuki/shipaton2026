import type { PAYWALL_RESULT as PaywallResultEnum } from "react-native-purchases-ui";
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
