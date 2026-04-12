/**
 * Pattern 4: MCII Obstacle Anticipation screen.
 * Runs a Mental Contrasting with Implementation Intentions conversation
 * for a specific habit. Appends the resulting ObstaclePlan to the habit.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
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
import { getHabitById, updateHabitObstaclePlans } from '../../src/lib/db';
import {
  extractObstaclePlan,
  getMCIIOpener,
  isReadyToExtract,
  mciiTurn,
  stripExtractSignal,
} from '../../src/lib/patterns/mcii';
import { ChatMessage } from '../../src/types';

type Phase = 'chatting' | 'ready_to_save' | 'saving' | 'done';

export default function MCIIScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = getHabitById(id);

  const opener = habit ? getMCIIOpener(habit) : '';
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: opener },
  ]);
  const [readyMessages, setReadyMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('chatting');
  const listRef = useRef<FlatList>(null);

  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      listRef.current?.scrollToEnd({ animated: true });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (!habit) {
    return (
      <View style={styles.center}>
        <Text>Habit not found.</Text>
      </View>
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || phase !== 'chatting') return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const reply = await mciiTurn(updated, habit!);

      if (isReadyToExtract(reply)) {
        const visible = stripExtractSignal(reply);
        const withReply = [...updated, { role: 'assistant' as const, content: visible }];
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

  async function savePlan() {
    setPhase('saving');
    try {
      const plan = await extractObstaclePlan(readyMessages);
      const existing = habit!.obstacle_plans ?? [];
      updateHabitObstaclePlans(habit!.id, [...existing, plan]);
      setPhase('done');
    } catch {
      setPhase('ready_to_save');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong saving the plan. Try again.' },
      ]);
    }
  }

  if (phase === 'done') {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.doneContainer}>
          <Text style={[styles.doneTitle, { color: colors.textPrimary }]}>Obstacle plan saved.</Text>
          <Text style={[styles.doneBody, { color: colors.textSecondary }]}>
            You've pre-committed to a response for your most likely obstacle. That's the part most people skip.
          </Text>
          <Pressable style={[styles.doneBtn, { backgroundColor: colors.textPrimary }]} onPress={() => router.back()}>
            <Text style={[styles.doneBtnText, { color: colors.background }]}>Back to habit</Text>
          </Pressable>
        </View>
      </View>
    );
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
            <Pressable style={[styles.saveBtn, { backgroundColor: colors.textPrimary }]} onPress={savePlan}>
              <Text style={[styles.saveBtnText, { color: colors.background }]}>Save this obstacle plan</Text>
            </Pressable>
            <Pressable style={styles.continueBtn} onPress={() => setPhase('chatting')}>
              <Text style={[styles.continueBtnText, { color: colors.textTertiary }]}>Keep refining</Text>
            </Pressable>
          </View>
        )}

        {phase === 'saving' && (
          <View style={[styles.savingBanner, { backgroundColor: colors.textPrimary }]}>
            <ActivityIndicator size="small" color={colors.background} />
            <Text style={[styles.savingText, { color: colors.background }]}>Saving your obstacle plan…</Text>
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
  doneContainer: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 20,
  },
  doneTitle: { fontSize: 26, fontWeight: '700' },
  doneBody: { fontSize: 16, lineHeight: 24 },
  doneBtn: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  doneBtnText: { fontWeight: '600', fontSize: 16 },
});
