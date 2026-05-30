export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type BlurTint = 'light' | 'dark';

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
  // --- AI / brand tokens ---
  aiAccent: string;
  aiAccentPale: string;
  aiGlow: string;
  sand: string;
  sandPale: string;
  onGradient: string;
  gradientPrimary: readonly [string, string];
  gradientHero: readonly [string, string, string];
  blurTint: BlurTint;
}

/**
 * DARK — default brand palette.
 * Deep Navy base + Sky Blue primary + Aqua Mint AI accent.
 */
export const darkColors: AppColors = {
  primary: '#2D9CDB',
  primaryLight: '#5BB4E5',
  primaryPale: '#11324A',
  primaryDark: '#1E7BB3',
  gold: '#F2D6A2',
  goldPale: '#2A2418',
  surface: '#0E2233',
  background: '#071827',
  backgroundAccent: '#0B2236',
  card: '#0E2233',
  cardMuted: '#13344B',
  tabBar: 'rgba(7,24,39,0.82)',
  border: '#1C3A52',
  borderLight: '#14293B',
  text: '#F7FAFC',
  textSecondary: '#B8C7D4',
  textMuted: '#7C93A4',
  textInverse: '#FFFFFF',
  success: '#3DD9A0',
  successPale: '#0C2E26',
  warning: '#F2C14E',
  warningPale: '#2A2410',
  error: '#FF6B6B',
  errorPale: '#3A1414',
  info: '#56E0D8',
  infoPale: '#0E3A3C',
  shadow: '#000000',
  overlay: 'rgba(4,12,20,0.70)',
  glass: 'rgba(14,34,51,0.60)',
  glassStrong: 'rgba(14,34,51,0.85)',
  aiAccent: '#56E0D8',
  aiAccentPale: '#0E3A3C',
  aiGlow: 'rgba(86,224,216,0.45)',
  sand: '#F2D6A2',
  sandPale: '#2A2418',
  onGradient: '#04121E',
  gradientPrimary: ['#2D9CDB', '#56E0D8'],
  gradientHero: ['#071827', '#0E3A5C', '#56E0D8'],
  blurTint: 'dark',
};

/**
 * LIGHT — Soft White base. Primary/accent deepened for >=4.5:1 contrast.
 */
export const lightColors: AppColors = {
  primary: '#1C86C9',
  primaryLight: '#2D9CDB',
  primaryPale: '#E3F1FA',
  primaryDark: '#15689E',
  gold: '#C98A2E',
  goldPale: '#FBEBCF',
  surface: '#FFFFFF',
  background: '#F7FAFC',
  backgroundAccent: '#EDF3F8',
  card: '#FFFFFF',
  cardMuted: '#F0F5F9',
  tabBar: 'rgba(255,255,255,0.85)',
  border: '#D5E2EC',
  borderLight: '#E7EEF4',
  text: '#0B1F30',
  textSecondary: '#3D5366',
  textMuted: '#6B8295',
  textInverse: '#FFFFFF',
  success: '#0E8F66',
  successPale: '#DCF5EC',
  warning: '#B5791A',
  warningPale: '#FBEBCF',
  error: '#C73B3B',
  errorPale: '#FBE0E0',
  info: '#1C86C9',
  infoPale: '#E3F1FA',
  shadow: '#0B2236',
  overlay: 'rgba(7,24,39,0.50)',
  glass: 'rgba(255,255,255,0.70)',
  glassStrong: 'rgba(255,255,255,0.90)',
  aiAccent: '#14B8AE',
  aiAccentPale: '#DDF5F2',
  aiGlow: 'rgba(20,184,174,0.32)',
  sand: '#E0A95A',
  sandPale: '#FBEBCF',
  onGradient: '#04121E',
  gradientPrimary: ['#2D9CDB', '#56E0D8'],
  gradientHero: ['#0E3A5C', '#2D9CDB', '#56E0D8'],
  blurTint: 'light',
};

export function getThemeColors(theme: ResolvedTheme): AppColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
