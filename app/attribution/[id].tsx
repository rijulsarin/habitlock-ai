/**
 * Pattern 2: Miss Attribution Conversation
 * Opens when a user taps "Missed" on a habit.
 * Compassion-forward → cause classification → specific plan repair → apply to habit.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatBubble } from '../../src/components/ChatBubble';
import { useTheme } from '../../src/context/ThemeContext';
import { applyPlanRepair, getHabitById, insertCheckIn, markPlanRepairApplied, updateCheckInAttribution, updateHabitObstaclePlans } from '../../src/lib/db';
import {
  attributionTurn,
  buildAttributionOpener,
  extractAttribution,
  extractRepairPlan,
  extractSituationalObstaclePlan,
  isReadyToAttribute,
  stripAttributeSignal,
} from '../../src/lib/patterns/attribution';
import { ChatMessage, MissAttribution } from '../../src/types';
import { Analytics } from '../../src/lib/monitoring';

export default function AttributionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = getHabitById(id);

  const opener = habit ? buildAttributionOpener(habit) : 'What happened?';
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: opener },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attribution, setAttribution] = useState<MissAttribution | null>(null);
  const [applying, setApplying] = useState(false);
  const [checkInId] = useState(() => randomUUID());
  const listRef = useRef<FlatList>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      listRef.current?.scrollToEnd({ animated: true });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Record the miss as a CheckIn event immediately when screen mounts
  const missRecorded = useRef(false);
  if (!missRecorded.current && habit) {
    missRecorded.current = true;
    insertCheckIn({
      id: checkInId,
      habit_id: habit.id,
      timestamp: new Date().toISOString(),
      status: 'missed',
    });
    Analytics.attributionStarted();
  }

  if (!habit) {
    return (
      <View style={styles.center}>
        <Text>Habit not found.</Text>
      </View>
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || attribution) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const reply = await attributionTurn(updated, habit!);

      if (isReadyToAttribute(reply)) {
        const visibleReply = stripAttributeSignal(reply);
        const withReply = [...updated, { role: 'assistant' as const, content: visibleReply }];
        setMessages(withReply);

        const extracted = await extractAttribution(withReply, habit!);

        // Show the plan repair
        setMessages([
          ...withReply,
          {
            role: 'assistant',
            content: `Here's what I'd suggest adjusting:\n\n${extracted.plan_repair}`,
          },
        ]);
        setAttribution(extracted);

        // Update the existing check-in record with attribution data
        updateCheckInAttribution(checkInId, {
          cause_type: extracted.cause_type,
          user_report: extracted.user_report,
          plan_repair: extracted.plan_repair,
        });
        Analytics.attributionCompleted(extracted.cause_type);
      } else {
        setMessages([...updated, { role: 'assistant', content: reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Check your connection.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function acceptRepair() {
    if (!attribution) return;
    setApplying(true);
    try {
      const extAttribution = attribution as MissAttribution & {
        _is_situational?: boolean;
        _obstacle_trigger?: string | null;
      };

      if (extAttribution._is_situational) {
        // Situational miss (energy_state, context_shift, competing_priority):
        // Keep the original habit plan intact. Add an ObstaclePlan as a conditional fallback.
        const obstaclePlan = await extractSituationalObstaclePlan(
          attribution.plan_repair,
          extAttribution._obstacle_trigger ?? null
        );
        const existing = habit!.obstacle_plans ?? [];
        updateHabitObstaclePlans(habit!.id, [...existing, obstaclePlan]);
      } else {
        // Fundamental miss (wrong_cue, high_friction, forgotten):
        // The original plan itself is wrong — update the habit's cue/behavior.
        const repairPlan = await extractRepairPlan(habit!, attribution.plan_repair);
        if (repairPlan.new_cue || repairPlan.new_behavior) {
          applyPlanRepair(
            habit!.id,
            repairPlan.new_cue ?? habit!.cue,
            repairPlan.new_behavior ?? habit!.behavior
          );
        }
      }
      markPlanRepairApplied(checkInId);
    } catch {
      // Non-critical — still navigate away
    }
    router.replace('/(tabs)');
  }

  function skipRepair() {
    Analytics.attributionSkipped();
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0 }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {attribution ? (
          <View style={[styles.repairActions, { borderTopColor: colors.border }]}>
            <Pressable
              style={[styles.acceptBtn, { backgroundColor: colors.textPrimary }, applying && { backgroundColor: colors.textSecondary }]}
              onPress={acceptRepair}
              disabled={applying}
            >
              {applying ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={[styles.acceptBtnText, { color: colors.background }]}>
                  {(attribution as any)?._is_situational
                    ? 'Save as fallback plan for this situation'
                    : 'Sounds right — update my plan'}
                </Text>
              )}
            </Pressable>
            <Pressable style={styles.skipBtn} onPress={skipRepair} disabled={applying}>
              <Text style={[styles.skipBtnText, { color: colors.textTertiary }]}>Not quite, I'll keep it as is</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary }]}
              value={input}
              onChangeText={setInput}
              placeholder="Tell me what happened…"
              placeholderTextColor={colors.textTertiary}
              multiline
              editable={!loading}
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: colors.textPrimary }, (!input.trim() || loading) && { backgroundColor: colors.borderStrong }]}
              onPress={send}
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={[styles.sendBtnText, { color: colors.background }]}>↑</Text>
              )}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: 16, gap: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {},
  sendBtnText: { fontSize: 18, fontWeight: '600' },
  repairActions: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  acceptBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  acceptBtnDisabled: {},
  acceptBtnText: { fontWeight: '600', fontSize: 15 },
  skipBtn: {
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  skipBtnText: { fontSize: 14 },
});
