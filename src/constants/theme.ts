/**
 * Design tokens for habitlock-ai.
 * One accent color (indigo), used sparingly: positive moments only.
 * Full light + dark palettes. Consumed via useTheme() hook — never hardcode colors.
 */

export type ColorScheme = 'light' | 'dark' | 'system';

interface Palette {
  // Backgrounds
  background: string;
  surface: string;      // cards, inputs
  surfaceAlt: string;   // slightly different card variant

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  // Borders
  border: string;
  borderStrong: string;

  // Accent — indigo, consistent across modes
  accent: string;
  accentLight: string;  // narrative card tint
  accentMuted: string;  // mid-progress ring

  // Semantic
  missBackground: string;
  missText: string;
  checkedText: string;

  // Context mode (amber)
  amber: string;
  amberLight: string;
  amberDark: string;

  // Danger
  danger: string;

  // Status bar style for expo-status-bar
  statusBar: 'light' | 'dark';
}

export const lightPalette: Palette = {
  background: '#ffffff',
  surface: '#f9fafb',
  surfaceAlt: '#f3f4f6',

  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',

  border: '#e5e7eb',
  borderStrong: '#d1d5db',

  accent: '#4338ca',
  accentLight: '#eef2ff',
  accentMuted: '#818cf8',

  missBackground: '#f3f4f6',
  missText: '#6b7280',
  checkedText: '#4338ca',

  amber: '#f59e0b',
  amberLight: '#fef3c7',
  amberDark: '#92400e',

  danger: '#ef4444',
  statusBar: 'dark',
};

export const darkPalette: Palette = {
  background: '#111111',
  surface: '#1e1e1e',
  surfaceAlt: '#2a2a2a',

  textPrimary: '#f9fafb',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',

  border: '#2e2e2e',
  borderStrong: '#3a3a3a',

  // Indigo is slightly brighter on dark to maintain contrast
  accent: '#6366f1',
  accentLight: '#1e1b4b',
  accentMuted: '#818cf8',

  missBackground: '#2a2a2a',
  missText: '#9ca3af',
  checkedText: '#818cf8',

  amber: '#f59e0b',
  amberLight: '#2d1f00',
  amberDark: '#fcd34d',

  danger: '#f87171',
  statusBar: 'light',
};

// Named alias kept for any file that imported COLORS directly
export const COLORS = lightPalette;
