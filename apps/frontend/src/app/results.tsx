import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isErr } from "shared";

import { ErrorState } from "@/components/error-state";
import { RouteCard, standingMinutesPoint } from "@/components/route-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useRouteSearch } from "@/features/search/use-route-search";
import { isPro } from "@/features/subscription/subscription-gate";
import { analyticsClient } from "@/lib/analytics";

// 4.1-4.4: the search → 3-option comparison screen. Query params come from
// whatever triggered the search (home screen's search form, a saved route,
// a notification deep link, ...); this screen owns only rendering the
// result of a search that's already been specified, not the search FORM
// itself.
export default function ResultsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    fromStationId?: string;
    toStationId?: string;
    departureTime?: string;
  }>();

  const query =
    params.fromStationId && params.toStationId && params.departureTime
      ? {
          fromStationId: params.fromStationId,
          toStationId: params.toStationId,
          departureTime: params.departureTime,
        }
      : null;

  const { data: result, isPending, refetch } = useRouteSearch(query);

  const fastestStandingMinutes =
    result && !isErr(result)
      ? standingMinutesPoint(
          (
            result.data.find((route) => route.type === "fastest") ??
            result.data[0]
          )?.prediction.standingMinutes ?? { point: 0 },
        )
      : undefined;

  return (
    <ThemedView style={styles.container} testID="results-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="results-back"
          >
            <ThemedText type="link">{t("common.back")}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t("results.title")}
          </ThemedText>
        </ThemedView>

        {!query ? (
          <ThemedView style={styles.emptyState} testID="results-missing-query">
            <ThemedText type="default" themeColor="textSecondary">
              {t("results.missingQuery")}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/")}
              testID="results-missing-query-home"
            >
              <ThemedText type="link">{t("results.backToHome")}</ThemedText>
            </Pressable>
          </ThemedView>
        ) : null}

        {query && isPending ? (
          <ThemedView style={styles.loading} testID="results-loading">
            <ActivityIndicator />
            <ThemedText type="default" themeColor="textSecondary">
              {t("results.loading")}
            </ThemedText>
          </ThemedView>
        ) : null}

        {query && !isPending && result && isErr(result) ? (
          <ErrorState error={result.error} onRetry={() => refetch()} />
        ) : null}

        {query &&
        !isPending &&
        result &&
        !isErr(result) &&
        result.data.length === 0 ? (
          <ThemedView style={styles.emptyState} testID="results-empty">
            <ThemedText type="default" themeColor="textSecondary">
              {t("results.noRoutes")}
            </ThemedText>
          </ThemedView>
        ) : null}

        {query &&
        !isPending &&
        result &&
        !isErr(result) &&
        result.data.length > 0 ? (
          <ScrollView contentContainerStyle={styles.list} testID="results-list">
            {result.data.map((route) => (
              <RouteCard
                key={route.type}
                route={route}
                fastestStandingMinutes={
                  route.type === "comfort" ? fastestStandingMinutes : undefined
                }
                onPress={() => {
                  // 17.1/17.2/10.1: "ルート選択（種別ごと）" -- fired at the
                  // one place a route in the 3-way comparison actually gets
                  // chosen, with the metrics already computed for this card.
                  analyticsClient.track("route_selected", {
                    routeType: route.type,
                    diffFromFastestMinutes: route.diffFromFastestMinutes,
                    confidence: route.prediction.confidence,
                    planType: isPro() ? "pro" : "free",
                  });
                  router.push({
                    pathname: "/route-detail",
                    params: {
                      legs: JSON.stringify(route.candidate.legs),
                      routeType: route.type,
                    },
                  });
                }}
              />
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
  emptyState: {
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.three,
  },
  list: {
    gap: Spacing.three,
  },
});
