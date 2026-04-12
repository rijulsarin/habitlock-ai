/**
 * Weekly Summary screen.
 * Shows per-habit stats for the current week (Mon–today) plus a 21-day
 * consistency rate. An LLM-generated identity-framed reflection loads
 * asynchronously — the screen is fully readable without it.
 */
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConsistencyRing } from '../src/components/ConsistencyRing';
import { useTheme } from '../src/context/ThemeContext';
import {
  getAllHabits,
  getCheckInsThisWeek,
  getConsistencyRate,
  getPref,
} from '../src/lib/db';
import { generateWeeklySummary, WeekHabitStat } from '../src/lib/patterns/weekly';
import { ConsistencyRate, Habit, UserSegment } from '../src/types';

interface HabitSummaryRow {
  stat: WeekHabitStat;
  rate: ConsistencyRate;
}

function getWeekLabel(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(now)}`;
}

function expectedThisWeek(habit: Habit): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Days elapsed Mon–today (Mon=1, so Sun wraps to 7)
  const daysElapsed = dayOfWeek === 0 ? 7 : dayOfWeek;

  if (habit.target_frequency.per === 'day') {
    return daysElapsed;
  } else {
    // per week — scale to days elapsed
    return Math.round((daysElapsed / 7) * habit.target_frequency.times);
  }
}

export default function SummaryScreen() {
  const { colors } = useTheme();
  const [rows, setRows] = useState<HabitSummaryRow[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [totalExpected, setTotalExpected] = useState(0);

  useEffect(() => {
    const habits = getAllHabits();
    const data: HabitSummaryRow[] = habits.map((habit) => {
      const checkins = getCheckInsThisWeek(habit.id);
      const completionsThisWeek = checkins.filter((c) => c.status === 'completed').length;
      const missesThisWeek = checkins.filter((c) => c.status === 'missed').length;
      const exp = expectedThisWeek(habit);
      return {
        stat: { habit, completionsThisWeek, expectedThisWeek: exp, missesThisWeek },
        rate: getConsistencyRate(habit.id),
      };
    });
    setRows(data);

    const totC = data.reduce((s, r) => s + r.stat.completionsThisWeek, 0);
    const totE = data.reduce((s, r) => s + r.stat.expectedThisWeek, 0);
    setTotalCompletions(totC);
    setTotalExpected(totE);

    if (data.length > 0) {
      const segment = (getPref('segment') ?? 'striver') as UserSegment;
      setNarrativeLoading(true);
      generateWeeklySummary(data.map((r) => r.stat), segment)
        .then((text) => setNarrative(text))
        .catch(() => {}) // non-critical
        .finally(() => setNarrativeLoading(false));
    }
  }, []);

  const weekPct = totalExpected > 0
    ? Math.round((totalCompletions / totalExpected) * 100)
    : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.weekHeader}>
          <Text style={[styles.weekLabel, { color: colors.textTertiary }]}>{getWeekLabel()}</Text>
          <Text style={[styles.weekStat, { color: colors.textPrimary }]}>
            {totalCompletions} of {totalExpected} sessions
          </Text>
          <View style={[styles.weekBar, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.weekBarFill, { width: `${weekPct}%` as any, backgroundColor: colors.textPrimary }]} />
          </View>
        </View>

        {/* LLM narrative */}
        {(narrativeLoading || narrative) && (
          <View style={[styles.narrativeCard, { backgroundColor: colors.surface }]}>
            {narrativeLoading ? (
              <View style={styles.narrativeLoading}>
                <ActivityIndicator size="small" color={colors.textTertiary} />
                <Text style={[styles.narrativeLoadingText, { color: colors.textTertiary }]}>Reflecting on your week…</Text>
              </View>
            ) : (
              <Text style={[styles.narrativeText, { color: colors.textPrimary }]}>{narrative}</Text>
            )}
          </View>
        )}

        {/* Per-habit rows */}
        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No habits yet. Create one to see weekly summaries.</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>This week by habit</Text>
            {rows.map(({ stat, rate }) => (
              <View key={stat.habit.id} style={[styles.habitCard, { backgroundColor: colors.surface }]}>
                <View style={styles.habitCardLeft}>
                  <Text style={[styles.habitName, { color: colors.textPrimary }]}>{stat.habit.name}</Text>
                  <Text style={[styles.habitWeekStat, { color: colors.textSecondary }]}>
                    {stat.completionsThisWeek} of {stat.expectedThisWeek} this week
                    {stat.missesThisWeek > 0 ? ` · ${stat.missesThisWeek} missed` : ''}
                  </Text>
                  <Text style={[styles.habitRateLabel, { color: colors.textTertiary }]}>{rate.label} · 21 days</Text>
                </View>
                <ConsistencyRing rate={rate} size={52} />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable style={[styles.closeBtn, { backgroundColor: colors.textPrimary }]} onPress={() => router.back()}>
          <Text style={[styles.closeBtnText, { color: colors.background }]}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 20, paddingBottom: 8 },
  weekHeader: { gap: 6 },
  weekLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  weekStat: { fontSize: 28, fontWeight: '700' },
  weekBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weekBarFill: {
    height: 6,
    borderRadius: 3,
    minWidth: 0,
  },
  narrativeCard: {
    borderRadius: 16,
    padding: 18,
  },
  narrativeLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  narrativeLoadingText: { fontSize: 14 },
  narrativeText: { fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  habitCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  habitCardLeft: { flex: 1, gap: 3 },
  habitName: { fontSize: 15, fontWeight: '600' },
  habitWeekStat: { fontSize: 13 },
  habitRateLabel: { fontSize: 12 },
  empty: { marginTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  closeBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  closeBtnText: { fontWeight: '600', fontSize: 15 },
});
