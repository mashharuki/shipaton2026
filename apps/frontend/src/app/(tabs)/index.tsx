import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { usePreferenceStore } from "@/features/preferences/preference-store";
import type { Weekday } from "@/features/saved-routes/saved-routes-store";
import { useSavedRoutes } from "@/features/saved-routes/use-saved-routes";
import { recordSearch } from "@/features/subscription/usage-limiter";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";

// 07:30 lands inside the only two populated congestion windows in the
// current single-railway fixture (07:00-08:00 / 18:00-19:00) -- a full
// station-picker search form is a separate, not-yet-scheduled piece of UI
// work; this task's own scope is the results/comparison screen, so this is
// a minimal, honest trigger to actually reach it end-to-end.
const DEMO_QUERY = {
  fromStationId: "STA_SHINJUKU",
  toStationId: "STA_TOKYO",
  departureTime: "07:30",
  // The bundled dataset currently contains weekday timetables only. Keep the
  // demonstration available on weekends by explicitly searching this Tuesday.
  serviceDate: "2026-08-04",
};

// 9.1: no station-picker/day-of-week form exists yet (same gap DEMO_QUERY
// already documents for search) -- saving reuses the one demo commute as its
// route, weekdays default to the standard 5-day commute.
const DEMO_WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const paywallGate = usePaywallGate();
  const comfortPriority = usePreferenceStore(
    (state) => state.preference.speedComfortBalance,
  );
  const {
    routes,
    pendingRemovalIds,
    saveRoute,
    removeRoute,
    undoRemove,
    selectRoute,
  } = useSavedRoutes();

  // 12.1/12.2: design.md's "無料枠チェック→検索→3案選定" flow -- guard()
  // first (Free's 4th attempt never reaches the search), recordSearch()
  // only on an actually-allowed attempt so a blocked attempt doesn't itself
  // count against tomorrow's/today's limit.
  const handleSearch = () => {
    if (!paywallGate({ type: "search_limit" })) {
      return;
    }
    recordSearch();
    router.push({ pathname: "/results", params: DEMO_QUERY });
  };

  const handleSaveRoute = () => {
    saveRoute({
      fromStationId: DEMO_QUERY.fromStationId,
      toStationId: DEMO_QUERY.toStationId,
      departureTime: DEMO_QUERY.departureTime,
      weekdays: DEMO_WEEKDAYS,
      comfortPriority,
    });
  };

  return (
    <ThemedView style={styles.container} testID="home-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t("home.title")}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {t("home.placeholder")}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          testID="home-demo-search"
          onPress={handleSearch}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.demoButton}>
            <ThemedText type="smallBold">{t("home.demoSearch")}</ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedView
          style={styles.savedRoutesSection}
          testID="saved-routes-section"
        >
          <ThemedText type="smallBold">{t("savedRoutes.title")}</ThemedText>
          {routes.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t("savedRoutes.empty")}
            </ThemedText>
          ) : null}
          {routes.map((route) => (
            <ThemedView
              key={route.id}
              type="backgroundElement"
              style={styles.savedRouteRow}
              testID={`saved-route-${route.id}`}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => selectRoute(route)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="default">
                  {route.fromStationId} → {route.toStationId} (
                  {route.departureTime})
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID={`saved-route-delete-${route.id}`}
                onPress={() => removeRoute(route.id)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  {t("savedRoutes.delete")}
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))}
          {[...pendingRemovalIds].map((id) => (
            <ThemedView
              key={id}
              type="backgroundSelected"
              style={styles.savedRouteRow}
              testID={`saved-route-undo-${id}`}
            >
              <ThemedText type="small">{t("savedRoutes.deleted")}</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => undoRemove(id)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedText type="smallBold">
                  {t("savedRoutes.undo")}
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))}
          <Pressable
            accessibilityRole="button"
            testID="save-route-button"
            onPress={handleSaveRoute}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="link">{t("savedRoutes.save")}</ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  title: {
    textAlign: "center",
  },
  demoButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  savedRoutesSection: {
    marginTop: Spacing.four,
    gap: Spacing.two,
    width: "100%",
  },
  savedRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
