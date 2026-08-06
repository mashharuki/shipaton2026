import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeStore } from "@/stores/theme-store";

/**
 * Resolves the effective light/dark scheme: the user's manual override
 * (14.2's toggle) when set, otherwise the OS setting.
 */
export function useAppColorScheme(): "light" | "dark" {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((state) => state.preference);

  if (preference === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }
  return preference;
}
