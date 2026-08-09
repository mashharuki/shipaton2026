import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GradientBorderCard } from "@/components/ui/gradient-border";
import { ProBlurGate } from "@/components/ui/pro-blur-gate";
import { SectionLabel } from "@/components/ui/section-label";
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import type { WeeklyMetrics } from "@/features/report/use-weekly-report";
import { useWeeklyReport } from "@/features/report/use-weekly-report";
import { useIsPro } from "@/features/subscription/subscription-gate";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

// "YYYY-MM-DD" -> "M/D", this app's only date-display need so far -- no
// date library dependency exists (or is worth adding) for this alone.
function shortDate(dateOnly: string): string {
  const [, month, day] = dateOnly.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatMinutes(minutes: number): string {
  return `${Math.round(minutes)}`;
}

function deltaLabel(current: number, previous: number): string {
  const diff = Math.round(current - previous);
  if (diff === 0) {
    return "±0";
  }
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function DailyTrend({
  daily,
}: {
  daily: WeeklyMetrics["dailyStandingMinutes"];
}) {
  const { t } = useTranslation();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const maxMinutes = Math.max(1, ...daily.map((day) => day.minutes));

  return (
    <View style={styles.card} testID="report-daily-trend">
      <SectionLabel>{t("report.dailyTrend")}</SectionLabel>
      <View style={styles.dailyRow}>
        {daily.map((day) => (
          <View key={day.date} style={styles.dailyBarColumn}>
            <View
              style={[
                styles.dailyBar,
                {
                  height: 8 + (day.minutes / maxMinutes) * 72,
                  backgroundColor: c.surfaceSelected,
                },
              ]}
              testID={`report-daily-bar-${day.date}`}
            />
            <Text style={[styles.dailyBarLabel, { color: c.textSecondary }]}>
              {shortDate(day.date)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeekComparison({
  current,
  previous,
}: {
  current: WeeklyMetrics;
  previous: WeeklyMetrics;
}) {
  const { t } = useTranslation();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];

  return (
    <View style={styles.card} testID="report-week-comparison">
      <SectionLabel>{t("report.vsLastWeek")}</SectionLabel>
      <Text
        style={[styles.comparisonRow, { color: c.text }]}
        testID="report-delta-standing"
      >
        {t("report.totalStandingMinutes")}:{" "}
        {deltaLabel(
          current.totalStandingMinutes,
          previous.totalStandingMinutes,
        )}
      </Text>
      <Text
        style={[styles.comparisonRow, { color: c.text }]}
        testID="report-delta-reduced"
      >
        {t("report.reducedStandingMinutes")}:{" "}
        {deltaLabel(
          current.reducedStandingMinutes,
          previous.reducedStandingMinutes,
        )}
      </Text>
      <Text
        style={[styles.comparisonRow, { color: c.text }]}
        testID="report-delta-comfort"
      >
        {t("report.comfortRouteCount")}:{" "}
        {deltaLabel(current.comfortRouteCount, previous.comfortRouteCount)}
      </Text>
    </View>
  );
}

function StatTile({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID: string;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];

  return (
    <View
      style={[styles.statTile, { backgroundColor: c.surfaceMuted }]}
      testID={testID}
    >
      <Text
        style={[styles.statLabel, { color: c.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
    </View>
  );
}

// 11.1-11.4: weekly report screen -- headline metrics (11.1) are always
// visible, the daily trend (11.2) and week-over-week comparison (11.4) are
// rendered underneath a Pro blur gate (blurred, not hidden) rather than
// swapped out for a separate teaser.
export default function ReportScreen() {
  const { t } = useTranslation();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const paywallGate = usePaywallGate();
  const isPro = useIsPro();
  const [weekOffset, setWeekOffset] = useState(0);
  const { isLoading, window, current, previous } = useWeeklyReport(weekOffset);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          testID="report-screen"
        >
          <Text style={[styles.title, { color: c.text }]}>
            {t("report.title")}
          </Text>

          <View style={styles.weekNav}>
            <Pressable
              accessibilityRole="button"
              testID="report-week-prev"
              onPress={() => setWeekOffset((offset) => offset - 1)}
              style={styles.weekNavButton}
            >
              <Text style={[styles.weekNavLabel, { color: c.text }]}>
                {t("report.previousWeek")}
              </Text>
            </Pressable>
            <Text
              style={[styles.weekRange, { color: c.textSecondary }]}
              testID="report-week-range"
            >
              {shortDate(window.start)} - {shortDate(window.end)}
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="report-week-next"
              disabled={weekOffset >= 0}
              onPress={() => setWeekOffset((offset) => Math.min(0, offset + 1))}
              style={styles.weekNavButton}
            >
              <Text
                style={[
                  styles.weekNavLabel,
                  { color: weekOffset >= 0 ? c.textSecondary : c.text },
                ]}
              >
                {t("report.nextWeek")}
              </Text>
            </Pressable>
          </View>

          {isLoading ? (
            <Text style={[styles.loading, { color: c.textSecondary }]}>
              {t("report.loading")}
            </Text>
          ) : (
            <>
              <GradientBorderCard strong>
                <SectionLabel>{t("report.hero")}</SectionLabel>
                <Text
                  style={[styles.hero, { color: c.text }]}
                  testID="report-reduced-standing"
                >
                  {formatMinutes(current.reducedStandingMinutes)}
                  <Text style={[styles.heroUnit, { color: c.textSecondary }]}>
                    {" "}
                    {t("report.minutesUnit")}
                  </Text>
                </Text>
                <Text style={[styles.heroDelta, { color: c.seat }]}>
                  {t("report.vsLastWeekShort", {
                    delta: deltaLabel(
                      current.reducedStandingMinutes,
                      previous.reducedStandingMinutes,
                    ),
                  })}
                </Text>
              </GradientBorderCard>

              <View style={styles.statsRow}>
                <StatTile
                  label={t("report.totalStandingMinutes")}
                  value={`${formatMinutes(current.totalStandingMinutes)} ${t("report.minutesUnit")}`}
                  testID="report-total-standing"
                />
                <StatTile
                  label={t("report.comfortRouteCount")}
                  value={String(current.comfortRouteCount)}
                  testID="report-comfort-count"
                />
                <StatTile
                  label={t("report.predictionAccuracy")}
                  value={
                    current.predictionAccuracy === null
                      ? t("report.noData")
                      : t("results.percentValue", {
                          percent: Math.round(current.predictionAccuracy * 100),
                        })
                  }
                  testID="report-prediction-accuracy"
                />
              </View>

              <ProBlurGate
                locked={!isPro}
                onPress={() =>
                  paywallGate({
                    type: "pro_feature",
                    feature: "detailed_report",
                  })
                }
                title={t("report.proGate.title")}
                ctaLabel={t("report.proGate.cta")}
                testID="report-detail-gate"
              >
                <View style={styles.gatedSection}>
                  <DailyTrend daily={current.dailyStandingMinutes} />
                  <WeekComparison current={current} previous={previous} />
                </View>
              </ProBlurGate>
            </>
          )}
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
    paddingTop: Spacing.three,
    gap: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    ...Typography.h1,
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekNavButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  weekNavLabel: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
  weekRange: {
    fontFamily: Fonts.jp,
    fontSize: 13,
  },
  loading: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  hero: {
    ...Typography.numericHero,
    marginTop: Spacing.one,
  },
  heroUnit: {
    fontFamily: Fonts.jp,
    fontSize: 16,
  },
  heroDelta: {
    fontFamily: Fonts.jpBold,
    fontSize: 12,
    marginTop: Spacing.one,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  statTile: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  statLabel: {
    fontFamily: Fonts.jp,
    fontSize: 11,
  },
  statValue: {
    ...Typography.numericMedium,
    marginTop: "auto",
  },
  gatedSection: {
    gap: Spacing.four,
  },
  card: {
    gap: Spacing.two,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  dailyBarColumn: {
    alignItems: "center",
    gap: Spacing.half,
  },
  dailyBar: {
    width: 20,
    borderRadius: Spacing.half,
  },
  dailyBarLabel: {
    fontFamily: Fonts.jp,
    fontSize: 11,
  },
  comparisonRow: {
    fontFamily: Fonts.jp,
    fontSize: 13,
  },
});
