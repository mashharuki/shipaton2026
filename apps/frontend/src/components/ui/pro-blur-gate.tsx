import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable } from "@/components/ui/app-pressable";
import { Colors, Fonts, Gradients, Radius } from "@/constants/theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

export type ProBlurGateProps = {
  locked: boolean;
  onPress: () => void;
  title: string;
  ctaLabel: string;
  children: ReactNode;
  testID?: string;
};

/**
 * Pro ゲート。実データを描画したままぼかし、上にオーバーレイを重ねる
 * （＝「隠す」のではなく「かすませる」）。locked=false ならそのまま表示。
 */
export function ProBlurGate({
  locked,
  onPress,
  title,
  ctaLabel,
  children,
  testID,
}: ProBlurGateProps) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];

  if (!locked) return <>{children}</>;

  return (
    <View style={styles.wrap} testID={testID}>
      <View pointerEvents="none">{children}</View>
      <BlurView intensity={28} tint={scheme} style={StyleSheet.absoluteFill} />
      <AppPressable
        accessibilityRole="button"
        onPress={onPress}
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          { backgroundColor: c.overlay },
        ]}
      >
        <LinearGradient
          colors={Gradients[scheme].signal}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.badge}
        >
          <Text style={[styles.badgeText, { color: c.onAccent }]}>PRO</Text>
        </LinearGradient>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.cta, { color: c.textSecondary }]}>{ctaLabel}</Text>
      </AppPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: "hidden" },
  overlay: { alignItems: "center", justifyContent: "center", gap: 10 },
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.sm },
  badgeText: { fontFamily: Fonts.numBold, fontSize: 11, letterSpacing: 0.66 },
  title: { fontFamily: Fonts.jpBold, fontSize: 14 },
  cta: { fontFamily: Fonts.jp, fontSize: 12 },
});
