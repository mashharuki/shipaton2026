import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isErr } from "shared";
import { standingMinutesPoint } from "@/components/route-card";
import { AppPressable } from "@/components/ui/app-pressable";
import { GradientBorderCard } from "@/components/ui/gradient-border";
import { GradientButton } from "@/components/ui/gradient-button";
import { Icon } from "@/components/ui/icon";
import { SectionLabel } from "@/components/ui/section-label";
import {
  BottomTabInset,
  Colors,
  Fonts,
  Gradients,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { usePreferenceStore } from "@/features/preferences/preference-store";
import { useWeeklyReport } from "@/features/report/use-weekly-report";
import type { Weekday } from "@/features/saved-routes/saved-routes-store";
import { useSavedRoutes } from "@/features/saved-routes/use-saved-routes";
import { useRouteSearch } from "@/features/search/use-route-search";
import { recordSearch } from "@/features/subscription/usage-limiter";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

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

const WEEKDAY_BAR_COUNT = 5;

// Splits a translated sentence around the (already-interpolated) numeric
// tokens it contains, so only the numbers themselves can be styled -- the
// handoff's ja/en strings interpolate plain digits with no markup, so this
// avoids introducing <Trans> tag conventions the rest of the app doesn't use.
function splitHighlighted(
  text: string,
  tokens: string[],
): { text: string; highlight: boolean }[] {
  const uniqueTokens = [...new Set(tokens.filter((token) => token.length > 0))];
  if (uniqueTokens.length === 0) {
    return [{ text, highlight: false }];
  }
  const pattern = uniqueTokens
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return text
    .split(new RegExp(`(${pattern})`, "g"))
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, highlight: uniqueTokens.includes(part) }));
}

function StationMarker({ color1, color2 }: { color1: string; color2: string }) {
  return (
    <View style={styles.markerColumn}>
      <View style={[styles.markerDotOutline, { borderColor: color1 }]} />
      <LinearGradient colors={[color1, color2]} style={styles.markerLine} />
      <View style={[styles.markerDotFilled, { backgroundColor: color2 }]} />
    </View>
  );
}

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
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
  const { data: demoResult } = useRouteSearch(DEMO_QUERY);
  const { current: weeklyMetrics } = useWeeklyReport(0);

  const demoRoutes = demoResult && !isErr(demoResult) ? demoResult.data : [];
  const comfortRoute = demoRoutes.find((route) => route.type === "comfort");
  const fastestRoute =
    demoRoutes.find((route) => route.type === "fastest") ?? demoRoutes[0];
  const comfortEsm = comfortRoute
    ? Math.round(standingMinutesPoint(comfortRoute.prediction.standingMinutes))
    : undefined;
  const reducedMinutes =
    comfortRoute && fastestRoute
      ? Math.max(
          0,
          Math.round(
            standingMinutesPoint(fastestRoute.prediction.standingMinutes) -
              standingMinutesPoint(comfortRoute.prediction.standingMinutes),
          ),
        )
      : 0;
  const extraMinutes = comfortRoute?.diffFromFastestMinutes ?? 0;
  const showHeadline = extraMinutes > 0 && reducedMinutes > 0;

  const headlineSegments = showHeadline
    ? splitHighlighted(
        t("home.headline", { extra: extraMinutes, reduced: reducedMinutes }),
        [String(extraMinutes), String(reducedMinutes)],
      )
    : [];

  const todayLabel = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  const weekdayBars = weeklyMetrics.dailyStandingMinutes.slice(
    0,
    WEEKDAY_BAR_COUNT,
  );
  const maxBarMinutes = Math.max(1, ...weekdayBars.map((day) => day.minutes));
  const todayDateOnly = new Date().toISOString().slice(0, 10);

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
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          testID="home-screen"
        >
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/night-rail-icon.png")}
              style={styles.headerIcon}
            />
            <Text style={styles.wordmark}>
              <Text style={{ color: c.text }}>Seat</Text>
              <Text style={{ color: c.seat }}>Signal</Text>
            </Text>
            <View style={styles.headerSpacer} />
            <AppPressable
              accessibilityRole="button"
              accessibilityLabel={t("tabs.settings")}
              onPress={() => router.push("/settings")}
              style={styles.settingsButton}
            >
              <Icon name="settings" />
            </AppPressable>
          </View>

          <View style={styles.lead}>
            <Text style={[styles.dateLabel, { color: c.textSecondary }]}>
              {todayLabel}
            </Text>
            {showHeadline ? (
              <Text style={[styles.headline, { color: c.text }]}>
                {headlineSegments.map((segment, index) => (
                  <Text
                    // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable segments of one sentence
                    key={index}
                    style={
                      segment.highlight
                        ? { color: c.seat, fontFamily: Fonts.numBold }
                        : undefined
                    }
                  >
                    {segment.text}
                  </Text>
                ))}
              </Text>
            ) : null}
          </View>

          <GradientBorderCard>
            <View style={styles.searchRow}>
              <StationMarker color1={c.rail} color2={c.seat} />
              <View style={styles.searchTextCol}>
                <Text style={[styles.searchStation, { color: c.text }]}>
                  {t("home.demoFromStation")}{" "}
                  <Text style={{ color: c.textSecondary }}>
                    {DEMO_QUERY.departureTime}発
                  </Text>
                </Text>
                <Text style={[styles.searchStation, { color: c.text }]}>
                  {t("home.demoToStation")}
                </Text>
              </View>
            </View>
            <View style={styles.searchCta}>
              <GradientButton
                label={t("home.demoSearch")}
                onPress={handleSearch}
                testID="home-demo-search"
              />
            </View>
          </GradientBorderCard>

          <View style={styles.section} testID="saved-routes-section">
            <SectionLabel>{t("savedRoutes.title")}</SectionLabel>
            {routes.length === 0 ? (
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t("savedRoutes.empty")}
              </Text>
            ) : null}
            {routes.map((route) => (
              <View
                key={route.id}
                style={[
                  styles.savedRouteRow,
                  { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
                ]}
                testID={`saved-route-${route.id}`}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => selectRoute(route)}
                  style={styles.savedRouteMain}
                >
                  <Text style={[styles.savedRouteText, { color: c.text }]}>
                    {route.fromStationId} → {route.toStationId} (
                    {route.departureTime})
                  </Text>
                </Pressable>
                <View style={styles.savedRouteRight}>
                  {comfortEsm !== undefined ? (
                    <Text style={styles.savedRouteEsm}>
                      <Text
                        style={{ color: c.seat, fontFamily: Fonts.numBold }}
                      >
                        {comfortEsm}
                      </Text>
                      <Text style={{ color: c.textSecondary, fontSize: 11 }}>
                        {" "}
                        分
                      </Text>
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    testID={`saved-route-delete-${route.id}`}
                    onPress={() => removeRoute(route.id)}
                  >
                    <Text
                      style={[styles.deleteText, { color: c.textSecondary }]}
                    >
                      {t("savedRoutes.delete")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {[...pendingRemovalIds].map((id) => (
              <View
                key={id}
                style={[
                  styles.savedRouteRow,
                  { backgroundColor: c.surfaceSelected },
                ]}
                testID={`saved-route-undo-${id}`}
              >
                <Text style={[styles.savedRouteText, { color: c.text }]}>
                  {t("savedRoutes.deleted")}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => undoRemove(id)}
                >
                  <Text style={[styles.undoText, { color: c.text }]}>
                    {t("savedRoutes.undo")}
                  </Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              testID="save-route-button"
              onPress={handleSaveRoute}
              style={[styles.addRouteRow, { borderColor: c.hairline }]}
            >
              <Text style={[styles.addRouteText, { color: c.textSecondary }]}>
                {t("savedRoutes.save")}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <SectionLabel>{t("report.hero")}</SectionLabel>
            <Text style={[styles.weeklySummary, { color: c.textSecondary }]}>
              {t("home.weeklySavedSummary", {
                minutes: Math.round(weeklyMetrics.reducedStandingMinutes),
              })}
            </Text>
            <View style={styles.barsRow}>
              {weekdayBars.map((day) => {
                const isToday = day.date === todayDateOnly;
                const isFuture = day.date > todayDateOnly;
                const barHeight = Math.max(
                  8,
                  (day.minutes / maxBarMinutes) * 56,
                );
                return (
                  <View key={day.date} style={styles.barColumn}>
                    {isToday ? (
                      <LinearGradient
                        colors={Gradients[scheme].signal}
                        style={[styles.bar, { height: barHeight }]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.bar,
                          {
                            height: barHeight,
                            backgroundColor: isFuture
                              ? c.hairline
                              : `${c.rail}59`,
                          },
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.five,
    paddingTop: 64,
    gap: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm + 2,
  },
  wordmark: {
    fontFamily: Fonts.jpBold,
    fontSize: 19,
  },
  headerSpacer: {
    flex: 1,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  lead: {
    gap: Spacing.one,
  },
  dateLabel: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  headline: {
    ...Typography.h1,
    fontSize: 27,
    lineHeight: 27 * 1.35,
  },
  searchRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  searchTextCol: {
    flex: 1,
    justifyContent: "space-between",
    gap: Spacing.one,
  },
  searchStation: {
    fontFamily: Fonts.jpBold,
    fontSize: 16,
  },
  searchCta: {
    marginTop: Spacing.four,
  },
  markerColumn: {
    alignItems: "center",
    width: 12,
  },
  markerDotOutline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  markerLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
  },
  markerDotFilled: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  section: {
    gap: Spacing.two,
  },
  emptyText: {
    fontFamily: Fonts.jp,
    fontSize: 13,
  },
  savedRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  savedRouteMain: {
    flex: 1,
  },
  savedRouteText: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  savedRouteRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.three,
  },
  savedRouteEsm: {
    fontSize: 20,
  },
  deleteText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  undoText: {
    fontFamily: Fonts.jpBold,
    fontSize: 13,
  },
  addRouteRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    paddingVertical: 16,
    alignItems: "center",
  },
  addRouteText: {
    fontFamily: Fonts.jpBold,
    fontSize: 13,
  },
  weeklySummary: {
    fontFamily: Fonts.jp,
    fontSize: 13,
  },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 56,
    marginTop: Spacing.one,
  },
  barColumn: {
    flex: 1,
  },
  bar: {
    width: "100%",
    borderRadius: 5,
  },
});
