import { Redirect, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConsistencyRing } from '../../src/components/ConsistencyRing';
import { getAllHabits, getConsistencyRate, getLastCheckIn, insertCheckIn, getContextModel, getPref } from '../../src/lib/db';
import { generateIdentityNarrative } from '../../src/lib/patterns/identity';
import { useTheme } from '../../src/context/ThemeContext';
import { CheckIn, ConsistencyRate, ContextModel, Habit } from '../../src/types';
import { randomUUID } from 'expo-crypto';
import { getDailyQuote } from '../../src/constants/quotes';
import { Analytics } from '../../src/lib/monitoring';

interface HabitRow {
  habit: Habit;
  rate: ConsistencyRate;
  loggedToday: boolean;      // any check-in today (completed or missed)
  completedToday: boolean;   // specifically a completed check-in today
}

export default function HomeScreen() {
  // Onboarding gate — renders a Redirect before any home content, so no flash
  if (getPref('onboarding_complete') !== 'true') {
    return <Redirect href="/onboarding" />;
  }

  const { colors, colorScheme, setColorScheme } = useTheme();

  function cycleTheme() {
    if (colorScheme === 'light') setColorScheme('dark');
    else if (colorScheme === 'dark') setColorScheme('system');
    else setColorScheme('light');
  }

  const themeIcon = colorScheme === 'light' ? '☀️' : colorScheme === 'dark' ? '🌙' : '📱';
  const [rows, setRows] = useState<HabitRow[]>([]);
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);
  const [identityMinimum, setIdentityMinimum] = useState(false);
  const [contextModel, setContextModel] = useState<ContextModel | null>(null);
  const dailyQuote = getDailyQuote();

  const load = useCallback(() => {
    const habits = getAllHabits();
    const today = new Date().toDateString();
    const data: HabitRow[] = habits.map((habit) => {
      const rate = getConsistencyRate(habit.id);
      const last = getLastCheckIn(habit.id);
      const loggedToday = !!last && new Date(last.timestamp).toDateString() === today;
      const completedToday = loggedToday && last!.status === 'completed';
      return { habit, rate, loggedToday, completedToday };
    });
    setRows(data);
    setContextModel(getContextModel());
  }, []);

  useFocusEffect(load);

  async function handleCheckIn(habit: Habit, minimum = false) {
    const checkIn: CheckIn = {
      id: randomUUID(),
      habit_id: habit.id,
      timestamp: new Date().toISOString(),
      status: 'completed',
      notes: minimum ? 'minimum_version: true' : undefined,
    };
    insertCheckIn(checkIn);
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(habit.created_at).getTime()) / 86400000
    );
    Analytics.checkInCompleted({ isMinimumVersion: minimum, daysSinceCreation });
    load();

    try {
      const rate = getConsistencyRate(habit.id);
      const message = await generateIdentityNarrative(habit, rate, { minimumVersion: minimum });
      setIdentityMinimum(minimum);
      setIdentityMessage(message);
    } catch {
      // Identity narrative is non-critical — fail silently
    }
  }

  function handleMiss(habit: Habit) {
    Analytics.checkInMissed();
    router.push({ pathname: '/attribution/[id]', params: { id: habit.id } });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.habit.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Habits</Text>
                <Pressable
                  style={[styles.themeToggle, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  onPress={cycleTheme}
                >
                  <Text style={styles.themeToggleIcon}>{themeIcon}</Text>
                </Pressable>
              </View>
              <View style={styles.headerActions}>
                <Pressable style={[styles.weekBtn, { borderColor: colors.border }]} onPress={() => router.push('/summary')}>
                  <Text style={[styles.weekBtnText, { color: colors.textSecondary }]}>This week</Text>
                </Pressable>
                <Pressable
                  style={[styles.settingsBtn, { borderColor: colors.border }]}
                  onPress={() => router.push('/settings')}
                >
                  <Text style={[styles.settingsBtnText, { color: colors.textSecondary }]}>⚙</Text>
                </Pressable>
                <Pressable style={[styles.addBtn, { backgroundColor: colors.textPrimary }]} onPress={() => router.push('/intake')}>
                  <Text style={[styles.addBtnText, { color: colors.background }]}>+ New</Text>
                </Pressable>
              </View>
            </View>
            {contextModel && contextModel.mode !== 'baseline' && (
              <Pressable
                style={[styles.contextBanner, { backgroundColor: colors.amberLight, borderColor: colors.amber }]}
                onPress={() => router.push('/context')}
              >
                <View style={styles.contextBannerInner}>
                  <Text style={[styles.contextBannerTitle, { color: colors.amberDark }]}>
                    {contextModel.mode.replace(/_/g, ' ')} mode active
                  </Text>
                  <Text style={[styles.contextBannerSub, { color: colors.amberDark }]}>
                    Habits adapted · Tap to update →
                  </Text>
                </View>
              </Pressable>
            )}
            {rows.length > 0 && (
              <Pressable
                style={[styles.prepareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: '/mcii/[id]', params: { id: rows[0].habit.id } })}
              >
                <View style={styles.prepareInner}>
                  <Text style={[styles.prepareTitle, { color: colors.textPrimary }]}>Prepare for the week</Text>
                  <Text style={[styles.prepareSub, { color: colors.textTertiary }]}>Pre-plan your most likely obstacle →</Text>
                </View>
              </Pressable>
            )}
            <View style={[styles.quoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.quoteText, { color: colors.textSecondary }]}>{dailyQuote.text}</Text>
              {dailyQuote.attribution && (
                <Text style={[styles.quoteAttribution, { color: colors.textTertiary }]}>— {dailyQuote.attribution}</Text>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No habits yet.</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tap + New to design your first if-then plan.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => router.push({ pathname: '/habit/[id]', params: { id: item.habit.id } })}
          >
            <View style={styles.cardLeft}>
              <Text style={[styles.habitName, { color: colors.textPrimary }]}>{item.habit.name}</Text>
              {contextModel && contextModel.active_habit_adjustments[item.habit.id] ? (
                <>
                  <Text style={[styles.habitCueAdapted, { color: colors.amberDark }]} numberOfLines={1}>
                    {contextModel.active_habit_adjustments[item.habit.id].adjusted_cue}
                  </Text>
                  <Text style={[styles.adaptedBadge, { color: colors.amberDark }]}>adapted</Text>
                </>
              ) : (
                <Text style={[styles.habitCue, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.habit.cue}
                </Text>
              )}
              <Text style={[styles.rateLabel, { color: colors.textTertiary }]}>{item.rate.label}</Text>
            </View>

            <View style={styles.cardRight}>
              <ConsistencyRing rate={item.rate} size={56} />

              {!item.loggedToday && (
                <View style={styles.actionsCol}>
                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.doneBtn, { backgroundColor: colors.accent }]}
                      onPress={() => handleCheckIn(item.habit)}
                    >
                      <Text style={[styles.doneBtnText, { color: colors.background }]}>Done</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.missBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                      onPress={() => handleMiss(item.habit)}
                    >
                      <Text style={[styles.missBtnText, { color: colors.textSecondary }]}>Missed</Text>
                    </Pressable>
                  </View>
                  {item.habit.minimum_behavior && (
                    <Pressable
                      style={[styles.shortBtn, { borderColor: colors.border }]}
                      onPress={() => handleCheckIn(item.habit, true)}
                    >
                      <Text style={[styles.shortBtnText, { color: colors.textTertiary }]}>Short version</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {item.completedToday && (
                <Text style={[styles.checkedLabel, { color: colors.checkedText }]}>✓ Today</Text>
              )}
              {item.loggedToday && !item.completedToday && (
                <Text style={[styles.loggedLabel, { color: colors.textTertiary }]}>· Logged</Text>
              )}
            </View>
          </Pressable>
        )}
      />

      {/* Identity narrative overlay — Pattern 3 */}
      <Modal
        visible={!!identityMessage}
        transparent
        animationType="slide"
        onRequestClose={() => setIdentityMessage(null)}
      >
        <Pressable style={styles.overlay} onPress={() => { Analytics.identityNarrativeDismissed(identityMinimum); setIdentityMessage(null); }}>
          <View style={[
            styles.narrativeCard,
            { backgroundColor: identityMinimum ? colors.surface : colors.accentLight, borderTopColor: identityMinimum ? colors.border : colors.accent },
          ]}>
            <Text style={[styles.narrativeText, { color: colors.textPrimary }]}>{identityMessage}</Text>
            <Pressable
              style={[styles.narrativeDismiss, { backgroundColor: identityMinimum ? colors.textPrimary : colors.accent }]}
              onPress={() => { Analytics.identityNarrativeDismissed(identityMinimum); setIdentityMessage(null); }}
            >
              <Text style={[styles.narrativeDismissText, { color: colors.background }]}>Continue</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 16, gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: '700' },
  themeToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeToggleIcon: { fontSize: 16 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  weekBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  weekBtnText: { fontWeight: '500', fontSize: 14 },
  settingsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: { fontSize: 18 },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { fontWeight: '600', fontSize: 14 },
  contextBanner: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
  },
  contextBannerInner: { gap: 2 },
  contextBannerTitle: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  contextBannerSub: { fontSize: 12 },
  habitCueAdapted: { fontSize: 13, fontStyle: 'italic' },
  adaptedBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prepareCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
  },
  prepareInner: { gap: 2 },
  prepareTitle: { fontSize: 14, fontWeight: '600' },
  prepareSub: { fontSize: 12 },
  empty: { marginTop: 80, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 240 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  cardLeft: { flex: 1, gap: 4 },
  habitName: { fontSize: 16, fontWeight: '600' },
  habitCue: { fontSize: 13 },
  rateLabel: { fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: 'center', gap: 8 },
  actionsCol: { alignItems: 'center', gap: 6 },
  actionsRow: { flexDirection: 'row', gap: 6 },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  doneBtnText: { fontSize: 12, fontWeight: '600' },
  missBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  missBtnText: { fontSize: 12, fontWeight: '500' },
  shortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  shortBtnText: { fontSize: 11 },
  checkedLabel: { fontSize: 12, fontWeight: '600' },
  loggedLabel: { fontSize: 12 },
  quoteCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  quoteAttribution: {
    fontSize: 11,
  },
  // Identity narrative modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  narrativeCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    gap: 20,
    borderTopWidth: 3,
  },
  narrativeText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
  },
  narrativeDismiss: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  narrativeDismissText: { fontWeight: '600', fontSize: 15 },
});
