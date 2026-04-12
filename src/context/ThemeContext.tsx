/**
 * Theme context — provides the active color palette to all screens.
 *
 * Priority: user manual override → system preference.
 * Override is stored in user_prefs as 'color_scheme' = 'light' | 'dark' | 'system'.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getPref, setPref } from '../lib/db';
import { ColorScheme, darkPalette, lightPalette } from '../constants/theme';

type Palette = typeof lightPalette;

interface ThemeContextValue {
  colors: Palette;
  colorScheme: ColorScheme;
  isDark: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightPalette,
  colorScheme: 'system',
  isDark: false,
  setColorScheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('system');

  useEffect(() => {
    const stored = getPref('color_scheme') as ColorScheme | null;
    if (stored) setColorSchemeState(stored);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    setPref('color_scheme', scheme);
  }, []);

  const isDark =
    colorScheme === 'dark' ||
    (colorScheme === 'system' && systemScheme === 'dark');

  const colors = isDark ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider value={{ colors, colorScheme, isDark, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
