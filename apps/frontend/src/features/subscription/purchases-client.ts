import Constants, { AppOwnership } from "expo-constants";
import { Linking, Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  LOG_LEVEL,
  type PurchasesOffering,
} from "react-native-purchases";
import { type AppError, createAppError, err, ok, type Result } from "shared";

import {
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_IOS_API_KEY,
  REVENUECAT_TEST_STORE_API_KEY,
} from "@/lib/config";

// design.md: react-native-purchases stays confined to features/subscription --
// every other module in this app talks to SubscriptionGate/use-purchases, not
// this file or the SDK directly.

let configured = false;

// react-native-purchases only auto-mocks into Preview API Mode when given a
// RevenueCat *Test Store* API key -- an app_store/play_store key inside Expo
// Go throws "Invalid API key" instead of falling back (confirmed against a
// booted iOS simulator running Expo Go). `Constants.executionEnvironment`
// can't tell Expo Go apart from an expo-dev-client build (both report
// "storeClient"); `Constants.appOwnership` is the one signal that's only
// truthy inside the literal Expo Go app, so despite the type's "deprecated,
// use executionEnvironment instead" note, it's what we actually need here.
function isRunningInExpoGo(): boolean {
  return Constants.appOwnership === AppOwnership.Expo;
}

// design.md scopes react-native-purchases to iOS/Android (Requirement 13 is
// store-subscription-shaped; no RC Web Billing key exists in this project's
// RevenueCat setup) -- the Playwright/web target is core-loop E2E only
// (design.md's Testing Strategy: billing is mocked at the entitlement layer
// for web, real purchases are native-only), so web must not attempt to
// configure the native SDK at all rather than guess a key for it.
export function configurePurchases(): void {
  if (configured || Platform.OS === "web") {
    return;
  }
  // typeof-guarded: __DEV__ is a Metro/RN global, undefined under this
  // project's Vite-based Vitest pipeline.
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  const apiKey = isRunningInExpoGo()
    ? REVENUECAT_TEST_STORE_API_KEY
    : Platform.OS === "ios"
      ? REVENUECAT_IOS_API_KEY
      : REVENUECAT_ANDROID_API_KEY;
  Purchases.configure({ apiKey });
  configured = true;
}

export async function fetchCurrentOffering(): Promise<
  Result<PurchasesOffering, AppError>
> {
  try {
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) {
      return err(
        createAppError("unknown", "No current RevenueCat offering configured"),
      );
    }
    return ok(offerings.current);
  } catch (cause) {
    return err(createAppError("unknown", "Failed to fetch offerings", cause));
  }
}

export async function fetchCustomerInfo(): Promise<
  Result<CustomerInfo, AppError>
> {
  try {
    const info = await Purchases.getCustomerInfo();
    return ok(info);
  } catch (cause) {
    return err(
      createAppError("unknown", "Failed to fetch customer info", cause),
    );
  }
}

export function addCustomerInfoListener(
  listener: CustomerInfoUpdateListener,
): () => void {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

// 9.2/16.6: "サブスクリプション管理" entry point's URL fallback -- pure and
// Vitest-testable independent of Platform/Linking wiring, same precedent as
// push-registration.ts's resolveDeepLinkParams.
export function getSubscriptionManagementUrl(platform: string): string {
  return platform === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
}

// 9.2/16.6: iOS 13+ can present the native App Store subscription-management
// sheet in-app (Purchases.showManageSubscriptions) -- RevenueCat has no
// Android SDK equivalent, so Android (and any iOS failure, e.g. iOS < 13)
// falls back to opening the store's own web management page.
export async function openSubscriptionManagement(): Promise<void> {
  if (Platform.OS === "ios") {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch (cause) {
      console.warn(
        "showManageSubscriptions failed, falling back to URL",
        cause,
      );
    }
  }
  await Linking.openURL(getSubscriptionManagementUrl(Platform.OS));
}

// 13.4: explicit "restore purchases" action. A successful restore fires the
// same CustomerInfo update listener subscription-gate.ts already wired up in
// 6.2 -- callers don't need to update isPro themselves, just react to
// success/failure for UI feedback.
export async function restorePurchases(): Promise<
  Result<CustomerInfo, AppError>
> {
  try {
    const info = await Purchases.restorePurchases();
    return ok(info);
  } catch (cause) {
    return err(createAppError("unknown", "Failed to restore purchases", cause));
  }
}
