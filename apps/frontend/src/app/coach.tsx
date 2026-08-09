import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { standingMinutesPoint } from "@/components/route-card";
import { GradientButton } from "@/components/ui/gradient-button";
import { Meter } from "@/components/ui/meter";
import { Pulse } from "@/components/ui/pulse";
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
import { getActiveTrip, startCoachSession } from "@/features/coach/coach-store";
import { useCoachSession } from "@/features/coach/use-coach-session";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import type { SupportedLocale } from "@/lib/i18n";

const RING_SIZE = 196;
const RING_STROKE = 15;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function stationName(
  station: { nameJa: string; nameEn: string },
  language: string,
): string {
  return (language as SupportedLocale) === "ja"
    ? station.nameJa
    : station.nameEn;
}

function SeatProbabilityRing({
  percent,
  remainingLabel,
}: {
  percent: number;
  remainingLabel: string;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100);

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={c.hairline}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={c.seat}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
          strokeDashoffset={dashOffset}
          fill="none"
          rotation={-90}
          originX={RING_SIZE / 2}
          originY={RING_SIZE / 2}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringPercent, { color: c.text }]}>{percent}%</Text>
        <Text style={[styles.ringRemaining, { color: c.textSecondary }]}>
          {remainingLabel}
        </Text>
      </View>
    </View>
  );
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
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const params = useLocalSearchParams<{ legs?: string; routeType?: string }>();

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

  const adviceText = snapshot?.isApproachingDestination
    ? t("coach.approachingDestination")
    : snapshot && snapshot.delayMinutes > 0
      ? t("coach.delayNotice", { minutes: snapshot.delayMinutes })
      : snapshot?.trainStatusStale
        ? t("coach.staleNotice")
        : null;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="coach-back"
            style={styles.back}
          >
            <Text style={[styles.backText, { color: c.text }]}>
              {t("common.back")}
            </Text>
          </Pressable>
          <View style={styles.liveRow}>
            <Pulse durationMs={1600} style={styles.liveDot}>
              <View
                style={[styles.liveDotInner, { backgroundColor: c.seat }]}
              />
            </Pulse>
            <Text style={[styles.liveLabel, { color: c.seat }]}>LIVE</Text>
          </View>
          <Text style={[styles.title, { color: c.text }]}>
            {t("coach.title")}
          </Text>
        </View>

        {legs === null || isPending ? (
          <View style={styles.loading} testID="coach-loading">
            <ActivityIndicator />
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>
              {t("coach.loading")}
            </Text>
          </View>
        ) : null}

        {legs !== null && !isPending && snapshot ? (
          <ScrollView
            contentContainerStyle={styles.content}
            testID="coach-content"
          >
            <SeatProbabilityRing
              percent={Math.round(snapshot.prediction.seatProbability * 100)}
              remainingLabel={
                "point" in snapshot.prediction.standingMinutes
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
                    })
              }
            />

            <View style={[styles.card, { backgroundColor: c.surfaceMuted }]}>
              <Text style={[styles.stationLabel, { color: c.textSecondary }]}>
                {t("coach.currentStation")}
              </Text>
              <Text
                style={[styles.stationName, { color: c.text }]}
                testID="coach-current-station"
              >
                {stationName(snapshot.currentStation, i18n.language)}
              </Text>
              {snapshot.nextStation ? (
                <Text
                  style={[styles.nextStation, { color: c.textSecondary }]}
                  testID="coach-next-station"
                >
                  {t("coach.nextStation")}:{" "}
                  {stationName(snapshot.nextStation, i18n.language)}
                </Text>
              ) : null}
              <Text style={[styles.remainingStops, { color: c.textSecondary }]}>
                {t("coach.remainingStops", { count: snapshot.remainingStops })}
              </Text>
            </View>

            {snapshot.aheadStationProbabilities.length > 0 ? (
              <View
                style={[styles.card, { backgroundColor: c.surfaceMuted }]}
                testID="coach-ahead-stations"
              >
                <SectionLabel>{t("coach.aheadTitle")}</SectionLabel>
                {snapshot.aheadStationProbabilities
                  .slice(0, 3)
                  .map(({ station, probability }) => (
                    <View key={station.id} style={styles.aheadRow}>
                      <Text
                        style={[styles.aheadName, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {stationName(station, i18n.language)}
                      </Text>
                      <View style={styles.aheadMeter}>
                        <Meter
                          value={probability}
                          confidence={snapshot.prediction.confidence}
                        />
                      </View>
                      <Text
                        style={[
                          styles.aheadPercent,
                          { color: c.textSecondary },
                        ]}
                      >
                        {Math.round(probability * 100)}%
                      </Text>
                    </View>
                  ))}
              </View>
            ) : null}

            {adviceText ? (
              <View
                style={[styles.adviceBand, { backgroundColor: `${c.rail}1A` }]}
                testID="coach-advice"
              >
                <Text style={[styles.adviceText, { color: c.rail }]}>
                  {adviceText}
                </Text>
              </View>
            ) : null}

            <GradientButton
              label={t("coach.endRide")}
              variant="outline"
              testID="coach-end-ride"
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
                    ...(params.routeType
                      ? { routeType: params.routeType }
                      : {}),
                  },
                });
              }}
            />
          </ScrollView>
        ) : null}
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
  header: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginLeft: -12,
  },
  backText: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  liveDot: {
    width: 7,
    height: 7,
  },
  liveDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveLabel: {
    fontFamily: Fonts.numBold,
    fontSize: 11,
    letterSpacing: 1.54,
  },
  title: {
    ...Typography.h1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  loadingText: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  ringWrap: {
    alignSelf: "center",
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringPercent: {
    ...Typography.numericHero,
    fontSize: 54,
    lineHeight: 54,
  },
  ringRemaining: {
    fontFamily: Fonts.jp,
    fontSize: 12,
    marginTop: Spacing.one,
  },
  card: {
    gap: Spacing.one,
    borderRadius: Radius.xl,
    padding: Spacing.four,
  },
  stationLabel: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  stationName: {
    ...Typography.h1,
    fontSize: 24,
    lineHeight: 30,
  },
  nextStation: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  remainingStops: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  aheadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  aheadName: {
    width: 62,
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  aheadMeter: {
    flex: 1,
  },
  aheadPercent: {
    width: 38,
    textAlign: "right",
    fontFamily: Fonts.numBold,
    fontSize: 12,
  },
  adviceBand: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  adviceText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
    lineHeight: 12 * 1.6,
  },
});
