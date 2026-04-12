import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Sentry will auto-capture this via the wrapper in app/_layout.tsx
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  async handleReload() {
    try {
      await Updates.reloadAsync();
    } catch {
      // If OTA reload fails (e.g. no update available), just reset state
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong.</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Tap below to restart.
        </Text>
        <Pressable style={styles.btn} onPress={() => this.handleReload()}>
          <Text style={styles.btnText}>Restart app</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111', textAlign: 'center' },
  body: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22 },
  btn: {
    marginTop: 8,
    backgroundColor: '#4338ca',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
