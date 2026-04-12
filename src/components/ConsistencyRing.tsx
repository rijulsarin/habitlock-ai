import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ConsistencyRate } from '../types';

interface Props {
  rate: ConsistencyRate;
  size?: number;
}

/**
 * Displays consistency rate as a simple percentage arc + label.
 * Intentionally avoids streak language.
 */
export function ConsistencyRing({ rate, size = 64 }: Props) {
  const { colors } = useTheme();
  const percent = Math.round(rate.rate * 100);
  // Accent (indigo) at high consistency, muted indigo mid, gray when starting out
  const color = percent >= 70 ? colors.accent : percent >= 40 ? colors.accentMuted : colors.borderStrong;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}>
      <Text style={[styles.percent, { color, fontSize: size * 0.26 }]}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontWeight: '700',
  },
});
