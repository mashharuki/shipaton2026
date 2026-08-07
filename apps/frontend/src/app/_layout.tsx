import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
} from "expo-router";
import { useEffect } from "react";

import { useDatasetSync } from "@/features/dataset/use-dataset-sync";
import {
  addNotificationTapListener,
  consumeLastNotificationDeepLink,
} from "@/features/notifications/push-registration";
import { configurePurchases } from "@/features/subscription/purchases-client";
import { initSubscriptionGate } from "@/features/subscription/subscription-gate";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import "@/lib/i18n";
import { queryClient } from "@/lib/query-client";

// 15.4: crash reporting. DSN comes from EXPO_PUBLIC_SENTRY_DSN (Expo's public
// env-var convention -- a Sentry DSN is meant to be embedded in the client
// bundle, unlike a real secret). No real Sentry project exists yet, so this
// runs with an empty DSN (SDK no-ops safely) until a human supplies one --
// see tasks.md's Implementation Notes for 4.1.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
});

// 6.1: configured once at module load (same pattern as Sentry.init above)
// rather than inside an effect, so it's guaranteed ready before the first
// screen that calls getOfferings()/getCustomerInfo() mounts.
configurePurchases();

// 4.3: needs to run as a descendant of QueryClientProvider (useDatasetSync
// is a useQuery under the hood), so it can't just be a hook call inside
// RootLayout itself -- RootLayout is the component that creates the
// provider, not one of its descendants.
function DatasetSyncBoundary() {
  useDatasetSync();
  return null;
}

// 6.2: starts SubscriptionGate's CustomerInfo hydration + live-update
// listener exactly once per app session. Fire-and-forget on purpose --
// isPro() safely defaults to false until this resolves (12.5: nothing here
// calls guard(), so no Paywall trigger can fire purely from this mount).
function SubscriptionGateBoundary() {
  useEffect(() => {
    initSubscriptionGate();
  }, []);
  return null;
}

// 10.4: global, screen-independent tap handler -- a notification can be
// tapped from anywhere (including a cold start), so this listener lives at
// the root rather than inside notifications.tsx. Handles both cases: a tap
// that launched the app from killed/backgrounded state (only discoverable
// via consumeLastNotificationDeepLink()'s one-time check on mount -- the
// live listener below is subscribed too late to see it) and a tap while the
// JS runtime is already running (the live listener).
function PushNotificationBoundary() {
  const router = useRouter();

  useEffect(() => {
    consumeLastNotificationDeepLink().then((params) => {
      if (params) {
        router.push({ pathname: "/results", params });
      }
    });
  }, [router]);

  useEffect(() => {
    return addNotificationTapListener((params) => {
      router.push({ pathname: "/results", params });
    });
  }, [router]);

  return null;
}

// 5.4: a real Stack (not just AppTabs) so non-tab screens (results.tsx) can
// push on top of the persistent tab bar instead of replacing it -- the 3 tab
// screens live in the (tabs) group, whose own _layout.tsx renders AppTabs.
function RootLayout() {
  const colorScheme = useAppColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <DatasetSyncBoundary />
        <SubscriptionGateBoundary />
        <PushNotificationBoundary />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="results" />
          <Stack.Screen name="route-detail" />
          <Stack.Screen name="coach" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
