import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CONFIDENCE_LABEL_KEYS,
  standingMinutesPoint,
} from "@/components/route-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getActiveTrip, startCoachSession } from "@/features/coach/coach-store";
import { useCoachSession } from "@/features/coach/use-coach-session";
import type { RouteLeg } from "@/features/search/route-search-engine";
import type { SupportedLocale } from "@/lib/i18n";

function stationName(
  station: { nameJa: string; nameEn: string },
  language: string,
): string {
  return (language as SupportedLocale) === "ja"
    ? station.nameJa
    : station.nameEn;
}

// 7.1-7.6: Live Comfort Coach. Reached only from route-detail.tsx's
// Pro-gated "start ride" button (the entry-point gate 7.1 requires) --
// this screen itself doesn't re-check isPro(), matching the existing
// guard-then-navigate pattern used elsewhere (usePaywallGate blocks
// navigation before this screen ever mounts). Progress/prediction are
// entirely timetable+elapsed-time driven (7.4) -- see coach-session.ts's
// own note on why no geolocation dependency exists.
export default function CoachScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ legs?: string }>();

  const legs = useMemo<RouteLeg[] | null>(() => {
    if (!params.legs) {
      return null;
    }
    try {
      const parsed = JSON.parse(params.legs);
      return Array.isArray(parsed) ? (parsed as RouteLeg[]) : null;
    } catch {
      return null;
    }
  }, [params.legs]);

  useEffect(() => {
    if (legs && !getActiveTrip()) {
      startCoachSession(legs);
    }
  }, [legs]);

  const { snapshot, isPending } = useCoachSession(legs);

  return (
    <ThemedView style={styles.container} testID="coach-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="coach-back"
          >
            <ThemedText type="link">{t("common.back")}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t("coach.title")}
          </ThemedText>
        </ThemedView>

        {legs === null || isPending ? (
          <ThemedView style={styles.loading} testID="coach-loading">
            <ActivityIndicator />
            <ThemedText type="default" themeColor="textSecondary">
              {t("coach.loading")}
            </ThemedText>
          </ThemedView>
        ) : null}

        {legs !== null && !isPending && snapshot ? (
          <ScrollView
            contentContainerStyle={styles.content}
            testID="coach-content"
          >
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary">
                {t("coach.currentStation")}
              </ThemedText>
              <ThemedText
                type="title"
                style={styles.stationName}
                testID="coach-current-station"
              >
                {stationName(snapshot.currentStation, i18n.language)}
              </ThemedText>

              {snapshot.nextStation ? (
                <ThemedText type="default" testID="coach-next-station">
                  {t("coach.nextStation")}:{" "}
                  {stationName(snapshot.nextStation, i18n.language)}
                </ThemedText>
              ) : null}

              <ThemedText type="small" themeColor="textSecondary">
                {t("coach.remainingStops", {
                  count: snapshot.remainingStops,
                })}
              </ThemedText>
            </ThemedView>

            {snapshot.isApproachingDestination ? (
              <ThemedView
                type="backgroundSelected"
                style={styles.card}
                testID="coach-alighting-guidance"
              >
                <ThemedText type="smallBold">
                  {t("coach.approachingDestination")}
                </ThemedText>
              </ThemedView>
            ) : null}

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="default" testID="coach-standing-minutes">
                {t("coach.standingMinutes")}:{" "}
                {"point" in snapshot.prediction.standingMinutes
                  ? t("results.standingMinutesPoint", {
                      minutes: Math.round(
                        standingMinutesPoint(
                          snapshot.prediction.standingMinutes,
                        ),
                      ),
                    })
                  : t("results.standingMinutesRange", {
                      min: Math.round(
                        snapshot.prediction.standingMinutes.rangeMin,
                      ),
                      max: Math.round(
                        snapshot.prediction.standingMinutes.rangeMax,
                      ),
                    })}
              </ThemedText>
              <ThemedText type="default">
                {t("coach.seatProbability")}:{" "}
                {t("results.percentValue", {
                  percent: Math.round(
                    snapshot.prediction.seatProbability * 100,
                  ),
                })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t("results.confidence")}:{" "}
                {t(CONFIDENCE_LABEL_KEYS[snapshot.prediction.confidence])}
              </ThemedText>

              {snapshot.delayMinutes > 0 ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID="coach-delay-notice"
                >
                  {t("coach.delayNotice", { minutes: snapshot.delayMinutes })}
                </ThemedText>
              ) : null}
              {snapshot.trainStatusStale ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID="coach-stale-notice"
                >
                  {t("coach.staleNotice")}
                </ThemedText>
              ) : null}
            </ThemedView>

            {snapshot.aheadStationProbabilities.length > 0 ? (
              <ThemedView
                type="backgroundElement"
                style={styles.card}
                testID="coach-ahead-stations"
              >
                <ThemedText type="small" style={styles.sectionLabel}>
                  {t("coach.aheadTitle")}
                </ThemedText>
                {snapshot.aheadStationProbabilities.map(
                  ({ station, probability }) => (
                    <ThemedText key={station.id} type="small">
                      {stationName(station, i18n.language)}:{" "}
                      {t("results.percentValue", {
                        percent: Math.round(probability * 100),
                      })}
                    </ThemedText>
                  ),
                )}
              </ThemedView>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const activeTrip = getActiveTrip();
                router.push({
                  pathname: "/feedback",
                  params: {
                    tripId: activeTrip?.tripId ?? "",
                    legs: JSON.stringify(activeTrip?.legs ?? legs ?? []),
                    startedAt: activeTrip?.startedAt ?? "",
                    railwayId: snapshot.currentStation.railwayId,
                    legKey: snapshot.legKey,
                    boardedAt: snapshot.boardedAt,
                    predictedStandingMin: String(
                      Math.round(
                        standingMinutesPoint(
                          snapshot.prediction.standingMinutes,
                        ),
                      ),
                    ),
                  },
                });
              }}
              testID="coach-end-ride"
            >
              <ThemedView type="backgroundSelected" style={styles.endButton}>
                <ThemedText type="smallBold">{t("coach.endRide")}</ThemedText>
              </ThemedView>
            </Pressable>
          </ScrollView>
        ) : null}
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
  header: {
    gap: Spacing.one,
  },
  title: {
    textAlign: "left",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  content: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.one,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  stationName: {
    textAlign: "left",
  },
  sectionLabel: {
    marginBottom: Spacing.one,
  },
  endButton: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: "center",
  },
});
