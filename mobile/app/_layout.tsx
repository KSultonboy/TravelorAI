import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@react-navigation/native';
import {
  useFonts,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { I18nextProvider } from 'react-i18next';
import { getItem, KEYS } from '../src/utils/storage';
import { AppThemeProvider, useAppTheme } from '../src/theme/app-theme';
import TestModeBanner from '../src/components/TestModeBanner';
import i18n from '../src/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError || bootTimedOut) SplashScreen.hideAsync().catch(() => {});
  }, [bootTimedOut, fontError, fontsLoaded]);

  useEffect(() => {
    async function restoreSavedLanguage() {
      const savedLanguage = await getItem(KEYS.LANGUAGE);
      if (savedLanguage === 'uz' || savedLanguage === 'ru' || savedLanguage === 'en') {
        await i18n.changeLanguage(savedLanguage);
      }
    }

    restoreSavedLanguage().catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setBootTimedOut(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, []);

  if (!fontsLoaded && !fontError && !bootTimedOut) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </I18nextProvider>
  );
}

function RootNavigator() {
  const { colors, resolvedTheme } = useAppTheme();

  return (
    <ThemeProvider
      value={{
        dark: resolvedTheme === 'dark',
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.error,
        },
        fonts: {
          regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
          medium: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
          bold: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' },
          heavy: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' },
        },
      }}
    >
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.background} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="home-tours" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="tour-details" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="search-filters" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkout" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="payment-methods" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="bookings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="wishlist" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="register" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="verify-email" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="reset-password" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="profile-edit" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="side-menu" options={{ animation: 'slide_from_left' }} />
        <Stack.Screen name="language" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      <TestModeBanner />
    </ThemeProvider>
  );
}
