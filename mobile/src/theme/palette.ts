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
 * DARK — default brand palette: "Minimal Green".
 * #051F20 · #0B2B26 · #163832 · #235347 · #8EB69B · #DAF1DE
 * Deep forest backgrounds + sage accents + pale-mint text (nature feel).
 */
export const darkColors: AppColors = {
  primary: '#2F8A63',
  primaryLight: '#8EB69B',
  primaryPale: '#163832',
  primaryDark: '#235347',
  gold: '#CBA869',
  goldPale: '#2A2415',
  surface: '#0B2B26',
  background: '#051F20',
  backgroundAccent: '#0B2B26',
  card: '#0B2B26',
  cardMuted: '#163832',
  tabBar: 'rgba(5,31,32,0.82)',
  border: '#235347',
  borderLight: '#163832',
  text: '#DAF1DE',
  textSecondary: '#8EB69B',
  textMuted: '#6E907E',
  textInverse: '#FFFFFF',
  success: '#5FC08A',
  successPale: '#0E2E22',
  warning: '#E0B15E',
  warningPale: '#2A2410',
  error: '#E5736B',
  errorPale: '#3A1716',
  info: '#8EB69B',
  infoPale: '#163832',
  shadow: '#000000',
  overlay: 'rgba(3,16,16,0.72)',
  glass: 'rgba(11,43,38,0.60)',
  glassStrong: 'rgba(11,43,38,0.85)',
  aiAccent: '#8EB69B',
  aiAccentPale: '#163832',
  aiGlow: 'rgba(142,182,155,0.40)',
  sand: '#CBA869',
  sandPale: '#2A2415',
  onGradient: '#FFFFFF',
  gradientPrimary: ['#236B4E', '#3E9670'],
  gradientHero: ['#051F20', '#163832', '#3E9670'],
  blurTint: 'dark',
};

/**
 * LIGHT — Soft mint base from the Minimal Green family.
 * Deep forest primary/text on pale-mint surfaces (>=4.5:1 contrast).
 */
export const lightColors: AppColors = {
  primary: '#235347',
  primaryLight: '#2F8A63',
  primaryPale: '#DAF1DE',
  primaryDark: '#163832',
  gold: '#B5791A',
  goldPale: '#FBEBCF',
  surface: '#FFFFFF',
  background: '#F2F8F3',
  backgroundAccent: '#DAF1DE',
  card: '#FFFFFF',
  cardMuted: '#E7F2EA',
  tabBar: 'rgba(255,255,255,0.85)',
  border: '#CDE5D3',
  borderLight: '#E3EFE6',
  text: '#051F20',
  textSecondary: '#235347',
  textMuted: '#5E7E6C',
  textInverse: '#FFFFFF',
  success: '#1B7A4F',
  successPale: '#DCF1E6',
  warning: '#B5791A',
  warningPale: '#FBEBCF',
  error: '#C73B3B',
  errorPale: '#FBE0E0',
  info: '#235347',
  infoPale: '#DAF1DE',
  shadow: '#0B2620',
  overlay: 'rgba(5,31,32,0.50)',
  glass: 'rgba(255,255,255,0.70)',
  glassStrong: 'rgba(255,255,255,0.92)',
  aiAccent: '#2F8A63',
  aiAccentPale: '#DAF1DE',
  aiGlow: 'rgba(47,138,99,0.28)',
  sand: '#C98A2E',
  sandPale: '#FBEBCF',
  onGradient: '#FFFFFF',
  gradientPrimary: ['#235347', '#2F8A63'],
  gradientHero: ['#163832', '#235347', '#3E9670'],
  blurTint: 'light',
};

export function getThemeColors(theme: ResolvedTheme): AppColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
