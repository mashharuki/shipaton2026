import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { useTheme } from "@/hooks/use-theme";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

export type IconProps = {
  name: FeatherIconName;
  size?: number;
  color?: string;
  active?: boolean;
};

export function Icon({
  name,
  size = 20,
  color,
  active = false,
}: IconProps): React.JSX.Element {
  const theme = useTheme();
  const resolvedColor = color ?? (active ? theme.clay : theme.ink);
  return <Feather name={name} size={size} color={resolvedColor} />;
}
