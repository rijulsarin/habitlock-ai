/**
 * Crash reporting (Sentry) + product analytics (PostHog).
 * All calls are fire-and-forget — never block the UI.
 *
 * Usage:
 *   import { Analytics } from '../lib/monitoring';
 *   Analytics.track('habit_created', { segment: 'striver' });
 */
import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';
import Constants from 'expo-constants';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
const posthogKey = Constants.expoConfig?.extra?.posthogApiKey as string | undefined;

// ─── Sentry ────────────────────────────────────────────────────────────────

export function initSentry() {
  if (!sentryDsn || sentryDsn === 'YOUR_SENTRY_DSN_HERE') return;
  Sentry.init({
    dsn: sentryDsn,
    // Only send events in production builds
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (__DEV__) {
    console.error('[Sentry capture]', error, context);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

// ─── PostHog ───────────────────────────────────────────────────────────────

let _posthog: PostHog | null = null;

export function initPostHog(): PostHog | null {
  if (!posthogKey || posthogKey === 'YOUR_POSTHOG_API_KEY_HERE') return null;
  _posthog = new PostHog(posthogKey, {
    host: 'https://us.i.posthog.com',
    // Flush every 20 events or 30s, whichever comes first
    flushAt: 20,
    flushInterval: 30000,
    // Respect user privacy — no automatic session recording
    captureScreenViews: false,
  });
  return _posthog;
}

// ─── Analytics facade ─────────────────────────────────────────────────────
// All event names and properties are defined here — one place to audit.

export const Analytics = {
  // ── Onboarding ────────────────────────────────────────────────────────
  onboardingStarted: () =>
    _posthog?.capture('onboarding_started'),

  onboardingCompleted: (segment: string) =>
    _posthog?.capture('onboarding_completed', { segment }),

  // ── Habit lifecycle ───────────────────────────────────────────────────
  habitCreated: (props: { segment: string; hasMinimumBehavior: boolean; hasCueTime: boolean }) =>
    _posthog?.capture('habit_created', props),

  habitEdited: () =>
    _posthog?.capture('habit_edited'),

  habitDeleted: () =>
    _posthog?.capture('habit_deleted'),

  // ── Check-ins ────────────────────────────────────────────────────────
  checkInCompleted: (props: { isMinimumVersion: boolean; daysSinceCreation: number }) =>
    _posthog?.capture('checkin_completed', props),

  checkInMissed: () =>
    _posthog?.capture('checkin_missed'),

  // ── Miss attribution ──────────────────────────────────────────────────
  attributionStarted: () =>
    _posthog?.capture('attribution_started'),

  attributionCompleted: (causeType: string) =>
    _posthog?.capture('attribution_completed', { cause_type: causeType }),

  attributionSkipped: () =>
    _posthog?.capture('attribution_skipped'),

  // ── MCII ──────────────────────────────────────────────────────────────
  mciiStarted: () =>
    _posthog?.capture('mcii_started'),

  mciiCompleted: () =>
    _posthog?.capture('mcii_completed'),

  // ── Context model ─────────────────────────────────────────────────────
  contextModeSet: (mode: string) =>
    _posthog?.capture('context_mode_set', { mode }),

  // ── Retention signals ─────────────────────────────────────────────────
  appOpened: (props: { daysSinceInstall: number; hasHabits: boolean }) =>
    _posthog?.capture('app_opened', props),

  // ── Settings ──────────────────────────────────────────────────────────
  notificationsToggled: (enabled: boolean) =>
    _posthog?.capture('notifications_toggled', { enabled }),

  segmentChanged: (segment: string) =>
    _posthog?.capture('segment_changed', { segment }),

  // ─── Identity narrative ───────────────────────────────────────────────
  identityNarrativeDismissed: (isMinimumVersion: boolean) =>
    _posthog?.capture('identity_narrative_dismissed', { minimum_version: isMinimumVersion }),

  // ─── Weekly summary ───────────────────────────────────────────────────
  weeklySummaryViewed: () =>
    _posthog?.capture('weekly_summary_viewed'),
};
