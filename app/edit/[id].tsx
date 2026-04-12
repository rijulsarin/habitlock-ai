/**
 * Habit edit screen.
 * Allows editing name, cue, behavior, and cue time.
 * Reschedules notifications if cue_time changes.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { getHabitById, updateHabit } from '../../src/lib/db';
import {
  cancelHabitNotifications,
  requestNotificationPermission,
  scheduleHabitNotifications,
} from '../../src/lib/notifications';

export default function EditHabitScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = getHabitById(id);

  const [name, setName] = useState(habit?.name ?? '');
  const [cue, setCue] = useState(habit?.cue ?? '');
  const [behavior, setBehavior] = useState(habit?.behavior ?? '');
  const [hasCueTime, setHasCueTime] = useState(!!habit?.cue_time);
  const [showPicker, setShowPicker] = useState(false);
  const [cueTime, setCueTime] = useState(() => {
    const d = new Date();
    if (habit?.cue_time) {
      const [h, m] = habit.cue_time.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      d.setHours(8, 0, 0, 0);
    }
    return d;
  });
  const [saving, setSaving] = useState(false);

  function formatTime(d: Date) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  }

  if (!habit) {
    return (
      <View style={styles.center}>
        <Text>Habit not found.</Text>
      </View>
    );
  }

  async function save() {
    if (!habit) return;
    if (!name.trim() || !cue.trim() || !behavior.trim()) {
      Alert.alert('Missing fields', 'Name, cue, and behavior are all required.');
      return;
    }
    setSaving(true);

    const hh = String(cueTime.getHours()).padStart(2, '0');
    const mm = String(cueTime.getMinutes()).padStart(2, '0');
    const newCueTime = hasCueTime ? `${hh}:${mm}` : null;

    updateHabit(id, {
      name: name.trim(),
      cue: cue.trim(),
      behavior: behavior.trim(),
      cue_time: newCueTime,
    });

    const cueTimeChanged = newCueTime !== (habit.cue_time ?? null);
    if (cueTimeChanged) {
      await cancelHabitNotifications(habit);
      if (newCueTime) {
        const granted = await requestNotificationPermission();
        if (granted) {
          const updated = getHabitById(id);
          if (updated) await scheduleHabitNotifications(updated);
        }
      }
    }

    router.back();
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Habit name" colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="Morning meditation"
              placeholderTextColor={colors.textTertiary}
            />
          </Field>

          <Field label="When (your cue)" colors={colors}>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary }]}
              value={cue}
              onChangeText={setCue}
              placeholder="when I sit down with my morning coffee"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </Field>

          <Field label="Then (your behavior)" colors={colors}>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary }]}
              value={behavior}
              onChangeText={setBehavior}
              placeholder="I will open the meditation app for 10 minutes"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </Field>

          <Field label="Reminder time" colors={colors}>
            <Pressable
              style={styles.toggleRow}
              onPress={() => { setHasCueTime((v) => !v); setShowPicker(false); }}
            >
              <View style={[styles.toggle, { backgroundColor: colors.borderStrong }, hasCueTime && { backgroundColor: colors.textPrimary }]}>
                <View style={[styles.toggleThumb, { backgroundColor: colors.background }, hasCueTime && styles.toggleThumbOn]} />
              </View>
              <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>
                {hasCueTime ? 'Enabled' : 'No time-based reminder'}
              </Text>
            </Pressable>

            {hasCueTime && (
              <Pressable style={[styles.timeRow, { backgroundColor: colors.surfaceAlt }]} onPress={() => setShowPicker(true)}>
                <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.timeValue, { color: colors.textPrimary }]}>{formatTime(cueTime)}</Text>
              </Pressable>
            )}

            {showPicker && (
              <DateTimePicker
                value={cueTime}
                mode="time"
                display="default"
                onChange={(_, selected) => {
                  setShowPicker(false);
                  if (selected) setCueTime(selected);
                }}
              />
            )}
          </Field>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.textPrimary }, saving && { backgroundColor: colors.borderStrong }]}
            onPress={save}
            disabled={saving}
          >
            <Text style={[styles.saveBtnText, { color: colors.background }]}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 24 },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {},
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  toggleLabel: { fontSize: 15 },
  timeRow: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timeLabel: { fontSize: 14 },
  timeValue: { fontSize: 16, fontWeight: '600' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {},
  saveBtnText: { fontWeight: '600', fontSize: 16 },
});
