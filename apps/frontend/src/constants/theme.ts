/**
 * SeatSignal design tokens — "Night Rail"
 * docs/img/banner.png / icon.png の配色に合わせた差し替え案。
 * 既存の Colors.light / Colors.dark のキー名は踏襲し、clay/signal のみ rail/seat に改名。
 */

import "@/style/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    // 互換のため残す（旧トークン利用箇所が消えたら削除）
    text: "#0A1520",
    background: "#F4F7FA",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#E8EEF4",

    ink: "#0A1520",
    paper: "#F4F7FA",
    surface: "#FFFFFF",
    surfaceMuted: "#FFFFFF",
    surfaceSelected: "#E8EEF4",
    hairline: "rgba(10,21,32,0.09)",
    textSecondary: "#5A7183",
    rail: "#0B78C4",
    // Handoff spec value #0E8C6B fails WCAG AA (4.5:1) against the light
    // background/paper token; darkened slightly (same hue) to meet the
    // handoff's own accessibility acceptance criterion. See
    // test/constants/contrast-ratio.test.ts.
    seat: "#0D8162",
    onAccent: "#FFFFFF",
    confidenceLow: "rgba(10,21,32,0.30)",
    confidenceMedium: "rgba(11,120,196,0.65)",
    overlay: "rgba(244,247,250,0.86)",
  },
  dark: {
    text: "#FFFFFF",
    background: "#070C13",
    backgroundElement: "rgba(255,255,255,0.045)",
    backgroundSelected: "rgba(255,255,255,0.09)",

    ink: "#FFFFFF",
    paper: "#070C13",
    surface: "#0C1620",
    surfaceMuted: "rgba(255,255,255,0.045)",
    surfaceSelected: "rgba(255,255,255,0.09)",
    hairline: "rgba(255,255,255,0.07)",
    textSecondary: "#7E93A6",
    rail: "#1FA2FF",
    seat: "#2DD4A7",
    onAccent: "#06222B",
    confidenceLow: "rgba(255,255,255,0.28)",
    confidenceMedium: "rgba(127,216,255,0.75)",
    overlay: "rgba(12,22,32,0.86)",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** CTA・枠線・バーで使う唯一のグラデーション。角度は CTA 100deg / 枠線 140deg。 */
export const Gradients = {
  dark: {
    signal: ["#1FA2FF", "#2DD4A7"] as const,
    border: [
      "rgba(31,162,255,0.55)",
      "rgba(45,212,167,0.35)",
      "rgba(255,255,255,0.06)",
    ] as const,
  },
  light: {
    // Terminal stop matches Colors.light.seat (#0D8162) -- keep them in sync;
    // the un-darkened #0E8C6B fails WCAG AA against onAccent (see
    // test/constants/contrast-ratio.test.ts).
    signal: ["#0B78C4", "#0D8162"] as const,
    border: [
      "rgba(11,120,196,0.55)",
      "rgba(14,140,107,0.35)",
      "rgba(10,21,32,0.06)",
    ] as const,
  },
} as const;

/** 和文と数値でフォントを分ける。数値は必ず num（tabular）を使うこと。 */
export const Fonts = Platform.select({
  default: {
    jp: "ZenKakuGothicNew_400Regular",
    jpBold: "ZenKakuGothicNew_700Bold",
    jpBlack: "ZenKakuGothicNew_900Black",
    num: "Outfit_500Medium",
    numBold: "Outfit_600SemiBold",
    mono: "monospace",
  },
  web: {
    jp: '"Zen Kaku Gothic New", system-ui, sans-serif',
    jpBold: '"Zen Kaku Gothic New", system-ui, sans-serif',
    jpBlack: '"Zen Kaku Gothic New", system-ui, sans-serif',
    num: "Outfit, system-ui, sans-serif",
    numBold: "Outfit, system-ui, sans-serif",
    mono: "ui-monospace, monospace",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 22,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const Motion = {
  pressScale: 0.97,
  pressOpacity: 0.85,
  pressDurationMs: 120,
  enterDurationMs: 320,
  enterTranslateY: 10,
  pulseDurationMs: 2600,
} as const;

export const Shadows = {
  accent: {
    shadowColor: "#2DD4A7",
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
} as const;

export const Typography = {
  display: { fontFamily: Fonts.jpBlack, fontSize: 40, lineHeight: 44 },
  h1: { fontFamily: Fonts.jpBlack, fontSize: 28, lineHeight: 34 },
  h2: { fontFamily: Fonts.jpBold, fontSize: 20, lineHeight: 26 },
  kicker: {
    fontFamily: Fonts.numBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.54,
  },
  body: { fontFamily: Fonts.jp, fontSize: 14, lineHeight: 24 },
  bodyBold: { fontFamily: Fonts.jpBold, fontSize: 14, lineHeight: 24 },
  bodyMedium: { fontFamily: Fonts.jp, fontSize: 14, lineHeight: 24 },
  small: { fontFamily: Fonts.jp, fontSize: 12, lineHeight: 18 },
  caption: { fontFamily: Fonts.jp, fontSize: 11, lineHeight: 16 },
  /** 画面で最大の数字（レポートのヒーロー、比較の推奨カード） */
  numericHero: {
    fontFamily: Fonts.numBold,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -1,
  },
  numericLarge: { fontFamily: Fonts.numBold, fontSize: 32, lineHeight: 32 },
  numericMedium: { fontFamily: Fonts.numBold, fontSize: 20, lineHeight: 20 },
} as const;

/** 信頼度 → 表示色。low で seat/rail を使わないための唯一の入口。 */
export function confidenceColor(
  confidence: "low" | "medium" | "high",
  scheme: "light" | "dark",
): string {
  const c = Colors[scheme];
  if (confidence === "high") return c.seat;
  if (confidence === "medium") return c.confidenceMedium;
  return c.confidenceLow;
}

export const BottomTabInset = Platform.select({ ios: 88, android: 92 }) ?? 88;
export const MaxContentWidth = 800;
