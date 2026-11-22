import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface State {
  error: Error | null;
}

/**
 * Root error boundary. Pure JS on purpose: it must keep working even when the
 * theme, i18n or navigation providers are the thing that crashed, so it uses
 * fixed colours and Uzbek copy only.
 */
export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.screen} accessibilityRole="alert">
        <Text style={styles.emoji}>🧭</Text>
        <Text style={styles.title}>Nimadir noto‘g‘ri ketdi</Text>
        <Text style={styles.body}>
          Ilovada kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring — muammo takrorlansa, ilovani yopib qayta oching.
        </Text>
        {__DEV__ ? <Text style={styles.devMessage}>{String(this.state.error?.message || this.state.error)}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={this.retry} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.buttonText}>Qayta urinish</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
    backgroundColor: '#06231A',
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 22, fontWeight: '700', color: '#F7FAFC', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21, color: 'rgba(247,250,252,0.8)', textAlign: 'center' },
  devMessage: { fontSize: 12, color: '#FCA5A5', textAlign: 'center' },
  button: {
    marginTop: 8,
    minHeight: 50,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#04140D' },
});
