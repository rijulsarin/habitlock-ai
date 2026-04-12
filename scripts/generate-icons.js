/**
 * Generates habitlock-ai icon assets from SVG.
 *
 * Icon concept: Option A
 * - Deep indigo circle (#4338ca)
 * - White looping checkmark: a standard check whose upstroke
 *   curves into a small teardrop loop at the top-right,
 *   suggesting continuation rather than completion.
 *
 * Run: node scripts/generate-icons.js
 * Requires: npm install --save-dev sharp
 */

const sharp = require('sharp');
const path = require('path');

const INDIGO = '#4338ca';

// Looping checkmark path, designed in 1024x1024 coordinate space.
// Visually centered near (510, 490).
//
// Read the path as:
//   Start at left (220,530)
//   Smooth curve down to valley (410,660)
//   Smooth curve up through inflection
//   Long straight upstroke to (700,325)
//   Curves right into the loop top (775,288)
//   Loop curves down and left (820,355) → (790,410)
//   Loop closes back toward the stroke (720,400) → ends (704,348)
//
// Clean bold checkmark. Three points: left tip, valley, right tip.
// Stroke-only, round caps and joins — the weight and color do the work.
const CHECK_PATH = 'M 210,510 L 420,690 L 814,290';

const STROKE_WIDTH = 68;

// ── SVG builders ────────────────────────────────────────────────────────────

/** Full indigo circle with white loop mark. Used for icon.png and splash. */
function iconSvg() {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <circle cx="512" cy="512" r="512" fill="${INDIGO}"/>
  <path
    d="${CHECK_PATH}"
    stroke="white"
    stroke-width="${STROKE_WIDTH}"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
</svg>`;
}

/**
 * White loop mark on transparent background.
 * Android composites this over adaptiveIcon.backgroundColor (#4338ca).
 * Mark is centered and scaled to sit within the Android safe zone (66% of canvas).
 */
function adaptiveIconSvg() {
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <path
    d="${CHECK_PATH}"
    stroke="white"
    stroke-width="${STROKE_WIDTH}"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
</svg>`;
}

/**
 * Splash screen: square 1024×1024 canvas — just the icon, no text.
 *
 * Why square + no text:
 *   - resizeMode "contain" scales this to fill screen width, centered vertically.
 *     White backgroundColor in app.json fills the letterbox. Predictable on every
 *     screen size, never needs matching to device resolution.
 *   - No SVG text = no font rendering artifacts. Premium apps (WhatsApp, Instagram,
 *     Uber) use icon-only splash for exactly this reason.
 *   - The icon itself fills ~90% of the canvas so it appears large on screen.
 */
function splashSvg() {
  const SIZE = 1024;
  const cx = SIZE / 2;   // 512
  const cy = SIZE / 2;   // 512
  const r  = 460;        // 90% of half-width — fills almost the entire square

  const scale = (r * 2) / 1024;
  const tx = cx - 512 * scale;
  const ty = cy - 512 * scale;

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${INDIGO}"/>
  <g transform="translate(${tx},${ty}) scale(${scale})">
    <path
      d="${CHECK_PATH}"
      stroke="white"
      stroke-width="${STROKE_WIDTH / scale}"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </g>
</svg>`;
}

// ── Generate ─────────────────────────────────────────────────────────────────

async function generate() {
  const assets = path.join(__dirname, '..', 'assets');

  console.log('Generating icon.png (1024×1024)…');
  await sharp(Buffer.from(iconSvg()))
    .png()
    .toFile(path.join(assets, 'icon.png'));

  console.log('Generating adaptive-icon.png (1024×1024, transparent)…');
  await sharp(Buffer.from(adaptiveIconSvg()))
    .png()
    .toFile(path.join(assets, 'adaptive-icon.png'));

  console.log('Generating splash-icon.png (1024×1024)…');
  await sharp(Buffer.from(splashSvg()))
    .png()
    .toFile(path.join(assets, 'splash-icon.png'));

  console.log('Done. All assets written to assets/');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
