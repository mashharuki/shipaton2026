import { describe, expect, it, vi } from "vitest";

// Mock react-native before importing theme which depends on it
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (options: Record<string, unknown>) =>
      options.ios ?? options.default,
  },
}));

import { contrastRatio } from "@/constants/contrast-ratio";
import { Colors } from "@/constants/theme";

const WCAG_AA_NORMAL_TEXT = 4.5;

describe("contrastRatio", () => {
  it("should return 1 when given the same color twice", () => {
    expect(contrastRatio("#1A1C1E", "#1A1C1E")).toBeCloseTo(1, 2);
  });

  it("should return ~21 for pure black against pure white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("should be symmetric regardless of argument order", () => {
    const a = contrastRatio("#B8422E", "#F6F4EF");
    const b = contrastRatio("#F6F4EF", "#B8422E");
    expect(a).toBeCloseTo(b, 5);
  });
});

describe("Heritage token contrast (WCAG AA, normal text)", () => {
  it("should pass ink on paper (light)", () => {
    expect(
      contrastRatio(Colors.light.ink, Colors.light.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass textSecondary on paper (light)", () => {
    expect(
      contrastRatio(Colors.light.textSecondary, Colors.light.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass clay on paper (light) for text/link use", () => {
    expect(
      contrastRatio(Colors.light.clay, Colors.light.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass paper on clay (light) for button labels", () => {
    expect(
      contrastRatio(Colors.light.paper, Colors.light.clay),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass signal on paper (light)", () => {
    expect(
      contrastRatio(Colors.light.signal, Colors.light.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass ink on paper (dark)", () => {
    expect(
      contrastRatio(Colors.dark.ink, Colors.dark.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass textSecondary on paper (dark)", () => {
    expect(
      contrastRatio(Colors.dark.textSecondary, Colors.dark.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass clay on paper (dark)", () => {
    expect(
      contrastRatio(Colors.dark.clay, Colors.dark.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("should pass signal on paper (dark)", () => {
    expect(
      contrastRatio(Colors.dark.signal, Colors.dark.paper),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});
