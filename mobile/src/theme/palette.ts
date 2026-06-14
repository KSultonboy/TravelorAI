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
 * DARK — optional theme. Deep forest base with clearly separated surfaces
 * (bg < surface < card) and a vivid emerald accent so it never reads muddy.
 */
export const darkColors: AppColors = {
  primary: '#12A974',
  primaryLight: '#34D399',
  primaryPale: '#123528',
  primaryDark: '#0B7D55',
  gold: '#E0B15E',
  goldPale: '#2A2410',
  surface: '#102A20',
  background: '#07150F',
  backgroundAccent: '#0C2017',
  card: '#102A20',
  cardMuted: '#18382A',
  tabBar: 'rgba(7,21,15,0.82)',
  border: '#25503B',
  borderLight: '#1B3D2C',
  text: '#ECFDF3',
  textSecondary: '#9DC6AE',
  textMuted: '#6E927E',
  textInverse: '#FFFFFF',
  success: '#34D399',
  successPale: '#0E2E22',
  warning: '#E0B15E',
  warningPale: '#2A2410',
  error: '#F87171',
  errorPale: '#3A1716',
  info: '#34D399',
  infoPale: '#123528',
  shadow: '#000000',
  overlay: 'rgba(3,12,8,0.72)',
  glass: 'rgba(16,42,32,0.60)',
  glassStrong: 'rgba(16,42,32,0.85)',
  aiAccent: '#34D399',
  aiAccentPale: '#123528',
  aiGlow: 'rgba(52,211,153,0.40)',
  sand: '#E0B15E',
  sandPale: '#2A2410',
  onGradient: '#06140D',
  gradientPrimary: ['#10A06D', '#34D399'],
  gradientHero: ['#07150F', '#123528', '#34D399'],
  blurTint: 'dark',
};

/**
 * LIGHT — DEFAULT theme. Crisp white surfaces + vivid emerald.
 * Pure-white cards over a faint mint background = clean, high-contrast, not muddy.
 */
export const lightColors: AppColors = {
  primary: '#059669',
  primaryLight: '#10B981',
  primaryPale: '#D1FAE5',
  primaryDark: '#047857',
  gold: '#C98A2E',
  goldPale: '#FBEBCF',
  surface: '#FFFFFF',
  background: '#F4FBF7',
  backgroundAccent: '#E7F6EE',
  card: '#FFFFFF',
  cardMuted: '#EAF4EE',
  tabBar: 'rgba(255,255,255,0.88)',
  border: '#DBEAE0',
  borderLight: '#EAF2EC',
  text: '#0B231A',
  textSecondary: '#3B5A4A',
  textMuted: '#54705F',
  textInverse: '#FFFFFF',
  success: '#059669',
  successPale: '#D1FAE5',
  warning: '#B5791A',
  warningPale: '#FBEBCF',
  error: '#DC2626',
  errorPale: '#FEE2E2',
  info: '#059669',
  infoPale: '#D1FAE5',
  shadow: '#0B2318',
  overlay: 'rgba(6,20,13,0.45)',
  glass: 'rgba(255,255,255,0.75)',
  glassStrong: 'rgba(255,255,255,0.92)',
  aiAccent: '#10B981',
  aiAccentPale: '#D1FAE5',
  aiGlow: 'rgba(16,185,129,0.28)',
  sand: '#E0A95A',
  sandPale: '#FBEBCF',
  onGradient: '#FFFFFF',
  gradientPrimary: ['#059669', '#10B981'],
  gradientHero: ['#047857', '#059669', '#10B981'],
  blurTint: 'light',
};

export function getThemeColors(theme: ResolvedTheme): AppColors {
  return theme === 'dark' ? darkColors : lightColors;
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}
