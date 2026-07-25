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
 * DARK — default brand palette (matches travelorai.com website).
 * Deep green canvas + warm gold accent + white text.
 */
export const darkColors: AppColors = {
  primary: '#E8B43E',
  primaryLight: '#F2CB6E',
  primaryPale: '#16472F',
  primaryDark: '#CC9A1E',
  gold: '#E8B43E',
  goldPale: '#2A2412',
  surface: '#0D3527',
  background: '#06231A',
  backgroundAccent: '#0A2E22',
  card: '#0D3527',
  cardMuted: '#103C2C',
  tabBar: 'rgba(6,35,26,0.82)',
  border: '#1E4B39',
  borderLight: '#123A2B',
  text: '#F2FAF6',
  textSecondary: '#B4CEC0',
  textMuted: '#7B9A8A',
  textInverse: '#FFFFFF',
  success: '#37C46E',
  successPale: '#0E3526',
  warning: '#F2C14E',
  warningPale: '#2A2410',
  error: '#FF6B6B',
  errorPale: '#3A1414',
  info: '#E8B43E',
  infoPale: '#2A2412',
  shadow: '#000000',
  overlay: 'rgba(3,14,9,0.72)',
  glass: 'rgba(13,53,39,0.60)',
  glassStrong: 'rgba(13,53,39,0.85)',
  aiAccent: '#E8B43E',
  aiAccentPale: '#16472F',
  aiGlow: 'rgba(232,180,62,0.42)',
  sand: '#E8B43E',
  sandPale: '#2A2412',
  onGradient: '#0A2417',
  gradientPrimary: ['#F0C75E', '#D49A18'],
  gradientHero: ['#052017', '#0B3A26', '#0F5132'],
  blurTint: 'dark',
};

/**
 * LIGHT — Soft white base, green primary + gold accent (>=4.5:1 contrast).
 */
export const lightColors: AppColors = {
  primary: '#15803D',
  primaryLight: '#1FA85C',
  primaryPale: '#DCF3E6',
  primaryDark: '#0F6A31',
  gold: '#B5841C',
  goldPale: '#FBEBCF',
  surface: '#FFFFFF',
  background: '#F4FAF6',
  backgroundAccent: '#E8F3EC',
  card: '#FFFFFF',
  cardMuted: '#EEF6F0',
  tabBar: 'rgba(255,255,255,0.85)',
  border: '#D2E5D9',
  borderLight: '#E4F0E8',
  text: '#0A2417',
  textSecondary: '#3A5347',
  textMuted: '#6B8576',
  textInverse: '#FFFFFF',
  success: '#0E8F5B',
  successPale: '#DCF5E8',
  warning: '#B5791A',
  warningPale: '#FBEBCF',
  error: '#C73B3B',
  errorPale: '#FBE0E0',
  info: '#B5841C',
  infoPale: '#FBEFD2',
  shadow: '#0A2417',
  overlay: 'rgba(7,34,24,0.50)',
  glass: 'rgba(255,255,255,0.70)',
  glassStrong: 'rgba(255,255,255,0.90)',
  aiAccent: '#C9921C',
  aiAccentPale: '#FBEFD2',
  aiGlow: 'rgba(201,146,28,0.30)',
  sand: '#D6A24A',
  sandPale: '#FBEBCF',
  onGradient: '#0A2417',
  gradientPrimary: ['#EFC75E', '#D49A18'],
  gradientHero: ['#0F5132', '#1A6B3C', '#CBA12C'],
  blurTint: 'light',
};

export function getThemeColors(theme: ResolvedTheme): AppColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
