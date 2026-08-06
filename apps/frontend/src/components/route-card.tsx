import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import type { StandingMinutesEstimate } from "shared";

import { Spacing } from "@/constants/theme";
import type {
  RankedRoute,
  RankedRouteType,
} from "@/features/search/route-ranker";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

const TYPE_LABEL_KEYS: Record<RankedRouteType, string> = {
  fastest: "results.fastest",
  balanced: "results.balanced",
  comfort: "results.comfort",
};

export const CONFIDENCE_LABEL_KEYS: Record<string, string> = {
  low: "results.confidenceLow",
  medium: "results.confidenceMedium",
  high: "results.confidenceHigh",
};

export function standingMinutesPoint(
  estimate: StandingMinutesEstimate,
): number {
  return "point" in estimate
    ? estimate.point
    : (estimate.rangeMin + estimate.rangeMax) / 2;
}

export type RouteCardProps = {
  route: RankedRoute;
  // Only meaningful for the "comfort" card -- the fastest option's own
  // standing-time point estimate, needed to compute "追加 N 分で M 分削減"
  // (4.3).
  fastestStandingMinutes?: number;
  // 5.5: selecting a route to view its detail/boarding-position screen.
  // Optional so this component stays usable in a purely-display context.
  onPress?: () => void;
};

// 4.2/4.3: one card = one RankedRoute, showing every metric design.md's
// requirement lists (arrival, duration, diff-from-fastest, standing/seated
// minutes, seat probability, transfer count, comfort score, confidence),
// plus the comfort-specific "extra time for less standing" tradeoff line.
export function RouteCard({
  route,
  fastestStandingMinutes,
  onPress,
}: RouteCardProps) {
  const { t } = useTranslation();
  const standing = route.prediction.standingMinutes;
  const standingText =
    "point" in standing
      ? t("results.standingMinutesPoint", {
          minutes: Math.round(standing.point),
        })
      : t("results.standingMinutesRange", {
          min: Math.round(standing.rangeMin),
          max: Math.round(standing.rangeMax),
        });

  const reducedMinutes =
    fastestStandingMinutes !== undefined
      ? Math.max(
          0,
          Math.round(fastestStandingMinutes - standingMinutesPoint(standing)),
        )
      : 0;
  const showComfortDiff =
    route.type === "comfort" &&
    fastestStandingMinutes !== undefined &&
    route.diffFromFastestMinutes > 0;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => pressed && onPress && styles.pressed}
    >
      <ThemedView
        type="backgroundElement"
        style={styles.card}
        testID={`route-card-${route.type}`}
      >
        <ThemedText type="smallBold">
          {t(TYPE_LABEL_KEYS[route.type])}
        </ThemedText>
        <ThemedText type="title" style={styles.arrival} testID="route-arrival">
          {route.arrivalTime}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          {t("results.duration")}:{" "}
          {t("results.minutesValue", { minutes: route.totalMinutes })}
        </ThemedText>
        {route.diffFromFastestMinutes > 0 ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="route-diff"
          >
            {t("results.diffFromFastest", {
              minutes: route.diffFromFastestMinutes,
            })}
          </ThemedText>
        ) : null}
        <ThemedText type="default">
          {t("results.standingMinutes")}: {standingText}
        </ThemedText>
        <ThemedText type="default">
          {t("results.seatedMinutes")}:{" "}
          {t("results.minutesValue", {
            minutes: Math.round(route.prediction.seatedMinutes),
          })}
        </ThemedText>
        <ThemedText type="default">
          {t("results.seatProbability")}:{" "}
          {t("results.percentValue", {
            percent: Math.round(route.prediction.seatProbability * 100),
          })}
        </ThemedText>
        <ThemedText type="default">
          {t("results.transferCount")}: {route.transferCount}
        </ThemedText>
        <ThemedText type="default">
          {t("results.comfortScore")}:{" "}
          {t("results.percentValue", {
            percent: Math.round(route.prediction.comfortScore * 100),
          })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t("results.confidence")}:{" "}
          {t(CONFIDENCE_LABEL_KEYS[route.prediction.confidence])}
        </ThemedText>
        {showComfortDiff ? (
          <ThemedText type="smallBold" testID="comfort-diff">
            {t("results.comfortDiff", {
              extra: route.diffFromFastestMinutes,
              reduced: reducedMinutes,
            })}
          </ThemedText>
        ) : null}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  arrival: {
    fontSize: 32,
    lineHeight: 36,
  },
  pressed: {
    opacity: 0.7,
  },
});
