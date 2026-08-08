import { StyleSheet, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export type DividerProps = {
  orientation?: "horizontal" | "vertical";
};

export function Divider({
  orientation = "horizontal",
}: DividerProps): React.JSX.Element {
  const theme = useTheme();
  const isHorizontal = orientation === "horizontal";

  return (
    <View
      style={[
        isHorizontal ? styles.horizontal : styles.vertical,
        { backgroundColor: theme.hairline },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: { height: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  vertical: { width: StyleSheet.hairlineWidth, alignSelf: "stretch" },
});
