import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StandingMinutesEstimate } from "shared";

import { GradientBorderCard } from "@/components/ui/gradient-border";
import { Meter } from "@/components/ui/meter";
import { Colors, Fonts, Radius, Spacing, Typography } from "@/constants/theme";
import type {
  RankedRoute,
  RankedRouteType,
} from "@/features/search/route-ranker";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

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

/**
 * 情報階層: ESM（最大の数字） > 着座確率メーター > 到着/所要/乗換 > 信頼度。
 * comfort カードだけがヒーロー扱い（グラデ枠 + 46px の ESM）。
 */
export function RouteCard({
  route,
  fastestStandingMinutes,
  onPress,
}: RouteCardProps) {
  const { t } = useTranslation();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const standing = route.prediction.standingMinutes;
  const isHero = route.type === "comfort";

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
    isHero &&
    fastestStandingMinutes !== undefined &&
    route.diffFromFastestMinutes > 0;

  const body = (
    <View style={styles.body}>
      <View style={styles.headRow}>
        <View style={styles.badges}>
          <View
            style={[
              styles.badge,
              { backgroundColor: isHero ? `${c.seat}29` : c.surfaceMuted },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: isHero ? c.seat : c.text }]}
            >
              {t(TYPE_LABEL_KEYS[route.type])}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.surfaceMuted }]}>
            <Text style={[styles.badgeText, { color: c.textSecondary }]}>
              {t("results.confidence")}{" "}
              {t(CONFIDENCE_LABEL_KEYS[route.prediction.confidence])}
            </Text>
          </View>
        </View>
        {route.diffFromFastestMinutes > 0 ? (
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            +{route.diffFromFastestMinutes}分
          </Text>
        ) : null}
      </View>

      <View style={styles.metricRow}>
        <View>
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t("results.standingMinutes")}
          </Text>
          <Text
            style={[isHero ? styles.esmHero : styles.esm, { color: c.text }]}
          >
            {standingText.replace(/\s*分$/, "")}
            <Text style={[styles.unit, { color: c.textSecondary }]}> 分</Text>
          </Text>
        </View>
        <View style={styles.meterCol}>
          <View style={styles.meterHead}>
            <Text style={[styles.label, { color: c.textSecondary }]}>
              {t("results.seatProbability")}
            </Text>
            <Text
              style={[
                styles.pct,
                {
                  color:
                    route.prediction.confidence === "high" ? c.seat : c.text,
                },
              ]}
            >
              {Math.round(route.prediction.seatProbability * 100)}%
            </Text>
          </View>
          <Meter
            value={route.prediction.seatProbability}
            confidence={route.prediction.confidence}
          />
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            {route.arrivalTime} 着 ・ {route.totalMinutes}分 ・{" "}
            {t("results.transferCount")} {route.transferCount}
          </Text>
        </View>
      </View>

      {showComfortDiff ? (
        <>
          <View style={[styles.rule, { backgroundColor: c.hairline }]} />
          <Text style={[styles.diff, { color: c.seat }]} testID="comfort-diff">
            {t("results.comfortDiff", {
              extra: route.diffFromFastestMinutes,
              reduced: reducedMinutes,
            })}
          </Text>
        </>
      ) : null}

      {!("point" in standing) ? (
        <Text style={[styles.note, { color: c.textSecondary }]}>
          {t("results.rangeNotice")}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      testID={`route-card-${route.type}`}
      style={({ pressed }) => pressed && onPress && styles.pressed}
    >
      {isHero ? (
        <GradientBorderCard strong>{body}</GradientBorderCard>
      ) : (
        <View
          style={[
            styles.plain,
            { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
          ]}
        >
          {body}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plain: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.four },
  body: { gap: Spacing.three },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: { flexDirection: "row", gap: Spacing.two },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.sm },
  badgeText: { fontFamily: Fonts.jpBold, fontSize: 11, lineHeight: 11 },
  metricRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.four,
  },
  meterCol: { flex: 1, gap: Spacing.two, paddingBottom: Spacing.one },
  meterHead: { flexDirection: "row", justifyContent: "space-between" },
  label: { ...Typography.caption },
  esm: { ...Typography.numericLarge },
  esmHero: {
    fontFamily: Fonts.numBold,
    fontSize: 46,
    lineHeight: 46,
    letterSpacing: -0.9,
  },
  unit: { fontFamily: Fonts.jp, fontSize: 15 },
  pct: { fontFamily: Fonts.numBold, fontSize: 12 },
  meta: { ...Typography.caption },
  rule: { height: 1 },
  diff: { fontFamily: Fonts.jpBold, fontSize: 13, lineHeight: 20 },
  note: { ...Typography.caption },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
