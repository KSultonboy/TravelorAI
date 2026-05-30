import { Platform, type ViewStyle } from 'react-native';
import type { AppColors } from '../theme/palette';

/**
 * Soft elevated card shadow. Neutral, used on surfaces/cards.
 */
export function cardShadow(colors: AppColors): ViewStyle {
  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.24,
    shadowRadius: 24,
    elevation: 6,
  };
}

/**
 * Aqua AI glow — for highlighted/AI elements (spark, active chips, AI cards).
 * Colored shadow gives the "glow" feel rather than a flat drop shadow.
 */
export function aiGlowShadow(colors: AppColors): ViewStyle {
  return {
    shadowColor: colors.aiAccent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  };
}

/**
 * Sky-blue glow — for primary gradient CTAs.
 */
export function primaryGlow(colors: AppColors): ViewStyle {
  return {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 8,
  };
}
