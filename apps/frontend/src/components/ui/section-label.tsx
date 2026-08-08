import { Text } from "react-native";

import { Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type SectionLabelProps = {
  children: string;
  testID?: string;
};

export function SectionLabel({
  children,
  testID,
}: SectionLabelProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <Text
      testID={testID}
      style={[Typography.kicker, { color: theme.textSecondary }]}
    >
      {children}
    </Text>
  );
}
