/**
 * Onboarding flow — shown once on first launch.
 * Three pages:
 *   1. Welcome — what this app is and is not
 *   2. How it works — the three differentiating mechanics
 *   3. Segment question — one question to calibrate LLM tone
 *
 * Stores segment + onboarding_complete in user_prefs on finish.
 */
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ColorScheme } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { setPref } from '../../src/lib/db';
import { Analytics } from '../../src/lib/monitoring';
import { UserSegment } from '../../src/types';

const { width } = Dimensions.get('window');

const PAGES = ['welcome', 'how', 'segment'] as const;
type Page = typeof PAGES[number];

// ─── Page content ───────────────────────────────────────────────────────────

function WelcomePage() {
  const { colors } = useTheme();
  return (
    <View style={styles.page}>
      <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>HabitLock AI</Text>
      <Text style={[styles.headline, { color: colors.textPrimary }]}>Habits fail because of missing architecture, not missing motivation.</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Most apps track whether you did the habit. This one helps you design{' '}
        <Text style={[styles.bold, { color: colors.textPrimary }]}>when, where, and how</Text> — then helps you recover when life gets in the way.
      </Text>
      <View style={styles.pillRow}>
        <View style={[styles.pillNo, { backgroundColor: colors.surfaceAlt }]}><Text style={[styles.pillNoText, { color: colors.textSecondary }]}>No streaks</Text></View>
        <View style={[styles.pillNo, { backgroundColor: colors.surfaceAlt }]}><Text style={[styles.pillNoText, { color: colors.textSecondary }]}>No shame</Text></View>
        <View style={[styles.pillNo, { backgroundColor: colors.surfaceAlt }]}><Text style={[styles.pillNoText, { color: colors.textSecondary }]}>No badges</Text></View>
      </View>
    </View>
  );
}

function HowPage() {
  const { colors } = useTheme();
  return (
    <View style={styles.page}>
      <Text style={[styles.headline, { color: colors.textPrimary }]}>Three things no other app does.</Text>
      <View style={styles.featureList}>
        <Feature
          number="1"
          title="If-then design"
          body="You don't just name a habit — you build a specific plan: IF this cue happens, THEN I will do this. Research shows this doubles follow-through."
        />
        <Feature
          number="2"
          title="Miss = data, not failure"
          body="When you miss, the app asks what happened and adjusts your plan. A missed day is a signal, not a broken streak."
        />
        <Feature
          number="3"
          title="Consistency rate, not streak"
          body={"\"14 of the last 18 days\" is resilient. A streak resets to zero. One miss can't derail you here."}
        />
      </View>
    </View>
  );
}

interface SegmentPageProps {
  selected: UserSegment | null;
  onSelect: (s: UserSegment) => void;
}

function SegmentPage({ selected, onSelect }: SegmentPageProps) {
  const { colors } = useTheme();
  const options: { segment: UserSegment; label: string; sub: string }[] = [
    {
      segment: 'striver',
      label: 'I know what I want — I just struggle to make it stick.',
      sub: 'Motivated but inconsistent',
    },
    {
      segment: 'restarter',
      label: "I've tried habit apps before and always end up quitting.",
      sub: 'History of starting and stopping',
    },
    {
      segment: 'designer',
      label: "I want to understand why my habits work or don't.",
      sub: 'Systems-thinker',
    },
  ];

  return (
    <ScrollView
      style={styles.pageScroll}
      contentContainerStyle={styles.pageScrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <Text style={[styles.headline, { color: colors.textPrimary }]}>Which of these sounds most like you?</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>This helps calibrate how the app talks to you.</Text>
      <View style={styles.segmentList}>
        {options.map((o) => (
          <Pressable
            key={o.segment}
            style={[
              styles.segmentOption,
              { borderColor: colors.border },
              selected === o.segment && { borderColor: colors.textPrimary, backgroundColor: colors.surface },
            ]}
            onPress={() => onSelect(o.segment)}
          >
            <Text style={[
              styles.segmentLabel,
              { color: colors.textPrimary },
              selected === o.segment && styles.segmentLabelSelected,
            ]}>
              {o.label}
            </Text>
            <Text style={[
              styles.segmentSub,
              { color: colors.textTertiary },
              selected === o.segment && { color: colors.textSecondary },
            ]}>
              {o.sub}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function Feature({ number, title, body }: { number: string; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.feature}>
      <View style={[styles.featureNum, { backgroundColor: colors.textPrimary }]}>
        <Text style={[styles.featureNumText, { color: colors.background }]}>{number}</Text>
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.featureBody, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ColorScheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System default' },
];

export default function OnboardingScreen() {
  const { colors, colorScheme, setColorScheme } = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [segment, setSegment] = useState<UserSegment | null>(null);
  const listRef = useRef<FlatList>(null);

  function goNext() {
    if (pageIndex < PAGES.length - 1) {
      const next = pageIndex + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setPageIndex(next);
    } else {
      finish();
    }
  }

  function goBack() {
    if (pageIndex > 0) {
      const prev = pageIndex - 1;
      listRef.current?.scrollToIndex({ index: prev, animated: true });
      setPageIndex(prev);
    }
  }

  function finish() {
    const chosen = segment ?? 'striver';
    setPref('segment', chosen);
    setPref('onboarding_complete', 'true');
    Analytics.onboardingCompleted(chosen);
    router.replace('/intake');
  }

  const isLast = pageIndex === PAGES.length - 1;
  const canFinish = !isLast || segment !== null;

  const pages: Page[] = ['welcome', 'how', 'segment'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Back arrow — top-left, only visible after page 0 */}
      <View style={styles.topBar}>
        {pageIndex > 0 ? (
          <Pressable style={styles.backArrow} onPress={goBack} hitSlop={12}>
            <Text style={[styles.backArrowText, { color: colors.textPrimary }]}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.backArrow} />
        )}
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(p) => p}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setPageIndex(index);
        }}
        renderItem={({ item }) => {
          if (item === 'welcome') return <WelcomePage />;
          if (item === 'how') return <HowPage />;
          return <SegmentPage selected={segment} onSelect={setSegment} />;
        }}
      />

      {/* Dot indicators — outside footer so they never interfere with button layout */}
      <View style={styles.dots}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: colors.border }, i === pageIndex && { backgroundColor: colors.textPrimary, width: 18 }]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.nextBtn, { backgroundColor: colors.textPrimary }, !canFinish && { backgroundColor: colors.borderStrong }]}
          onPress={goNext}
          disabled={!canFinish}
        >
          <Text style={[styles.nextBtnText, { color: colors.background }]}>
            {isLast ? 'Get started' : 'Continue'}
          </Text>
        </Pressable>

        {/* Always reserve space — opacity prevents layout jumps when segment is selected */}
        <Pressable
          style={[styles.skipLink, { opacity: isLast && segment === null ? 1 : 0 }]}
          onPress={finish}
          disabled={!isLast || segment !== null}
          pointerEvents={isLast && segment === null ? 'auto' : 'none'}
        >
          <Text style={[styles.skipLinkText, { color: colors.textTertiary }]}>Skip — set this later</Text>
        </Pressable>

        {/* Appearance picker — always visible across all onboarding pages */}
        <View style={styles.themePicker}>
          <Text style={[styles.themePickerLabel, { color: colors.textTertiary }]}>Appearance</Text>
          <View style={[styles.themeSegment, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            {THEME_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.themeSegmentItem,
                  colorScheme === opt.value && { backgroundColor: colors.background },
                ]}
                onPress={() => setColorScheme(opt.value)}
              >
                <Text
                  style={[
                    styles.themeSegmentText,
                    { color: colorScheme === opt.value ? colors.textPrimary : colors.textTertiary },
                    colorScheme === opt.value && styles.themeSegmentTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  page: { width, flex: 1, paddingHorizontal: 28, paddingTop: 24, gap: 20 },
  pageScroll: { width, flex: 1 },
  pageScrollContent: { paddingHorizontal: 28, paddingTop: 24, gap: 20, paddingBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontSize: 26, fontWeight: '700', lineHeight: 34 },
  body: { fontSize: 16, lineHeight: 24 },
  bold: { fontWeight: '700' },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pillNo: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  pillNoText: { fontSize: 13, fontWeight: '500' },
  featureList: { gap: 20 },
  feature: { flexDirection: 'row', gap: 14 },
  featureNum: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  featureNumText: { fontWeight: '700', fontSize: 13 },
  featureText: { flex: 1, gap: 4 },
  featureTitle: { fontSize: 15, fontWeight: '700' },
  featureBody: { fontSize: 14, lineHeight: 20 },
  segmentList: { gap: 12 },
  segmentOption: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  segmentOptionSelected: {},
  segmentLabel: { fontSize: 15, lineHeight: 22 },
  segmentLabelSelected: { fontWeight: '600' },
  segmentSub: { fontSize: 12 },
  segmentSubSelected: {},
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 44,
  },
  backArrow: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrowText: { fontSize: 36, lineHeight: 44, fontWeight: '300' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  nextBtn: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  nextBtnText: { fontWeight: '600', fontSize: 16 },
  skipLink: { alignItems: 'center', padding: 8 },
  skipLinkText: { fontSize: 14 },
  themePicker: { gap: 6 },
  themePickerLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  themeSegment: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  themeSegmentItem: {
    flex: 1,
    borderRadius: 7,
    paddingVertical: 7,
    alignItems: 'center',
  },
  themeSegmentText: { fontSize: 13 },
  themeSegmentTextActive: { fontWeight: '600' },
});
