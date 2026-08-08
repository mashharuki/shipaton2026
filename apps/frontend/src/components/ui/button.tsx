import { type StyleProp, StyleSheet, Text, type ViewStyle } from "react-native";

import { AppPressable } from "@/components/ui/app-pressable";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: "button";
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  testID,
  accessibilityLabel,
  accessibilityRole = "button",
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        styles.base,
        variant === "primary" && { backgroundColor: theme.clay },
        variant === "secondary" && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.hairline,
          backgroundColor: "transparent",
        },
        variant === "ghost" && { backgroundColor: "transparent" },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Text
        style={[
          Typography.bodyMedium,
          { color: variant === "primary" ? theme.paper : theme.ink },
        ]}
      >
        {label}
      </Text>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
