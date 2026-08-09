import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { Colors, confidenceColor, Gradients } from "@/constants/theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

export type MeterProps = {
  /** 0..1 */
  value: number;
  confidence: "low" | "medium" | "high";
  height?: number;
};

/**
 * 着座確率メーター。信頼度が high のときだけグラデーション、
 * medium は単色ブルー、low はニュートラル（= アクセントを使わない）。
 */
export function Meter({ value, confidence, height = 6 }: MeterProps) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const width = `${Math.max(0, Math.min(1, value)) * 100}%` as const;

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: c.hairline },
      ]}
    >
      {confidence === "high" ? (
        <LinearGradient
          colors={Gradients[scheme].signal}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ width, height: "100%", borderRadius: height / 2 }}
        />
      ) : (
        <View
          style={{
            width,
            height: "100%",
            borderRadius: height / 2,
            backgroundColor: confidenceColor(confidence, scheme),
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
});
