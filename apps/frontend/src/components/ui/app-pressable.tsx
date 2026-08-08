import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Motion } from "@/constants/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type AppPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
};

export function AppPressable({
  style,
  onPressIn,
  onPressOut,
  ...rest
}: AppPressableProps): React.JSX.Element {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - Motion.pressScale) }],
    opacity: 1 - pressed.value * (1 - Motion.pressOpacity),
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: Motion.pressDurationMs });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, { duration: Motion.pressDurationMs });
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
