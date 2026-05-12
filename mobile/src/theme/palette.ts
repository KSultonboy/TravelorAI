export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface AppColors {
  primary: string;
  primaryLight: string;
  primaryPale: string;
  primaryDark: string;
  gold: string;
  goldPale: string;
  surface: string;
  background: string;
  backgroundAccent: string;
  card: string;
  cardMuted: string;
  tabBar: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  success: string;
  successPale: string;
  warning: string;
  warningPale: string;
  error: string;
  errorPale: string;
  info: string;
  infoPale: string;
  shadow: string;
  overlay: string;
  glass: string;
  glassStrong: string;
}

export const lightColors: AppColors = {
  primary: '#0F172A',
  primaryLight: '#334155',
  primaryPale: '#E8ECF6',
  primaryDark: '#020617',
  gold: '#C97718',
  goldPale: '#FCE8C8',
  surface: '#FFFFFF',
  background: '#FCF8FA',
  backgroundAccent: '#F0EDEF',
  card: '#FFFFFF',
  cardMuted: '#F6F3F5',
  tabBar: 'rgba(255,255,255,0.92)',
  border: '#C6C6CD',
  borderLight: '#E4E2E4',
  text: '#1B1B1D',
  textSecondary: '#45464D',
  textMuted: '#76777D',
  textInverse: '#FFFFFF',
  success: '#006C4A',
  successPale: '#DDF8EC',
  warning: '#C97718',
  warningPale: '#FCE8C8',
  error: '#BA1A1A',
  errorPale: '#FFDAD6',
  info: '#565E74',
  infoPale: '#E8ECF6',
  shadow: '#131B2E',
  overlay: 'rgba(15,23,42,0.58)',
  glass: 'rgba(255,255,255,0.72)',
  glassStrong: 'rgba(255,255,255,0.94)',
};

export const darkColors: AppColors = {
  primary: '#BEC6E0',
  primaryLight: '#DAE2FD',
  primaryPale: '#1F293B',
  primaryDark: '#F8FAFC',
  gold: '#DEC29A',
  goldPale: '#271901',
  surface: '#171A20',
  background: '#0B1018',
  backgroundAccent: '#131B2E',
  card: '#171A20',
  cardMuted: '#20242C',
  tabBar: 'rgba(18,22,30,0.92)',
  border: '#45464D',
  borderLight: '#303032',
  text: '#F3F0F2',
  textSecondary: '#C6C6CD',
  textMuted: '#8D8F98',
  textInverse: '#FFFFFF',
  success: '#68DBA9',
  successPale: '#002114',
  warning: '#DEC29A',
  warningPale: '#271901',
  error: '#FFB4AB',
  errorPale: '#93000A',
  info: '#BEC6E0',
  infoPale: '#1F293B',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.72)',
  glass: 'rgba(23,26,32,0.76)',
  glassStrong: 'rgba(23,26,32,0.94)',
};

export function getThemeColors(theme: ResolvedTheme): AppColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
