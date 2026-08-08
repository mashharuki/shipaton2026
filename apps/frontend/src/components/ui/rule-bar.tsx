import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { clampRatio } from "@/components/ui/rule-bar-math";
import { useTheme } from "@/hooks/use-theme";

export type RuleBarProps = {
  ratio: number;
  height?: number;
};

export function RuleBar({ ratio, height = 4 }: RuleBarProps): React.JSX.Element {
  const theme = useTheme();
  const fillRatio = useSharedValue(0);
  const targetRatio = clampRatio(ratio);

  useEffect(() => {
    fillRatio.value = withTiming(targetRatio, { duration: 400 });
  }, [targetRatio, fillRatio]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillRatio.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: theme.surfaceSelected, height, borderRadius: height / 2 },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          fillStyle,
          { backgroundColor: theme.clay, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0 },
});
