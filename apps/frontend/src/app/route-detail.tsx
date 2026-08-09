import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
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
import { createAppError, isErr } from "shared";

import { ErrorState } from "@/components/error-state";
import { CONFIDENCE_LABEL_KEYS } from "@/components/route-card";
import { GradientButton } from "@/components/ui/gradient-button";
import { ProBlurGate } from "@/components/ui/pro-blur-gate";
import { Pulse } from "@/components/ui/pulse";
import { SectionLabel } from "@/components/ui/section-label";
import {
  Colors,
  Fonts,
  Gradients,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { startCoachSession } from "@/features/coach/coach-store";
import type { Station } from "@/features/prediction/use-route-detail";
import { useRouteDetail } from "@/features/prediction/use-route-detail";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { isPro } from "@/features/subscription/subscription-gate";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import type { SupportedLocale } from "@/lib/i18n";

function stationName(station: Station, language: string): string {
  return (language as SupportedLocale) === "ja"
    ? station.nameJa
    : station.nameEn;
}

type ThemePalette = { [K in keyof (typeof Colors)["dark"]]: string };

function probabilityColor(probability: number, c: ThemePalette) {
  if (probability >= 0.7) return c.seat;
  if (probability >= 0.35) return c.confidenceMedium;
  return c.confidenceLow;
}

// 6.1-6.4: the route-detail/boarding-position screen reached by tapping a
// route-card on results.tsx. Legs come through as a JSON-encoded param
// (RouteLeg[]) rather than the richer RankedRoute -- this screen recomputes
// prediction + boarding advice itself via useRouteDetail, matching
// PredictionEngine's determinism invariant (same input + dataset version =>
// same output), so nothing is lost by not carrying the already-computed
// objects through the router.
export default function RouteDetailScreen() {
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

  const { data: result, isPending, refetch } = useRouteDetail(legs);
  const paywallGate = usePaywallGate();

  // 7.1: the Pro gate for Coach's entry point lives here, at the one place
  // a rider can launch it -- guard-then-navigate, same pattern
  // use-route-search.ts's free-tier check and the Pro gates below use.
  // Blocked callers never reach startCoachSession()/router.push("/coach").
  function handleStartRide() {
    if (!legs) {
      return;
    }
    if (!paywallGate({ type: "pro_feature", feature: "coach" })) {
      return;
    }
    startCoachSession(legs);
    router.push({
      pathname: "/coach",
      params: {
        legs: JSON.stringify(legs),
        ...(params.routeType ? { routeType: params.routeType } : {}),
      },
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="route-detail-back"
            style={styles.back}
          >
            <Text style={[styles.backText, { color: c.text }]}>
              {t("common.back")}
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: c.text }]}>
            {t("routeDetail.title")}
          </Text>
        </View>

        {legs === null ? (
          <ErrorState error={createAppError("unknown", "No route selected")} />
        ) : null}

        {legs !== null && isPending ? (
          <View style={styles.loading} testID="route-detail-loading">
            <ActivityIndicator />
            <Text style={[styles.loadingText, { color: c.textSecondary }]}>
              {t("routeDetail.loading")}
            </Text>
          </View>
        ) : null}

        {legs !== null && !isPending && result && isErr(result) ? (
          <ErrorState error={result.error} onRetry={() => refetch()} />
        ) : null}

        {legs !== null && !isPending && result && !isErr(result) ? (
          <ScrollView
            contentContainerStyle={styles.list}
            testID="route-detail-list"
          >
            {result.data.map((detail, index) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: legs have no stable id of their own within one route
                key={index}
                style={[
                  styles.legCard,
                  { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
                ]}
                testID={`route-detail-leg-${index}`}
              >
                <Text style={[styles.trainLine, { color: c.textSecondary }]}>
                  {t("routeDetail.trainLabel")}: {detail.leg.trainId} ・{" "}
                  {detail.leg.departureTime} → {detail.leg.arrivalTime}
                </Text>
                <Text
                  style={[styles.direction, { color: c.textSecondary }]}
                  testID="route-detail-direction"
                >
                  {t("routeDetail.direction")}:{" "}
                  {stationName(detail.fromStation, i18n.language)} →{" "}
                  {stationName(detail.toStation, i18n.language)}
                </Text>

                {isPro() ? (
                  <View style={styles.recommendedSection}>
                    <Text
                      style={[styles.recommendedTitle, { color: c.text }]}
                      testID="route-detail-recommended-car"
                    >
                      {t("routeDetail.recommendedCar", {
                        car: detail.boardingAdvice.recommendedCarNumber,
                      })}
                    </Text>

                    <View
                      style={styles.carRow}
                      testID="route-detail-car-diagram"
                    >
                      {Array.from(
                        { length: detail.boardingAdvice.carCount },
                        (_, carIndex) => carIndex + 1,
                      ).map((carNumber) => {
                        const isRecommended =
                          carNumber ===
                          detail.boardingAdvice.recommendedCarNumber;
                        const box = isRecommended ? (
                          <LinearGradient
                            key={carNumber}
                            colors={Gradients[scheme].signal}
                            style={[styles.carBoxRecommended, Shadows.accent]}
                            testID={`route-detail-car-${carNumber}`}
                          >
                            <Text
                              style={[styles.carLabel, { color: c.onAccent }]}
                            >
                              {carNumber}
                            </Text>
                          </LinearGradient>
                        ) : (
                          <View
                            key={carNumber}
                            style={[
                              styles.carBox,
                              { backgroundColor: c.hairline },
                            ]}
                            testID={`route-detail-car-${carNumber}`}
                          >
                            <Text
                              style={[
                                styles.carLabel,
                                { color: c.textSecondary },
                              ]}
                            >
                              {carNumber}
                            </Text>
                          </View>
                        );
                        return isRecommended ? (
                          <Pulse
                            key={carNumber}
                            style={styles.carFlexRecommended}
                          >
                            {box}
                          </Pulse>
                        ) : (
                          <View key={carNumber} style={styles.carFlexNormal}>
                            {box}
                          </View>
                        );
                      })}
                    </View>
                    <Text
                      style={[
                        styles.carDirectionHint,
                        { color: c.textSecondary },
                      ]}
                    >
                      {t("routeDetail.carDirectionHint", {
                        from: stationName(detail.fromStation, i18n.language),
                        to: stationName(detail.toStation, i18n.language),
                      })}
                    </Text>
                    <Text
                      style={[styles.reasonText, { color: c.textSecondary }]}
                    >
                      {t(detail.boardingAdvice.reasonMessageKey)}
                    </Text>
                    <Text
                      style={[
                        styles.confidenceText,
                        { color: c.textSecondary },
                      ]}
                    >
                      {t("results.confidence")}:{" "}
                      {t(
                        CONFIDENCE_LABEL_KEYS[detail.boardingAdvice.confidence],
                      )}
                    </Text>
                  </View>
                ) : (
                  <ProBlurGate
                    locked
                    onPress={() =>
                      paywallGate({
                        type: "pro_feature",
                        feature: "boarding_detail",
                      })
                    }
                    title={t("routeDetail.proGate.title")}
                    ctaLabel={t("routeDetail.proGate.cta")}
                    testID="route-detail-boarding-gate"
                  >
                    <View style={styles.recommendedSection}>
                      <Text
                        style={[styles.recommendedTitle, { color: c.text }]}
                      >
                        {t("routeDetail.recommendedCar", { car: 1 })}
                      </Text>
                      <View style={styles.carRow}>
                        {[1, 2, 3].map((carNumber) => (
                          <View
                            key={carNumber}
                            style={[
                              styles.carBox,
                              styles.carFlexNormal,
                              { backgroundColor: c.hairline },
                            ]}
                          />
                        ))}
                      </View>
                    </View>
                  </ProBlurGate>
                )}

                {detail.perStationProbabilities.length > 0 && isPro() ? (
                  <View style={styles.perStationSection}>
                    <SectionLabel>
                      {t("routeDetail.perStationTitle")}
                    </SectionLabel>
                    {detail.perStationProbabilities.map(
                      ({ station, probability }) => (
                        <View key={station.id} style={styles.perStationRow}>
                          <Text
                            style={[styles.perStationName, { color: c.text }]}
                            numberOfLines={1}
                          >
                            {stationName(station, i18n.language)}
                          </Text>
                          <View
                            style={[
                              styles.perStationTrack,
                              { backgroundColor: c.hairline },
                            ]}
                          >
                            {probability >= 0.7 ? (
                              <LinearGradient
                                colors={Gradients[scheme].signal}
                                style={[
                                  styles.perStationFill,
                                  {
                                    width: `${Math.round(probability * 100)}%`,
                                  },
                                ]}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.perStationFill,
                                  {
                                    width: `${Math.round(probability * 100)}%`,
                                    backgroundColor: probabilityColor(
                                      probability,
                                      c,
                                    ),
                                  },
                                ]}
                              />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.perStationPercent,
                              {
                                color:
                                  probability >= 0.7 ? c.seat : c.textSecondary,
                              },
                            ]}
                          >
                            {Math.round(probability * 100)}%
                          </Text>
                        </View>
                      ),
                    )}
                  </View>
                ) : null}
                {detail.perStationProbabilities.length > 0 && !isPro() ? (
                  <ProBlurGate
                    locked
                    onPress={() =>
                      paywallGate({
                        type: "pro_feature",
                        feature: "full_station_prediction",
                      })
                    }
                    title={t("routeDetail.proGate.title")}
                    ctaLabel={t("routeDetail.proGate.cta")}
                    testID="route-detail-per-station-gate"
                  >
                    <View style={styles.perStationSection}>
                      <SectionLabel>
                        {t("routeDetail.perStationTitle")}
                      </SectionLabel>
                      <View
                        style={[
                          styles.perStationTrack,
                          { backgroundColor: c.hairline },
                        ]}
                      />
                    </View>
                  </ProBlurGate>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {legs !== null ? (
          <View style={styles.ctaWrap} pointerEvents="box-none">
            <LinearGradient
              colors={[`${c.background}00`, `${c.background}F0`]}
              style={styles.ctaFade}
              pointerEvents="none"
            />
            <View style={styles.ctaInner}>
              <GradientButton
                label={t("routeDetail.startRide")}
                onPress={handleStartRide}
                testID="route-detail-start-ride"
              />
            </View>
          </View>
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
    gap: Spacing.two,
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
  list: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: 120,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  legCard: {
    gap: Spacing.two,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
  },
  trainLine: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  direction: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  recommendedSection: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  recommendedTitle: {
    fontFamily: Fonts.jpBold,
    fontSize: 17,
  },
  carRow: {
    flexDirection: "row",
    gap: Spacing.one,
    alignItems: "center",
  },
  carFlexNormal: {
    flex: 1,
  },
  carFlexRecommended: {
    flex: 1.35,
  },
  carBox: {
    height: 34,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  carBoxRecommended: {
    height: 48,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  carLabel: {
    fontFamily: Fonts.numBold,
    fontSize: 13,
  },
  carDirectionHint: {
    fontFamily: Fonts.jp,
    fontSize: 11,
  },
  reasonText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
    lineHeight: 12 * 1.6,
  },
  confidenceText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  perStationSection: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  perStationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  perStationName: {
    width: 62,
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  perStationTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  perStationFill: {
    height: "100%",
    borderRadius: 4,
  },
  perStationPercent: {
    width: 38,
    textAlign: "right",
    fontFamily: Fonts.numBold,
    fontSize: 12,
  },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  ctaFade: {
    height: 48,
  },
  ctaInner: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
});
