import { StyleSheet, Text, View } from "react-native";

import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type StatRowProps = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export function StatRow({
  label,
  value,
  emphasis = false,
}: StatRowProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[Typography.small, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          emphasis ? Typography.numericLarge : Typography.bodyMedium,
          { color: theme.ink, fontVariant: ["tabular-nums"] },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingVertical: Spacing.one,
  },
});
