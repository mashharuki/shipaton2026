import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAppError, isErr } from "shared";

import { ErrorState } from "@/components/error-state";
import { CONFIDENCE_LABEL_KEYS } from "@/components/route-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import type { Station } from "@/features/prediction/use-route-detail";
import { useRouteDetail } from "@/features/prediction/use-route-detail";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { isPro } from "@/features/subscription/subscription-gate";
import { usePaywallGate } from "@/features/subscription/use-paywall-gate";
import type { SupportedLocale } from "@/lib/i18n";

function stationName(station: Station, language: string): string {
  return (language as SupportedLocale) === "ja"
    ? station.nameJa
    : station.nameEn;
}

type ProGateFeature = "boarding_detail" | "full_station_prediction";

// 12.4: locked teaser shown instead of the two Pro-only sections
// (detailed car/boarding-position guidance, full-route per-station seat
// probability) for a Free user. Kept local to this screen rather than a
// shared component -- 7.1/8.3 gate different Pro features behind the same
// guard() mechanism but design.md leaves each task owning its own
// presentation.
function ProGateTeaser({
  feature,
  testID,
}: {
  feature: ProGateFeature;
  testID: string;
}) {
  const { t } = useTranslation();
  const paywallGate = usePaywallGate();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => paywallGate({ type: "pro_feature", feature })}
      testID={testID}
    >
      <ThemedView type="backgroundSelected" style={styles.proGate}>
        <ThemedText type="smallBold">
          {t("routeDetail.proGate.title")}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t("routeDetail.proGate.cta")}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
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

  const { data: result, isPending, refetch } = useRouteDetail(legs);

  return (
    <ThemedView style={styles.container} testID="route-detail-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="route-detail-back"
          >
            <ThemedText type="link">{t("common.back")}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t("routeDetail.title")}
          </ThemedText>
        </ThemedView>

        {legs === null ? (
          <ErrorState error={createAppError("unknown", "No route selected")} />
        ) : null}

        {legs !== null && isPending ? (
          <ThemedView style={styles.loading} testID="route-detail-loading">
            <ActivityIndicator />
            <ThemedText type="default" themeColor="textSecondary">
              {t("routeDetail.loading")}
            </ThemedText>
          </ThemedView>
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
              <ThemedView
                // biome-ignore lint/suspicious/noArrayIndexKey: legs have no stable id of their own within one route
                key={index}
                type="backgroundElement"
                style={styles.legCard}
                testID={`route-detail-leg-${index}`}
              >
                <ThemedText type="smallBold">
                  {t("routeDetail.trainLabel")}: {detail.leg.trainId}
                </ThemedText>
                <ThemedText type="default">
                  {t("routeDetail.departureLabel")}: {detail.leg.departureTime}{" "}
                  → {detail.leg.arrivalTime}
                </ThemedText>

                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  testID="route-detail-direction"
                >
                  {t("routeDetail.direction")}:{" "}
                  {stationName(detail.fromStation, i18n.language)} →{" "}
                  {stationName(detail.toStation, i18n.language)}
                </ThemedText>

                {isPro() ? (
                  <>
                    <ThemedText
                      type="default"
                      testID="route-detail-recommended-car"
                    >
                      {t("routeDetail.recommendedCar", {
                        car: detail.boardingAdvice.recommendedCarNumber,
                      })}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(detail.boardingAdvice.reasonMessageKey)}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t("results.confidence")}:{" "}
                      {t(
                        CONFIDENCE_LABEL_KEYS[detail.boardingAdvice.confidence],
                      )}
                    </ThemedText>

                    <ThemedText type="small" style={styles.sectionLabel}>
                      {t("routeDetail.waitingPosition")}
                    </ThemedText>
                    <ThemedView
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
                        return (
                          <ThemedView
                            key={carNumber}
                            type={
                              isRecommended
                                ? "backgroundSelected"
                                : "background"
                            }
                            style={styles.carBox}
                            testID={`route-detail-car-${carNumber}`}
                          >
                            <ThemedText
                              type={isRecommended ? "smallBold" : "small"}
                            >
                              {carNumber}
                            </ThemedText>
                          </ThemedView>
                        );
                      })}
                    </ThemedView>
                  </>
                ) : (
                  <ProGateTeaser
                    feature="boarding_detail"
                    testID="route-detail-boarding-gate"
                  />
                )}

                {detail.perStationProbabilities.length > 0 && isPro() ? (
                  <>
                    <ThemedText type="small" style={styles.sectionLabel}>
                      {t("routeDetail.perStationTitle")}
                    </ThemedText>
                    {detail.perStationProbabilities.map(
                      ({ station, probability }) => (
                        <ThemedText key={station.id} type="small">
                          {stationName(station, i18n.language)}:{" "}
                          {t("results.percentValue", {
                            percent: Math.round(probability * 100),
                          })}
                        </ThemedText>
                      ),
                    )}
                  </>
                ) : null}
                {detail.perStationProbabilities.length > 0 && !isPro() ? (
                  <ProGateTeaser
                    feature="full_station_prediction"
                    testID="route-detail-per-station-gate"
                  />
                ) : null}
              </ThemedView>
            ))}
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
  list: {
    gap: Spacing.three,
  },
  legCard: {
    gap: Spacing.one,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  sectionLabel: {
    marginTop: Spacing.two,
  },
  carRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  carBox: {
    width: 32,
    height: 32,
    borderRadius: Spacing.one,
    alignItems: "center",
    justifyContent: "center",
  },
  proGate: {
    gap: Spacing.one,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
});
