/**
 * Responsive scale utilities.
 *
 * Design baseline: 390pt wide (iPhone 14 / most modern Androids in dp).
 * All values are density-independent — React Native's dp system already
 * handles screen density (ppi) differences automatically.
 *
 * Two functions:
 *   rs(size)  — responsive spacing: scales padding/margin/size values
 *               linearly with screen width, capped to avoid runaway sizes.
 *   fs(size)  — font scale: same as rs() but additionally respects the
 *               user's system accessibility font size setting via PixelRatio.
 *
 * Usage:
 *   import { rs, fs } from '../lib/scale';
 *   fontSize: fs(16)   // instead of fontSize: 16
 *   padding: rs(24)    // instead of padding: 24
 *
 * What this solves:
 *   - Budget Android phones at 360dp wide: content is slightly smaller
 *     but nothing clips or overflows unexpectedly.
 *   - Large phones at 430dp+: content is proportionally larger, not tiny.
 *   - Accessibility: users who set system font to Large or Huge are
 *     respected — fs() incorporates PixelRatio.getFontScale().
 *
 * What this does NOT solve:
 *   - Tablets (768dp+): not a current target, portrait-only app.
 *   - Dynamic window resizing: values computed once at module load.
 *     Fine for a phone app; would need useWindowDimensions() for tablets.
 */

import { Dimensions, PixelRatio } from 'react-native';

const BASELINE_WIDTH = 390;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scale factor relative to baseline, capped so nothing goes extreme
const widthScale = Math.min(SCREEN_WIDTH / BASELINE_WIDTH, 1.2);

/**
 * Responsive spacing — scales layout values (padding, margin, fixed sizes)
 * proportionally to screen width.
 */
export function rs(size: number): number {
  return Math.round(size * widthScale);
}

/**
 * Font scale — scales font sizes proportionally to screen width AND
 * respects the user's system accessibility font size setting.
 *
 * The accessibility multiplier is capped at 1.3 to prevent layout
 * breakage on very large system font settings — the app layout is not
 * designed for 2× system font sizes.
 */
export function fs(size: number): number {
  const accessibilityScale = Math.min(PixelRatio.getFontScale(), 1.3);
  return Math.round(size * widthScale * accessibilityScale);
}
