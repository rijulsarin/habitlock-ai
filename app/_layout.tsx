import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';
import { useEffect } from 'react';
import { initDB, getLastCheckIn, getPref } from '../src/lib/db';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { scheduleQuoteNotifications } from '../src/lib/notifications';
import { initSentry, initPostHog, Analytics } from '../src/lib/monitoring';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

// Hold the splash open until we've initialized the DB and decided the route.
SplashScreen.preventAutoHideAsync();

// Initialize DB synchronously at module load — before any component mounts.
initDB();

// Initialize crash reporting and analytics at module load.
initSentry();
initPostHog();

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="intake" options={{ title: 'New Habit', presentation: 'modal' }} />
        <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
        <Stack.Screen name="attribution/[id]" options={{ title: 'What happened?', presentation: 'modal' }} />
        <Stack.Screen name="set-time/[id]" options={{ title: 'Set a reminder', presentation: 'modal' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Edit habit' }} />
        <Stack.Screen name="mcii/[id]" options={{ title: 'Obstacle planning', presentation: 'modal' }} />
        <Stack.Screen name="summary" options={{ title: 'Weekly summary', presentation: 'modal' }} />
        <Stack.Screen name="context" options={{ title: 'My context', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

function RootLayoutInner() {
  useEffect(() => {
    async function prepare() {
      await SplashScreen.hideAsync();

      // Track app open with basic retention context
      const onboardingComplete = getPref('onboarding_complete') === 'true';
      const installDate = getPref('install_date');
      if (!installDate) {
        setPrefInstallDate();
      }
      const daysSinceInstall = installDate
        ? Math.floor((Date.now() - parseInt(installDate, 10)) / 86400000)
        : 0;

      Analytics.appOpened({
        daysSinceInstall,
        hasHabits: onboardingComplete,
      });

      // Reschedule daily quote notifications on every app open.
      const notificationsEnabled = getPref('notifications_enabled') !== 'false';
      if (notificationsEnabled && onboardingComplete) {
        scheduleQuoteNotifications().catch(() => {});
      }
    }

    prepare();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        habitId?: string;
        type?: string;
      };

      if (data.type === 'daily_quote') {
        router.push('/(tabs)');
        return;
      }

      if (!data.habitId) return;

      if (data.type === 'cue_reminder') {
        router.push('/(tabs)');
      } else if (data.type === 'miss_check') {
        const today = new Date().toDateString();
        const last = getLastCheckIn(data.habitId);
        const checkedInToday = !!last && new Date(last.timestamp).toDateString() === today;
        if (checkedInToday) {
          router.push('/(tabs)');
        } else {
          router.push({ pathname: '/attribution/[id]', params: { id: data.habitId } });
        }
      } else if (data.type === 'mcii_nudge') {
        router.push({ pathname: '/mcii/[id]', params: { id: data.habitId } });
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

// Store install date once on first launch for retention calculations
function setPrefInstallDate() {
  const { setPref } = require('../src/lib/db');
  setPref('install_date', String(Date.now()));
}

export default Sentry.wrap(function RootLayout() {
  return (
    <ErrorBoundary>
      <RootLayoutInner />
    </ErrorBoundary>
  );
});
