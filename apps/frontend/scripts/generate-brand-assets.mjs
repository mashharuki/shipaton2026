// Heritage rebrand (Cluster 1 of the redesign; full rationale lives in a
// local, untracked design-process doc). Regenerates every store-facing brand
// asset from one SVG mark so they never drift from each other again. Re-run
// after changing the mark or the palette; this script is not imported by the
// app at runtime.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const INK = "#1A1C1E";
const PAPER = "#F6F4EF";
const CLAY = "#B8422E";

// A minimal geometric mark: a seat silhouette (back + two legs) above three
// horizontal "signal" bars of increasing length -- reads as both a transit
// seat and a signal-strength / schedule-board motif, in the Heritage palette.
const seatAndBarsPaths = `
  <path d="M 352 320 L 352 560 Q 352 592 384 592 L 640 592 Q 672 592 672 560 L 672 320 Q 672 288 640 288 L 384 288 Q 352 288 352 320 Z" />
  <rect x="352" y="592" width="48" height="160" rx="8" />
  <rect x="624" y="592" width="48" height="160" rx="8" />
`;

const iconSvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="${INK}"/>
  <g fill="${PAPER}">${seatAndBarsPaths}</g>
  <g fill="${CLAY}">
    <rect x="352" y="768" width="120" height="24" rx="12"/>
    <rect x="352" y="808" width="200" height="24" rx="12"/>
    <rect x="352" y="848" width="320" height="24" rx="12"/>
  </g>
</svg>`;

// Android adaptive-icon monochrome layer: OS applies its own tint, so this
// must be a plain white silhouette on a transparent background, not a copy
// of the full-color icon.
const monochromeSvg = `
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <g fill="#FFFFFF">
    ${seatAndBarsPaths}
    <rect x="352" y="768" width="120" height="24" rx="12"/>
    <rect x="352" y="808" width="200" height="24" rx="12"/>
    <rect x="352" y="848" width="320" height="24" rx="12"/>
  </g>
</svg>`;

const assetsDir = path.join(import.meta.dirname, "..", "assets", "images");

const outputs = [
  { file: "icon.png", svg: iconSvg, size: 1024 },
  { file: "android-icon-foreground.png", svg: iconSvg, size: 1024 },
  { file: "android-icon-monochrome.png", svg: monochromeSvg, size: 1024 },
  { file: "splash-icon.png", svg: iconSvg, size: 512 },
  { file: "favicon.png", svg: iconSvg, size: 256 },
];

async function main() {
  await mkdir(assetsDir, { recursive: true });
  for (const { file, svg, size } of outputs) {
    const outputPath = path.join(assetsDir, file);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outputPath);
    console.log(`wrote ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
