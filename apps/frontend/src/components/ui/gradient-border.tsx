import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Colors, Gradients, Radius } from "@/constants/theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

export type GradientBorderCardProps = {
  children: ReactNode;
  strong?: boolean;
};

/**
 * 1px のグラデーション枠カード。推奨ルート・検索カード・レポートのヒーロー・
 * Pro カードなど「この画面の主役」に限って使う（1画面につき最大1つ）。
 */
export function GradientBorderCard({
  children,
  strong = false,
}: GradientBorderCardProps) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const colors = strong
    ? ([
        Gradients[scheme].signal[1],
        Gradients[scheme].signal[0],
        c.hairline,
      ] as const)
    : Gradients[scheme].border;

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.outer}
    >
      <View style={[styles.inner, { backgroundColor: c.surface }]}>
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outer: { borderRadius: Radius.xl, padding: 1 },
  inner: { borderRadius: Radius.xl - 1, padding: 20 },
});
