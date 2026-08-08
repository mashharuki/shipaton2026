/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/style/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    // -- pre-Heritage tokens (kept working until Clusters 2-4 migrate every
    // screen off them, then removed) --
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    // -- Heritage tokens (docs/superpowers/specs/2026-08-08-heritage-redesign-design.md) --
    ink: "#1A1C1E",
    paper: "#F6F4EF",
    surface: "#FBF9F5",
    surfaceSelected: "#ECE8E0",
    hairline: "rgba(26,28,30,0.12)",
    textSecondary: "#5C5952",
    clay: "#B8422E",
    signal: "#9C6B2E",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    ink: "#F2EFE9",
    paper: "#161513",
    surface: "#201F1C",
    surfaceSelected: "#2A2822",
    hairline: "rgba(242,239,233,0.12)",
    textSecondary: "#B4AFA4",
    clay: "#E2694A",
    signal: "#C99A4A",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  seven: 96,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const Motion = {
  pressScale: 0.97,
  pressOpacity: 0.85,
  pressDurationMs: 120,
} as const;

const publicSansWeight = {
  regular: "PublicSans_400Regular",
  medium: "PublicSans_500Medium",
  semiBold: "PublicSans_600SemiBold",
  bold: "PublicSans_700Bold",
} as const;

export const Typography = {
  display: { fontFamily: publicSansWeight.bold, fontSize: 40, lineHeight: 44 },
  h1: { fontFamily: publicSansWeight.bold, fontSize: 32, lineHeight: 38 },
  h2: { fontFamily: publicSansWeight.semiBold, fontSize: 22, lineHeight: 28 },
  kicker: {
    fontFamily: publicSansWeight.semiBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.04,
  },
  body: { fontFamily: publicSansWeight.regular, fontSize: 16, lineHeight: 24 },
  bodyMedium: {
    fontFamily: publicSansWeight.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  small: { fontFamily: publicSansWeight.regular, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: publicSansWeight.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  numericLarge: {
    fontFamily: publicSansWeight.bold,
    fontSize: 28,
    lineHeight: 32,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
