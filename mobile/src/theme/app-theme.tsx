import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import { getItem, KEYS, saveItem } from '../utils/storage';
import {
  getThemeColors,
  isThemePreference,
  type AppColors,
  type ResolvedTheme,
  type ThemePreference,
} from './palette';

interface AppThemeContextValue {
  colors: AppColors;
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  isDark: boolean;
  setPreference: (value: ThemePreference) => Promise<void>;
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const systemTheme: ResolvedTheme = colorScheme === 'dark' ? 'dark' : 'light';
  // Light-first brand: crisp white background by default until the user picks a preference.
  const [preference, setPreferenceState] = useState<ThemePreference>('light');

  useEffect(() => {
    let isMounted = true;

    getItem(KEYS.THEME_PREFERENCE)
      .then((savedValue) => {
        if (isMounted && isThemePreference(savedValue)) {
          setPreferenceState(savedValue);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedTheme = preference === 'system' ? systemTheme : preference;
  const colors = getThemeColors(resolvedTheme);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  const setPreference = async (value: ThemePreference) => {
    setPreferenceState(value);
    await saveItem(KEYS.THEME_PREFERENCE, value);
  };

  return (
    <AppThemeContext.Provider
      value={{
        colors,
        preference,
        resolvedTheme,
        systemTheme,
        isDark: resolvedTheme === 'dark',
        setPreference,
      }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }

  return context;
}

export function useThemedStyles<T>(factory: (colors: AppColors) => T): T {
  const { colors } = useAppTheme();
  return factory(colors);
}

export type { AppColors, ThemePreference, ResolvedTheme } from './palette';
