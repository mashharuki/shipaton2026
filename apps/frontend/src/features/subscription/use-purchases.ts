import { useCallback, useState } from "react";
import type { CustomerInfo } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { PRO_ENTITLEMENT_ID } from "shared";

import { restorePurchases } from "@/features/subscription/purchases-client";
import type { AnalyticsEventName } from "@/lib/analytics";

// design.md: purchases go through RevenueCatUI.presentPaywall() (the
// dashboard-configured template drives the actual purchase), never a
// hand-rolled Purchases.purchasePackage() call -- this hook only reacts to
// the result. react-native-purchases-ui stays confined to this file, same
// react-native-purchases boundary purchases-client.ts already established.
export type PaywallOutcome =
  | { type: "purchased" }
  | { type: "restored" }
  | { type: "cancelled" } // 13.6: not an error
  | { type: "error" } // 13.7: caller should offer a retry
  | { type: "not_presented" };

// Exported (rather than private) so its mapping can be Vitest-tested
// directly -- react-native-purchases-ui can't be exercised end-to-end in
// this project's Vitest pipeline (native view host, same wall as every
// other RN-rendering dependency here), but this pure function is the actual
// decision logic and needs no native module to test.
export function toPaywallOutcome(result: PAYWALL_RESULT): PaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return { type: "purchased" };
    case PAYWALL_RESULT.RESTORED:
      return { type: "restored" };
    case PAYWALL_RESULT.CANCELLED:
      return { type: "cancelled" };
    case PAYWALL_RESULT.NOT_PRESENTED:
      return { type: "not_presented" };
    default:
      return { type: "error" };
  }
}

// 17.1/10.1: distinguishes a trial-period purchase from a full purchase.
// presentPaywall() only resolves to the PAYWALL_RESULT enum (no CustomerInfo
// payload), so the caller re-fetches CustomerInfo and passes it here; kept
// as its own pure function (same "extract the decision logic" precedent as
// toPaywallOutcome) so the periodType check is Vitest-testable without a
// native host.
export function isTrialPeriod(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID]?.periodType === "TRIAL";
}

// 17.1/10.1: maps a paywall outcome to the funnel event it represents.
// `trial_started` is deliberately not produced here -- it depends on
// CustomerInfo (via isTrialPeriod), which this function doesn't have; the
// caller special-cases "purchased" + isTrialPeriod before falling back to
// this mapping. `cancelled`/`not_presented` return null: neither is one of
// the 17.1 funnel events (a cancellation isn't a failure, 13.6).
export function outcomeToAnalyticsEvent(
  outcome: PaywallOutcome,
): AnalyticsEventName | null {
  switch (outcome.type) {
    case "purchased":
      return "purchase_completed";
    case "restored":
      return "purchase_restored";
    case "error":
      return "purchase_failed";
    default:
      return null;
  }
}

// Observed directly against a booted iOS simulator: under Expo Go,
// react-native-purchases-ui's Preview API Mode delegates presentPaywall() to
// the RevenueCat *web* SDK (`@revenuecat/purchases-js-hybrid-mappings`),
// which never resolves in a native (non-browser, no real DOM) host -- no
// error, no crash, just a promise that hangs forever. Real dev/production
// builds use the native SDK (unaffected); the web target has a real DOM
// (unaffected, confirmed by the Playwright suite still passing). This
// timeout exists so Expo Go's dev-only quirk degrades to 13.7's retry state
// instead of leaving the screen stuck showing only the loading indicator.
const PRESENT_PAYWALL_TIMEOUT_MS = 20000;

// Exported for direct Vitest coverage of the timeout behavior itself
// (usePaywallPresentation is a hook and can't be rendered under this
// project's Vitest pipeline, same RN-rendering wall as elsewhere).
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// 13.3/13.5/13.8: a PURCHASED or RESTORED outcome already updates CustomerInfo
// on RevenueCat's side, which fires the listener subscription-gate.ts wired
// up in 6.2 -- this hook does not touch isPro itself, it only reports the
// outcome so the screen can navigate/show feedback.
export function usePaywallPresentation() {
  const [isPresenting, setIsPresenting] = useState(false);

  const present = useCallback(async (): Promise<PaywallOutcome> => {
    setIsPresenting(true);
    try {
      const result = await withTimeout(
        RevenueCatUI.presentPaywall({ displayCloseButton: true }),
        PRESENT_PAYWALL_TIMEOUT_MS,
      );
      return toPaywallOutcome(result);
    } catch {
      return { type: "error" };
    } finally {
      setIsPresenting(false);
    }
  }, []);

  return { present, isPresenting };
}

// 13.4: explicit "restore purchases" action, independent of the paywall
// template's own (if any) restore affordance.
export function useRestorePurchases() {
  const [isRestoring, setIsRestoring] = useState(false);

  const restore = useCallback(async (): Promise<boolean> => {
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      return result.ok;
    } finally {
      setIsRestoring(false);
    }
  }, []);

  return { restore, isRestoring };
}
