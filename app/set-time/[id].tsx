/**
 * Set cue time screen — shown after intake completes.
 * Asks the user what time their cue typically fires so we can schedule reminders.
 * Skippable — not all cues are time-anchored.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { getHabitById, updateHabitCueTime } from '../../src/lib/db';
import {
  requestNotificationPermission,
  scheduleHabitNotifications,
} from '../../src/lib/notifications';

export default function SetTimeScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [time, setTime] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  function formatTime(d: Date) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  }

  async function handleSetReminder() {
    setSaving(true);
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    const cueTime = `${hh}:${mm}`;

    updateHabitCueTime(id, cueTime);

    const granted = await requestNotificationPermission();
    if (granted) {
      const habit = getHabitById(id);
      if (habit) {
        habit.cue_time = cueTime;
        await scheduleHabitNotifications(habit);
      }
    }

    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>When does this cue usually happen?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We'll send a gentle reminder at this time each day — and a follow-up 90 minutes later
            if you haven't checked in.
          </Text>
        </View>

        <Pressable style={[styles.timeRow, { backgroundColor: colors.surfaceAlt }]} onPress={() => setShowPicker(true)}>
          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Reminder time</Text>
          <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{formatTime(time)}</Text>
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={time}
            mode="time"
            display="default"
            onChange={(_, selected) => {
              setShowPicker(false);
              if (selected) setTime(selected);
            }}
          />
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.setBtn, { backgroundColor: colors.textPrimary }, saving && { backgroundColor: colors.borderStrong }]}
            onPress={handleSetReminder}
            disabled={saving}
          >
            <Text style={[styles.setBtnText, { color: colors.background }]}>
              {saving ? 'Setting reminder…' : 'Set reminder'}
            </Text>
          </Pressable>

          <Pressable style={styles.skipBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={[styles.skipBtnText, { color: colors.textTertiary }]}>My cue isn't time-based — skip</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingVertical: 40 },
  top: { gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 15, lineHeight: 22 },
  timeRow: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: { fontSize: 15 },
  timeValue: { fontSize: 22, fontWeight: '700' },
  actions: { gap: 12 },
  setBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  setBtnDisabled: {},
  setBtnText: { fontWeight: '600', fontSize: 16 },
  skipBtn: { padding: 14, alignItems: 'center' },
  skipBtnText: { fontSize: 14 },
});
