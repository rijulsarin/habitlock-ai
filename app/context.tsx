/**
 * Pattern 5: Context Mode screen.
 * User reports a life disruption → LLM generates adapted habit plans →
 * adjustments are stored in context_model and shown on the home screen.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/context/ThemeContext';
import {
  clearContextMode,
  getAllHabits,
  getContextModel,
  setContextMode,
  setHabitAdjustments,
} from '../src/lib/db';
import { generateContextAdjustments } from '../src/lib/patterns/context';
import { ContextMode, HabitAdjustment } from '../src/types';

const MODES: { mode: ContextMode; label: string; sub: string }[] = [
  {
    mode: 'travel',
    label: 'Traveling',
    sub: "I'm away from home — different environment, different schedule.",
  },
  {
    mode: 'high_stress',
    label: 'High-stress period',
    sub: "Work deadline, personal situation, or elevated anxiety. I need lighter versions.",
  },
  {
    mode: 'schedule_disrupted',
    label: 'Schedule disrupted',
    sub: "My usual timing is unpredictable — I can't rely on my normal cues.",
  },
  {
    mode: 'low_energy_period',
    label: 'Low energy',
    sub: "I'm ill, sleep-deprived, or in recovery. I need minimal-viable versions.",
  },
];

const DURATION_OPTIONS = [
  { label: 'Just today', days: 1 },
  { label: 'This week', days: 7 },
  { label: 'Two weeks', days: 14 },
  { label: "I'll update it manually", days: null },
];

type Phase = 'picking' | 'generating' | 'reviewing' | 'done';

interface AdjustmentRow {
  habitName: string;
  habitId: string;
  adjustment: HabitAdjustment;
}

export default function ContextScreen() {
  const { colors } = useTheme();
  const current = getContextModel();
  const isActive = current.mode !== 'baseline';

  const [selectedMode, setSelectedMode] = useState<ContextMode | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(7);
  const [phase, setPhase] = useState<Phase>('picking');
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentRow[]>([]);

  async function handleGenerate() {
    if (!selectedMode) return;
    setPhase('generating');

    const modeUntil = selectedDays !== null
      ? new Date(Date.now() + selectedDays * 86400000).toISOString()
      : null;

    // Save mode first so it persists even if LLM fails
    setContextMode(selectedMode, modeUntil);

    try {
      const habits = getAllHabits();
      const adjustments = await generateContextAdjustments(habits, selectedMode);
      setHabitAdjustments(adjustments);

      const rows: AdjustmentRow[] = habits
        .filter((h) => adjustments[h.id])
        .map((h) => ({
          habitId: h.id,
          habitName: h.name,
          adjustment: adjustments[h.id],
        }));

      setAdjustmentRows(rows);
      setPhase('reviewing');
    } catch {
      // Mode is already saved; just show done without adjustments
      setPhase('done');
    }
  }

  function handleClear() {
    clearContextMode();
    router.back();
  }

  if (phase === 'done' || (phase === 'reviewing' && adjustmentRows.length === 0)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.doneContainer}>
          <Text style={[styles.doneTitle, { color: colors.textPrimary }]}>Context updated.</Text>
          <Text style={[styles.doneBody, { color: colors.textSecondary }]}>
            Your habits will reflect this context until you return to baseline.
            {adjustmentRows.length === 0
              ? ' Your habits don\'t need adaptation for this context — they should work as-is.'
              : ''}
          </Text>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.textPrimary }]} onPress={() => router.back()}>
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>Back to habits</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'reviewing') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Adapted plans</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Here's how your habits can still happen in this context.
          </Text>

          {adjustmentRows.map((row) => (
            <View key={row.habitId} style={[styles.adjustmentCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.adjustmentHabit, { color: colors.textPrimary }]}>{row.habitName}</Text>
              <Text style={[styles.adjustmentNote, { color: colors.textSecondary }]}>{row.adjustment.note}</Text>
              <View style={styles.adjustmentPlan}>
                <Text style={[styles.adjustmentLabel, { color: colors.textTertiary }]}>IF</Text>
                <Text style={[styles.adjustmentValue, { color: colors.textPrimary }]}>{row.adjustment.adjusted_cue}</Text>
                <Text style={[styles.adjustmentLabel, { color: colors.textTertiary }]}>THEN</Text>
                <Text style={[styles.adjustmentValue, { color: colors.textPrimary }]}>{row.adjustment.adjusted_behavior}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable style={[styles.primaryBtn, { backgroundColor: colors.textPrimary }]} onPress={() => router.back()}>
            <Text style={[styles.primaryBtnText, { color: colors.background }]}>Use these plans</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'generating') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.doneContainer}>
          <ActivityIndicator size="large" color={colors.textPrimary} />
          <Text style={[styles.generatingText, { color: colors.textSecondary }]}>Adapting your habits for this context…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Phase: picking
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>What's your context?</Text>
        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
          Tell me what's changed and I'll adapt your habit plans to still work.
        </Text>

        {/* Active context banner */}
        {isActive && (
          <View style={[styles.activeBanner, { backgroundColor: colors.amberLight }]}>
            <Text style={[styles.activeBannerText, { color: colors.amberDark }]}>
              Currently in: <Text style={styles.activeBannerMode}>{current.mode.replace(/_/g, ' ')}</Text>
            </Text>
            <Pressable onPress={handleClear}>
              <Text style={[styles.clearLink, { color: colors.amberDark }]}>Back to baseline</Text>
            </Pressable>
          </View>
        )}

        {/* Mode selection */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Select your situation</Text>
        {MODES.map((m) => (
          <Pressable
            key={m.mode}
            style={[
              styles.optionCard,
              { borderColor: colors.border },
              selectedMode === m.mode && { borderColor: colors.textPrimary, backgroundColor: colors.surface },
            ]}
            onPress={() => setSelectedMode(m.mode)}
          >
            <Text style={[
              styles.optionLabel,
              { color: colors.textPrimary },
              selectedMode === m.mode && styles.optionLabelSelected,
            ]}>
              {m.label}
            </Text>
            <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{m.sub}</Text>
          </Pressable>
        ))}

        {/* Duration */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>How long?</Text>
        <View style={styles.durationRow}>
          {DURATION_OPTIONS.map((d) => (
            <Pressable
              key={d.label}
              style={[
                styles.durationChip,
                { borderColor: colors.border },
                selectedDays === d.days && { borderColor: colors.textPrimary, backgroundColor: colors.textPrimary },
              ]}
              onPress={() => setSelectedDays(d.days)}
            >
              <Text style={[
                styles.durationChipText,
                { color: colors.textSecondary },
                selectedDays === d.days && { color: colors.background, fontWeight: '600' },
              ]}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.textPrimary }, !selectedMode && { backgroundColor: colors.borderStrong }]}
          onPress={handleGenerate}
          disabled={!selectedMode}
        >
          <Text style={[styles.primaryBtnText, { color: colors.background }]}>Adapt my habits</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '700' },
  pageSubtitle: { fontSize: 15, lineHeight: 22 },
  activeBanner: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeBannerText: { fontSize: 14 },
  activeBannerMode: { fontWeight: '700' },
  clearLink: { fontSize: 13, textDecorationLine: 'underline' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  optionCardSelected: {},
  optionLabel: { fontSize: 15, fontWeight: '500' },
  optionLabelSelected: { fontWeight: '700' },
  optionSub: { fontSize: 13 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  durationChipSelected: {},
  durationChipText: { fontSize: 13 },
  durationChipTextSelected: {},
  footer: { padding: 16, borderTopWidth: 1 },
  primaryBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: {},
  primaryBtnText: { fontWeight: '600', fontSize: 16 },
  // Generating / done states
  doneContainer: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  doneTitle: { fontSize: 26, fontWeight: '700' },
  doneBody: { fontSize: 16, lineHeight: 24 },
  generatingText: { fontSize: 16, textAlign: 'center' },
  // Reviewing state
  adjustmentCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  adjustmentHabit: { fontSize: 16, fontWeight: '700' },
  adjustmentNote: { fontSize: 13, fontStyle: 'italic' },
  adjustmentPlan: { gap: 4 },
  adjustmentLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  adjustmentValue: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
});
