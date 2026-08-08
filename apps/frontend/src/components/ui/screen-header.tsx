import { StyleSheet, Text, View } from "react-native";

import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

export function ScreenHeader({
  title,
  subtitle,
}: ScreenHeaderProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[Typography.h1, { color: theme.ink }]}>{title}</Text>
      {subtitle ? (
        <Text style={[Typography.body, { color: theme.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one, marginBottom: Spacing.four },
});
