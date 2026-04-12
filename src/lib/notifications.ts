import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getPref, setPref, updateHabitNotificationIds } from './db';
import { Habit } from '../types';
import { QUOTES } from '../constants/quotes';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  // Android: create notification channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('habits', {
      name: 'Habit reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('quotes', {
      name: 'Daily inspiration',
      importance: Notifications.AndroidImportance.LOW,
    });
  }

  return true;
}

/**
 * Schedule two daily notifications for a habit:
 *   1. Cue reminder — fires at cue_time ("HH:MM")
 *   2. Miss-check — fires 90 minutes later if user hasn't checked in
 *
 * Returns the scheduled notification IDs and saves them to the DB.
 */
export async function scheduleHabitNotifications(habit: Habit): Promise<void> {
  if (!habit.cue_time) return;

  const [hourStr, minStr] = habit.cue_time.split(':');
  const cueHour = parseInt(hourStr, 10);
  const cueMin = parseInt(minStr, 10);

  // Cancel any existing notifications for this habit first
  await cancelHabitNotifications(habit);

  // 1. Cue reminder — prompt to act, framed with identity
  const cueId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Time for ${habit.name}`,
      body: `${habit.identity_frame.charAt(0).toUpperCase() + habit.identity_frame.slice(1)} — your cue is now.`,
      data: { habitId: habit.id, type: 'cue_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: cueHour,
      minute: cueMin,
    },
  });

  // 2. Miss-check: 90 minutes after the cue — compassion-forward, not shame
  const totalMissMin = cueHour * 60 + cueMin + 90;
  const missHour = Math.floor(totalMissMin / 60) % 24;
  const missMin = totalMissMin % 60;

  const missId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${habit.name} — how did it go?`,
      body: 'Tap to log it. Took 30 seconds either way.',
      data: { habitId: habit.id, type: 'miss_check' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: missHour,
      minute: missMin,
    },
  });

  updateHabitNotificationIds(habit.id, cueId, missId);
}

export async function cancelHabitNotifications(habit: Habit): Promise<void> {
  if (habit.notification_cue_id) {
    await Notifications.cancelScheduledNotificationAsync(habit.notification_cue_id).catch(() => {});
  }
  if (habit.notification_miss_id) {
    await Notifications.cancelScheduledNotificationAsync(habit.notification_miss_id).catch(() => {});
  }
}

/**
 * Cancel the miss-check notification for today after a successful check-in.
 * The cue reminder still fires tomorrow.
 */
export async function cancelTodaysMissCheck(habit: Habit): Promise<void> {
  if (habit.notification_miss_id) {
    await Notifications.cancelScheduledNotificationAsync(habit.notification_miss_id).catch(() => {});
  }
}

/**
 * Schedule a weekly Sunday evening nudge to run the MCII obstacle planning session.
 * Fires every Sunday at 7pm. Cancels any previously scheduled nudge first.
 * Stores the notification ID in user_prefs so it can be cancelled later.
 */
export async function scheduleWeeklyMCIINudge(habitId: string): Promise<void> {
  // Cancel any existing nudge
  await cancelWeeklyMCIINudge();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Prepare for the week',
      body: 'Quick question before the week starts →',
      data: { type: 'mcii_nudge', habitId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday (1=Sunday in expo-notifications)
      hour: 19,
      minute: 0,
    },
  });

  setPref('mcii_nudge_id', id);
  setPref('mcii_nudge_habit_id', habitId);
}

/**
 * Cancel the weekly MCII nudge if one is scheduled.
 */
export async function cancelWeeklyMCIINudge(): Promise<void> {
  const id = getPref('mcii_nudge_id');
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    setPref('mcii_nudge_id', '');
  }
}

/**
 * Returns the correct quote for a given date, deterministic by day of year.
 */
function getQuoteForDate(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length].text;
}

/**
 * Schedule one-time 9am quote notifications for the next 7 days.
 * Each day gets the correct quote for that specific date.
 * Cancels ALL previously scheduled quote notifications first (by scanning, not
 * by stored ID) to prevent accumulation from multiple app opens.
 * Called on every app open.
 */
export async function scheduleQuoteNotifications(): Promise<void> {
  // Cancel all existing quote notifications by scanning — not by stored ID.
  // This is the only reliable way to prevent accumulation.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { type?: string })?.type === 'daily_quote')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );

  // Schedule one notification per day for the next 7 days at 9am.
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(9, 0, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'HabitLock AI',
        body: getQuoteForDate(date),
        data: { type: 'daily_quote' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: 'quotes',
      },
    });
  }
}

/**
 * Cancel all scheduled quote notifications.
 */
export async function cancelQuoteNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { type?: string })?.type === 'daily_quote')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}
