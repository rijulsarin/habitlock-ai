/**
 * Pattern 1: If-Then Intake Conversation
 * Conversational UI that produces a structured Habit via the LLM.
 */
import { router } from 'expo-router';
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
import { ChatBubble } from '../src/components/ChatBubble';
import { useTheme } from '../src/context/ThemeContext';
import { insertHabit, getPref, getAllHabits } from '../src/lib/db';
import { Analytics } from '../src/lib/monitoring';
import { scheduleWeeklyMCIINudge } from '../src/lib/notifications';
import {
  INTAKE_OPENER,
  extractHabit,
  intakeTurn,
  isReadyToExtract,
  stripExtractSignal,
} from '../src/lib/patterns/intake';
import { ChatMessage, UserSegment } from '../src/types';

const INITIAL_MESSAGES: ChatMessage[] = [
  { role: 'assistant', content: INTAKE_OPENER },
];

type Phase = 'chatting' | 'ready_to_save' | 'saving';

export default function IntakeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [readyMessages, setReadyMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('chatting');
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

  async function send() {
    const text = input.trim();
    if (!text || loading || phase !== 'chatting') return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const reply = await intakeTurn(updated);

      if (isReadyToExtract(reply)) {
        const visibleReply = stripExtractSignal(reply);
        const withReply = [...updated, { role: 'assistant' as const, content: visibleReply }];
        setMessages(withReply);
        setReadyMessages(withReply);
        setPhase('ready_to_save');
      } else {
        setMessages([...updated, { role: 'assistant', content: reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Check your connection and try again.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  async function saveHabit() {
    setPhase('saving');
    try {
      const storedSegment = getPref('segment') as UserSegment | null;
      const habit = await extractHabit(readyMessages, storedSegment ?? 'striver');
      insertHabit(habit);

      Analytics.habitCreated({
        segment: storedSegment ?? 'striver',
        hasMinimumBehavior: !!habit.minimum_behavior,
        hasCueTime: !!habit.cue_time,
      });

      // Schedule the weekly Sunday MCII nudge on the first habit saved
      const allHabits = getAllHabits();
      if (allHabits.length === 1) {
        scheduleWeeklyMCIINudge(habit.id).catch(() => {});
      }

      router.replace({ pathname: '/set-time/[id]', params: { id: habit.id } });
    } catch {
      setPhase('ready_to_save');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong saving your habit. Try again.' },
      ]);
    }
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

        {phase === 'chatting' && (
          <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary }]}
              value={input}
              onChangeText={setInput}
              placeholder="Type here…"
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

        {phase === 'ready_to_save' && (
          <View style={[styles.confirmRow, { borderTopColor: colors.border }]}>
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.textPrimary }]} onPress={saveHabit}>
              <Text style={[styles.saveBtnText, { color: colors.background }]}>Save my habit plan</Text>
            </Pressable>
            <Pressable style={styles.continueBtn} onPress={() => setPhase('chatting')}>
              <Text style={[styles.continueBtnText, { color: colors.textTertiary }]}>Keep refining</Text>
            </Pressable>
          </View>
        )}

        {phase === 'saving' && (
          <View style={[styles.savingBanner, { backgroundColor: colors.textPrimary }]}>
            <ActivityIndicator size="small" color={colors.background} />
            <Text style={[styles.savingText, { color: colors.background }]}>Building your habit plan…</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
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
  confirmRow: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  saveBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontWeight: '600', fontSize: 15 },
  continueBtn: {
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  continueBtnText: { fontSize: 14 },
  savingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
  },
  savingText: { fontSize: 14 },
});
