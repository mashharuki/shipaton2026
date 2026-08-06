import { useRouter } from "expo-router";
import { useCallback } from "react";

import {
  guard,
  type PaywallTrigger,
} from "@/features/subscription/subscription-gate";
import { analyticsClient } from "@/lib/analytics";

// 6.4/17.3: the one place a blocked guard() result becomes the paywall_shown
// analytics event + navigation to /paywall, so every gated call site
// (search, Pro-only route-detail elements, ...) stays consistent. Returns
// true when the caller may proceed, false when it must stop (the paywall
// has already been triggered).
export function usePaywallGate() {
  const router = useRouter();

  return useCallback(
    (trigger: PaywallTrigger): boolean => {
      const result = guard(trigger);
      if (result.allowed) {
        return true;
      }
      analyticsClient.track("paywall_shown", {
        paywallTrigger: trigger.type,
      });
      router.push("/paywall");
      return false;
    },
    [router],
  );
}
