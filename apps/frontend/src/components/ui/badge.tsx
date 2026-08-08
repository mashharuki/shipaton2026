import { StyleSheet, Text, View } from "react-native";

import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type BadgeTone = "neutral" | "accent";

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function Badge({
  label,
  tone = "neutral",
}: BadgeProps): React.JSX.Element {
  const theme = useTheme();
  const backgroundColor =
    tone === "accent" ? theme.clay : theme.surfaceSelected;
  const color = tone === "accent" ? theme.paper : theme.ink;

  return (
    <View style={[styles.base, { backgroundColor }]}>
      <Text style={[Typography.kicker, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
});
