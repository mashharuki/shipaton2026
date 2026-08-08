/**
 * Clamps an arbitrary number into [0, 1] for use as a bar-fill ratio.
 * NaN (e.g. a 0/0 probability computation upstream) clamps to 0 rather than
 * rendering a NaN%-width bar.
 */
export function clampRatio(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
