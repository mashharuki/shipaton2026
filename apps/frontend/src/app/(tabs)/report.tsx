import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import type { WeeklyMetrics } from "@/features/report/use-weekly-report";
import { useWeeklyReport } from "@/features/report/use-weekly-report";
import { isPro } from "@/features/subscription/subscription-gate";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";

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

// 12.4: same locally-owned ProGateTeaser pattern as route-detail.tsx (its
// own comment already anticipated this task reusing the same guard()
// mechanism with its own presentation).
function ProGateTeaser() {
  const { t } = useTranslation();
  const paywallGate = usePaywallGate();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        paywallGate({ type: "pro_feature", feature: "detailed_report" })
      }
      testID="report-detail-gate"
    >
      <ThemedView type="backgroundSelected" style={styles.proGate}>
        <ThemedText type="smallBold">{t("report.proGate.title")}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t("report.proGate.cta")}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function DailyTrend({
  daily,
}: {
  daily: WeeklyMetrics["dailyStandingMinutes"];
}) {
  const { t } = useTranslation();
  const maxMinutes = Math.max(1, ...daily.map((day) => day.minutes));

  return (
    <ThemedView testID="report-daily-trend">
      <ThemedText type="smallBold">{t("report.dailyTrend")}</ThemedText>
      <ThemedView style={styles.dailyRow}>
        {daily.map((day) => (
          <ThemedView key={day.date} style={styles.dailyBarColumn}>
            <ThemedView
              type="backgroundSelected"
              style={[
                styles.dailyBar,
                { height: 8 + (day.minutes / maxMinutes) * 72 },
              ]}
              testID={`report-daily-bar-${day.date}`}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {shortDate(day.date)}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </ThemedView>
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

  return (
    <ThemedView testID="report-week-comparison">
      <ThemedText type="smallBold">{t("report.vsLastWeek")}</ThemedText>
      <ThemedText type="small" testID="report-delta-standing">
        {t("report.totalStandingMinutes")}:{" "}
        {deltaLabel(
          current.totalStandingMinutes,
          previous.totalStandingMinutes,
        )}
      </ThemedText>
      <ThemedText type="small" testID="report-delta-reduced">
        {t("report.reducedStandingMinutes")}:{" "}
        {deltaLabel(
          current.reducedStandingMinutes,
          previous.reducedStandingMinutes,
        )}
      </ThemedText>
      <ThemedText type="small" testID="report-delta-comfort">
        {t("report.comfortRouteCount")}:{" "}
        {deltaLabel(current.comfortRouteCount, previous.comfortRouteCount)}
      </ThemedText>
    </ThemedView>
  );
}

// 11.1-11.4: weekly report screen -- headline metrics (11.1) are always
// visible, the daily trend (11.2) and week-over-week comparison (11.4) are
// the "detail" portion 11.3 gates behind Pro.
export default function ReportScreen() {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const { isLoading, window, current, previous } = useWeeklyReport(weekOffset);
  const showDetail = isPro();

  return (
    <ThemedView style={styles.container} testID="report-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t("report.title")}
        </ThemedText>

        <ThemedView style={styles.weekNav}>
          <Pressable
            accessibilityRole="button"
            testID="report-week-prev"
            onPress={() => setWeekOffset((offset) => offset - 1)}
          >
            <ThemedText type="link">{t("report.previousWeek")}</ThemedText>
          </Pressable>
          <ThemedText type="small" testID="report-week-range">
            {shortDate(window.start)} - {shortDate(window.end)}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            testID="report-week-next"
            disabled={weekOffset >= 0}
            onPress={() => setWeekOffset((offset) => Math.min(0, offset + 1))}
          >
            <ThemedText
              type="link"
              themeColor={weekOffset >= 0 ? "textSecondary" : undefined}
            >
              {t("report.nextWeek")}
            </ThemedText>
          </Pressable>
        </ThemedView>

        {isLoading ? (
          <ThemedText type="default" themeColor="textSecondary">
            {t("report.loading")}
          </ThemedText>
        ) : (
          <>
            <ThemedView type="backgroundElement" style={styles.metricsGrid}>
              <ThemedText type="default" testID="report-total-standing">
                {t("report.totalStandingMinutes")}:{" "}
                {formatMinutes(current.totalStandingMinutes)}{" "}
                {t("report.minutesUnit")}
              </ThemedText>
              <ThemedText type="default" testID="report-reduced-standing">
                {t("report.reducedStandingMinutes")}:{" "}
                {formatMinutes(current.reducedStandingMinutes)}{" "}
                {t("report.minutesUnit")}
              </ThemedText>
              <ThemedText type="default" testID="report-comfort-count">
                {t("report.comfortRouteCount")}: {current.comfortRouteCount}
              </ThemedText>
              <ThemedText type="default" testID="report-prediction-accuracy">
                {t("report.predictionAccuracy")}:{" "}
                {current.predictionAccuracy === null
                  ? t("report.noData")
                  : t("results.percentValue", {
                      percent: Math.round(current.predictionAccuracy * 100),
                    })}
              </ThemedText>
            </ThemedView>

            {showDetail ? (
              <>
                <DailyTrend daily={current.dailyStandingMinutes} />
                <WeekComparison current={current} previous={previous} />
              </>
            ) : (
              <ProGateTeaser />
            )}
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    textAlign: "left",
  },
  weekNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricsGrid: {
    gap: Spacing.one,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  proGate: {
    gap: Spacing.one,
    borderRadius: Spacing.three,
    padding: Spacing.three,
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
});
