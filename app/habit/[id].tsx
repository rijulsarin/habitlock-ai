import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConsistencyRing } from '../../src/components/ConsistencyRing';
import { useTheme } from '../../src/context/ThemeContext';
import { deleteHabit, getConsistencyRate, getHabitById } from '../../src/lib/db';
import { cancelHabitNotifications } from '../../src/lib/notifications';
import { ConsistencyRate, Habit } from '../../src/types';

export default function HabitDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [rate, setRate] = useState<ConsistencyRate | null>(null);

  // Reload on focus so edits are reflected when navigating back
  useFocusEffect(
    useCallback(() => {
      const h = getHabitById(id);
      setHabit(h);
      setRate(h ? getConsistencyRate(id) : null);
    }, [id])
  );

  if (!habit || !rate) {
    return (
      <View style={styles.center}>
        <Text>Habit not found.</Text>
      </View>
    );
  }

  function handleDelete() {
    Alert.alert('Delete habit?', 'This will remove all check-in history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await cancelHabitNotifications(habit!);
          deleteHabit(habit!.id);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{habit.name}</Text>
          <ConsistencyRing rate={rate} size={72} />
        </View>

        <Text style={[styles.rateLabel, { color: colors.textTertiary }]}>{rate.label} · last 21 days</Text>

        <Section label="If-then plan" colors={colors}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>When</Text>
          <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{habit.cue}</Text>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Then</Text>
          <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{habit.behavior}</Text>
        </Section>

        <Section label="Identity" colors={colors}>
          <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>"{habit.identity_frame}"</Text>
        </Section>

        {habit.context_constraints.length > 0 && (
          <Section label="Context" colors={colors}>
            <View style={styles.tagRow}>
              {habit.context_constraints.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {habit.cue_time && (
          <Section label="Reminder" colors={colors}>
            <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>
              Daily at {habit.cue_time} · follow-up 90 min later
            </Text>
          </Section>
        )}

        {habit.obstacle_plans.length > 0 && (
          <Section label="Obstacle plans" colors={colors}>
            {habit.obstacle_plans.map((plan) => (
              <View key={plan.id} style={[styles.obstaclePlan, { backgroundColor: colors.surface, borderLeftColor: colors.borderStrong }]}>
                <Text style={[styles.obstacleLabel, { color: colors.textSecondary }]}>{plan.obstacle}</Text>
                <Text style={[styles.obstacleResponse, { color: colors.textPrimary }]}>{plan.if_then_response}</Text>
              </View>
            ))}
          </Section>
        )}

        <Pressable
          style={[styles.planBtn, { backgroundColor: colors.surfaceAlt }]}
          onPress={() => router.push({ pathname: '/mcii/[id]', params: { id: habit.id } })}
        >
          <Text style={[styles.planBtnText, { color: colors.textPrimary }]}>Plan for obstacles</Text>
        </Pressable>

        <Pressable
          style={[styles.editBtn, { backgroundColor: colors.surfaceAlt }]}
          onPress={() => router.push({ pathname: '/edit/[id]', params: { id: habit.id } })}
        >
          <Text style={[styles.editBtnText, { color: colors.textPrimary }]}>Edit habit</Text>
        </Pressable>

        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={[styles.deleteBtnText, { color: colors.danger }]}>Delete habit</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 26, fontWeight: '700', flex: 1, marginRight: 12 },
  rateLabel: { fontSize: 13, marginTop: -16 },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600' },
  fieldValue: { fontSize: 15, lineHeight: 22 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 12 },
  obstaclePlan: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderLeftWidth: 3,
  },
  obstacleLabel: { fontSize: 13, fontWeight: '600' },
  obstacleResponse: { fontSize: 14, lineHeight: 20 },
  planBtn: {
    marginTop: 8,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  planBtnText: { fontWeight: '600', fontSize: 15 },
  editBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  editBtnText: { fontWeight: '600', fontSize: 15 },
  deleteBtn: { padding: 14, alignItems: 'center' },
  deleteBtnText: { fontSize: 14 },
});
