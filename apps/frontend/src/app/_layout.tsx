import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";

import AppTabs from "@/components/app-tabs";
import { useDatasetSync } from "@/features/dataset/use-dataset-sync";
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

// 4.3: needs to run as a descendant of QueryClientProvider (useDatasetSync
// is a useQuery under the hood), so it can't just be a hook call inside
// RootLayout itself -- RootLayout is the component that creates the
// provider, not one of its descendants.
function DatasetSyncBoundary() {
  useDatasetSync();
  return null;
}

function RootLayout() {
  const colorScheme = useAppColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <DatasetSyncBoundary />
        <AppTabs />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
