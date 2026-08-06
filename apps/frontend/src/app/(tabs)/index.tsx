import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
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
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const paywallGate = usePaywallGate();

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
  pressed: {
    opacity: 0.7,
  },
});
