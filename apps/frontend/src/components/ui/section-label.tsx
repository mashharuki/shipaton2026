import { Text } from "react-native";

import { Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type SectionLabelProps = {
  children: string;
};

export function SectionLabel({
  children,
}: SectionLabelProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Text style={[Typography.kicker, { color: theme.textSecondary }]}>
      {children}
    </Text>
  );
}
