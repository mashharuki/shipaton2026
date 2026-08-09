import type { ReactNode } from "react";
import { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export type PulseProps = {
  children: ReactNode;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
};

/** opacity .55→1 / scale 1→1.06, ease-in-out, infinite. */
export function Pulse({ children, durationMs = 2600, style }: PulseProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: durationMs / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [durationMs, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + progress.value * 0.45,
    transform: [{ scale: 1 + progress.value * 0.06 }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  );
}
