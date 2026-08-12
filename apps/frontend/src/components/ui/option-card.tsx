import { Pressable, StyleSheet, Text } from "react-native";

import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

// Extracted from feedback.tsx so the search form's station/time pickers
// present identical selectable rows (both are "pick one from a short
// inline list" surfaces). Kept presentational: no state, no i18n -- the
// caller passes an already-translated label.
export function OptionCard({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={[
        styles.option,
        { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
      ]}
    >
      <Text style={[styles.optionText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 60,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    justifyContent: "center",
  },
  optionText: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
});
