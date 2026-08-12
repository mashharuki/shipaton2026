import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { isErr, toDayType } from "shared";
import { standingMinutesPoint } from "@/components/route-card";
import { SearchForm } from "@/components/search-form";
import { AppPressable } from "@/components/ui/app-pressable";
import { GradientBorderCard } from "@/components/ui/gradient-border";
import { Icon } from "@/components/ui/icon";
import { OptionCard } from "@/components/ui/option-card";
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
import {
  getCongestionData,
  getCorrectionData,
  getTimetableData,
} from "@/features/dataset/dataset-repository";
import { createSqliteDatasetStore } from "@/features/dataset/dataset-store";
import { usePreferenceStore } from "@/features/preferences/preference-store";
import { useWeeklyReport } from "@/features/report/use-weekly-report";
import type { Weekday } from "@/features/saved-routes/saved-routes-store";
import { useSavedRoutes } from "@/features/saved-routes/use-saved-routes";
import { getRecentSearches } from "@/features/search/recent-searches";
import { rankRoutes } from "@/features/search/route-ranker";
import { searchRoutes } from "@/features/search/route-search-engine";
import {
  hasTimetableFor,
  isSearchFormComplete,
  listDepartureTimes,
  listSelectableStations,
  nextWeekdayServiceDate,
  type SearchFormValue,
} from "@/features/search/search-form";
import { recordSearch } from "@/features/subscription/usage-limiter";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { getDb } from "@/lib/db";
import type { SupportedLocale } from "@/lib/i18n";

// 9.1: the form has no day-of-week field yet, so a saved route defaults to
// the standard 5-day commute. Editing which weekdays a route covers is a
// separate, not-yet-scheduled piece of UI.
const DEFAULT_SAVED_WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

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

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const paywallGate = usePaywallGate();
  const preference = usePreferenceStore((state) => state.preference);
  const {
    routes,
    pendingRemovalIds,
    saveRoute,
    removeRoute,
    undoRemove,
    selectRoute,
  } = useSavedRoutes();
  const { current: weeklyMetrics } = useWeeklyReport(0);

  const [form, setForm] = useState<SearchFormValue>({
    fromStationId: null,
    toStationId: null,
    departureTime: null,
  });

  const datasetsQuery = useQuery({
    queryKey: ["home-datasets"],
    queryFn: async () => {
      const db = await getDb();
      const store = createSqliteDatasetStore(db);
      const [timetable, congestion, correction] = await Promise.all([
        getTimetableData(store),
        getCongestionData(store),
        getCorrectionData(store),
      ]);
      if (isErr(timetable) || isErr(congestion) || isErr(correction)) {
        return null;
      }
      return {
        timetable: timetable.data,
        congestion: congestion.data,
        correction: correction.data,
      };
    },
  });

  const recentQuery = useQuery({
    queryKey: ["recent-searches"],
    queryFn: getRecentSearches,
  });

  const timetable = datasetsQuery.data?.timetable ?? null;
  const dayType = toDayType(new Date());
  const hasTodayTimetable = timetable
    ? hasTimetableFor(timetable, dayType)
    : true;
  const fallbackServiceDate = hasTodayTimetable
    ? undefined
    : nextWeekdayServiceDate(new Date());
  const searchDayType = hasTodayTimetable ? dayType : "weekday";

  const stations = useMemo(
    () => (timetable ? listSelectableStations(timetable) : []),
    [timetable],
  );

  const departureTimes = useMemo(() => {
    if (!timetable || !form.fromStationId || !form.toStationId) {
      return [];
    }
    return listDepartureTimes(timetable, {
      fromStationId: form.fromStationId,
      toStationId: form.toStationId,
      dayType: searchDayType,
    });
  }, [timetable, form.fromStationId, form.toStationId, searchDayType]);

  // Preview for the hero line and the saved-route badge. Deliberately NOT
  // useRouteSearch: that hook's queryFn fires analytics and records a recent
  // search, which must only happen for a search the user actually ran (see
  // the spec's "ホーム画面の副作用を持たない計算").
  const previewRoutes = useMemo(() => {
    const data = datasetsQuery.data;
    if (
      !data ||
      !form.fromStationId ||
      !form.toStationId ||
      !form.departureTime
    ) {
      return [];
    }
    const candidates = searchRoutes(data.timetable, {
      fromStationId: form.fromStationId,
      toStationId: form.toStationId,
      departureTime: form.departureTime,
      dayType: searchDayType,
    });
    if (isErr(candidates)) {
      return [];
    }
    const ranked = rankRoutes(
      candidates.data,
      data.timetable,
      data.congestion,
      data.correction,
      preference,
      searchDayType,
    );
    return isErr(ranked) ? [] : ranked.data;
  }, [datasetsQuery.data, form, searchDayType, preference]);

  const comfortRoute = previewRoutes.find((route) => route.type === "comfort");
  const fastestRoute =
    previewRoutes.find((route) => route.type === "fastest") ?? previewRoutes[0];
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

  const stationLabel = (stationId: string): string => {
    const station = stations.find((s) => s.id === stationId);
    if (!station) {
      return stationId;
    }
    return (i18n.language as SupportedLocale) === "ja"
      ? station.nameJa
      : station.nameEn;
  };

  // 12.1/12.2: design.md's "無料枠チェック→検索→3案選定" flow -- guard()
  // first (Free's 4th attempt never reaches the search), recordSearch()
  // only on an actually-allowed attempt so a blocked attempt doesn't itself
  // count against tomorrow's/today's limit.
  const handleSearch = () => {
    if (!isSearchFormComplete(form) || !paywallGate({ type: "search_limit" })) {
      return;
    }
    recordSearch();
    router.push({
      pathname: "/results",
      params: {
        fromStationId: form.fromStationId,
        toStationId: form.toStationId,
        departureTime: form.departureTime,
        ...(fallbackServiceDate ? { serviceDate: fallbackServiceDate } : {}),
      },
    });
  };

  const handleSaveRoute = () => {
    if (!isSearchFormComplete(form)) {
      return;
    }
    saveRoute({
      fromStationId: form.fromStationId,
      toStationId: form.toStationId,
      departureTime: form.departureTime,
      weekdays: DEFAULT_SAVED_WEEKDAYS,
      comfortPriority: preference.speedComfortBalance,
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
              source={require("@/assets/images/icon.png")}
              style={styles.headerIcon}
              accessible={false}
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

          {!hasTodayTimetable ? (
            <GradientBorderCard>
              <Text
                style={[styles.emptyText, { color: c.textSecondary }]}
                testID="search-no-timetable-today"
              >
                {t("search.noTimetableToday")}
              </Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t("search.weekdayFallbackNotice")}
              </Text>
            </GradientBorderCard>
          ) : null}
          <SearchForm
            stations={stations}
            departureTimes={departureTimes}
            value={form}
            onChange={setForm}
            onSubmit={handleSearch}
          />

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
                  onPress={() => selectRoute(route, fallbackServiceDate)}
                  style={styles.savedRouteMain}
                >
                  <Text style={[styles.savedRouteText, { color: c.text }]}>
                    {stationLabel(route.fromStationId)} →{" "}
                    {stationLabel(route.toStationId)} ({route.departureTime})
                  </Text>
                </Pressable>
                <View style={styles.savedRouteRight}>
                  {/* comfortEsm is a single value from the current form
                  preview, not a per-route estimate -- only valid for the row
                  that actually matches the form's current query. */}
                  {comfortEsm !== undefined &&
                  route.fromStationId === form.fromStationId &&
                  route.toStationId === form.toStationId &&
                  route.departureTime === form.departureTime ? (
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

          <View style={styles.section} testID="recent-searches-section">
            <SectionLabel>{t("search.recentTitle")}</SectionLabel>
            {(recentQuery.data ?? []).length === 0 ? (
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t("search.recentEmpty")}
              </Text>
            ) : null}
            {(recentQuery.data ?? []).map((entry) => (
              <OptionCard
                key={`${entry.fromStationId}-${entry.toStationId}`}
                label={`${stationLabel(entry.fromStationId)} → ${stationLabel(entry.toStationId)}`}
                onPress={() =>
                  setForm({
                    fromStationId: entry.fromStationId,
                    toStationId: entry.toStationId,
                    departureTime: null,
                  })
                }
                testID={`recent-search-${entry.fromStationId}-${entry.toStationId}`}
              />
            ))}
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
