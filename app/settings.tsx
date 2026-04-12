/**
 * Settings screen.
 * Accessible from the home screen header (⚙ button).
 *
 * Contains:
 * - Appearance (Light / Dark / System default)
 * - Segment selector — calibrates LLM tone
 * - Notifications master toggle
 * - App version
 */
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ColorScheme } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';
import { getAllHabits, getPref, setPref } from '../src/lib/db';
import { cancelWeeklyMCIINudge, cancelQuoteNotifications, requestNotificationPermission, scheduleWeeklyMCIINudge, scheduleQuoteNotifications } from '../src/lib/notifications';
import { Analytics } from '../src/lib/monitoring';
import { UserSegment } from '../src/types';

const THEME_OPTIONS: { value: ColorScheme; label: string; sub: string }[] = [
  { value: 'light', label: 'Light', sub: 'Always light' },
  { value: 'dark', label: 'Dark', sub: 'Always dark' },
  { value: 'system', label: 'System default', sub: 'Follows your phone' },
];

const SEGMENT_OPTIONS: { value: UserSegment; label: string; sub: string }[] = [
  { value: 'striver', label: 'I know what I want — I just struggle to make it stick.', sub: 'Motivated but inconsistent' },
  { value: 'restarter', label: "I've tried habit apps before and always end up quitting.", sub: 'History of starting and stopping' },
  { value: 'designer', label: "I want to understand why my habits work or don't.", sub: 'Systems-thinker' },
];

export default function SettingsScreen() {
  const { colors, colorScheme, setColorScheme } = useTheme();

  const [segment, setSegmentState] = useState<UserSegment>(
    (getPref('segment') as UserSegment) ?? 'striver'
  );
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(
    getPref('notifications_enabled') !== 'false'
  );

  function handleSegmentChange(s: UserSegment) {
    setSegmentState(s);
    setPref('segment', s);
    Analytics.segmentChanged(s);
  }

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications blocked',
          'Enable notifications for HabitLock AI in your phone settings to receive reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
      const habits = getAllHabits();
      if (habits.length > 0) {
        await scheduleWeeklyMCIINudge(habits[0].id);
      }
      await scheduleQuoteNotifications();
    } else {
      await cancelWeeklyMCIINudge();
      await cancelQuoteNotifications();
    }
    setNotificationsEnabledState(value);
    setPref('notifications_enabled', value ? 'true' : 'false');
    Analytics.notificationsToggled(value);
  }

  const version = Constants.expoConfig?.version ?? '—';
  const updateId = Updates.updateId ? Updates.updateId.slice(0, 8) : 'local build';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {THEME_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.optionRow,
                  i < THEME_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => setColorScheme(opt.value)}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
                  <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{opt.sub}</Text>
                </View>
                {colorScheme === opt.value && (
                  <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Who are you */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Tone calibration</Text>
          <Text style={[styles.sectionSub, { color: colors.textTertiary }]}>
            Adjusts how the app talks to you going forward.
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {SEGMENT_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.optionRow,
                  i < SEGMENT_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => handleSegmentChange(opt.value)}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
                  <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{opt.sub}</Text>
                </View>
                {segment === opt.value && (
                  <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Notifications</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.switchRow}>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>Enable reminders</Text>
                <Text style={[styles.optionSub, { color: colors.textTertiary }]}>
                  Cue reminders, miss check-ins, weekly prep nudge
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
                thumbColor={colors.background}
              />
            </View>
          </View>
        </View>

        {/* App info */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>About</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.optionRow}>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>Version</Text>
              <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{version}</Text>
            </View>
            <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>Update</Text>
              <Text style={[styles.optionSub, { color: colors.textTertiary }]}>{updateId}</Text>
            </View>
            <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>Built on</Text>
              <Text style={[styles.optionSub, { color: colors.textTertiary }]}>Behavioral science, not streaks</Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 28 },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },
  sectionSub: {
    fontSize: 12,
    paddingHorizontal: 4,
    marginTop: -4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15 },
  optionSub: { fontSize: 12 },
  checkmark: { fontSize: 16, fontWeight: '700' },
});
