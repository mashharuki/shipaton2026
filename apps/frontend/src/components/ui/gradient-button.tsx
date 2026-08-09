import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable } from "@/components/ui/app-pressable";
import { Colors, Fonts, Gradients, Shadows } from "@/constants/theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

export type GradientButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "solid" | "outline";
  right?: ReactNode;
  testID?: string;
};

/** 唯一のプライマリ CTA。高さ 54 / radius 17 / グラデ + アクセント影。 */
export function GradientButton({
  label,
  onPress,
  variant = "solid",
  right,
  testID,
}: GradientButtonProps) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];

  if (variant === "outline") {
    return (
      <AppPressable
        accessibilityRole="button"
        onPress={onPress}
        testID={testID}
        style={[styles.outline, { borderColor: c.hairline }]}
      >
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      </AppPressable>
    );
  }

  return (
    <AppPressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={Shadows.accent}
    >
      <LinearGradient
        colors={Gradients[scheme].signal}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.solid}
      >
        <Text style={[styles.label, { color: c.onAccent }]}>{label}</Text>
        {right ? <View style={styles.right}>{right}</View> : null}
      </LinearGradient>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  solid: {
    height: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  outline: {
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: Fonts.jpBold, fontSize: 16, lineHeight: 16 },
  right: { marginLeft: 4 },
});
