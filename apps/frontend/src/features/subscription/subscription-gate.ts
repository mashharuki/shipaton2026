import type { CustomerInfo } from "react-native-purchases";
import { PRO_ENTITLEMENT_ID } from "shared";
import { create } from "zustand";

import {
  addCustomerInfoListener,
  fetchCustomerInfo,
} from "@/features/subscription/purchases-client";
import {
  ensureUsageLimiterHydrated,
  hasReachedDailySearchLimit,
} from "@/features/subscription/usage-limiter";

// design.md: the SubscriptionGate service interface. Screens/features use
// only isPro()/guard()/onEntitlementChange() -- never react-native-purchases
// directly (that stays confined to purchases-client.ts).
export type PaywallTrigger =
  | { type: "search_limit" } // 12.2
  | {
      type: "pro_feature";
      feature:
        | "boarding_detail"
        | "full_station_prediction"
        | "coach"
        | "detailed_report";
    } // 12.4
  | { type: "saved_route_limit" }; // 9.3

type GuardResult =
  | { allowed: true }
  | { allowed: false; trigger: PaywallTrigger };

type SubscriptionGateState = {
  isPro: boolean;
};

// Plain (non-persisted) zustand store: entitlement status is always re-hydrated
// from RevenueCat's own CustomerInfo cache at startup (initSubscriptionGate),
// never from kv-store -- CustomerInfo is already the durable, tamper-resistant
// source of truth, duplicating it locally would just add a second place to
// drift from it.
const useSubscriptionGateStore = create<SubscriptionGateState>(() => ({
  isPro: false,
}));

function isProFromCustomerInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

let listenerStarted = false;

// 13.3/13.8: hydrates isPro from the current CustomerInfo cache once, then
// keeps it live via RevenueCat's own update listener (fires on purchase,
// restore, renewal, cancellation, expiry). 12.5: this function -- and every
// other module in this file -- never calls guard() itself, so no trigger can
// ever fire purely from app launch; only a screen reacting to a user action
// does that. Also awaits usage-limiter's kv-store rehydration here so that by
// the time this promise resolves, guard()'s synchronous reads are trustworthy
// -- without this, a cold start could briefly under-count a returning free
// user's already-used searches (see ensureUsageLimiterHydrated's own comment).
export async function initSubscriptionGate(): Promise<void> {
  const [result] = await Promise.all([
    fetchCustomerInfo(),
    ensureUsageLimiterHydrated(),
  ]);
  if (result.ok) {
    useSubscriptionGateStore.setState({
      isPro: isProFromCustomerInfo(result.data),
    });
  }
  if (!listenerStarted) {
    addCustomerInfoListener((info) => {
      useSubscriptionGateStore.setState({ isPro: isProFromCustomerInfo(info) });
    });
    listenerStarted = true;
  }
}

export function isPro(): boolean {
  return useSubscriptionGateStore.getState().isPro;
}

export function guard(trigger: PaywallTrigger): GuardResult {
  if (isPro()) {
    return { allowed: true };
  }
  if (trigger.type === "search_limit") {
    return hasReachedDailySearchLimit()
      ? { allowed: false, trigger }
      : { allowed: true };
  }
  // pro_feature / saved_route_limit: the caller only invokes guard() with
  // these trigger types once it has already determined the action needs Pro
  // (e.g. tapping a Pro-only element, or attempting a 2nd saved route) -- any
  // free user is blocked unconditionally here.
  return { allowed: false, trigger };
}

export function onEntitlementChange(cb: (isPro: boolean) => void): () => void {
  return useSubscriptionGateStore.subscribe((state) => cb(state.isPro));
}
