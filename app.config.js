// Dynamic config — reads sensitive values from environment variables at build time.
// Non-sensitive values (Sentry DSN, PostHog key) are fine to be public.
// LLM_SHARED_SECRET must be set as an EAS secret for production builds,
// and in .env.local for local development.

module.exports = {
  expo: {
    name: 'HabitLock AI',
    slug: 'habitlock-ai',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.rijulsarin.habitlockai',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4338ca',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-secure-store',
      '@react-native-community/datetimepicker',
      'expo-web-browser',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#4338ca',
          defaultChannel: 'habits',
        },
      ],
      [
        '@sentry/react-native',
        {
          organization: 'rijul-sarin',
          project: 'habitlock-ai',
        },
      ],
    ],
    extra: {
      llmProxyUrl: 'https://habitlock-ai.vercel.app/api/llm',
      // Read from env var — set via EAS secret or .env.local for local dev
      llmSharedSecret: process.env.LLM_SHARED_SECRET ?? '',
      sentryDsn: 'https://0fff322fa8e30affa7a655fe81183102@o4511208643756032.ingest.us.sentry.io/4511208645918720',
      posthogApiKey: 'phc_qi2yZdDWk8fESnMCPSgXVLJqkNfiqArthf7tRJzSVWxh',
      router: {},
      eas: {
        projectId: 'e2928370-7fe8-43e7-a5ee-ebef6201c95e',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    scheme: 'habitlock',
    owner: 'rijulsarin',
    updates: {
      url: 'https://u.expo.dev/e2928370-7fe8-43e7-a5ee-ebef6201c95e',
    },
  },
};
