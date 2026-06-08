import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator, ViewStyle } from 'react-native';
import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const bg: Record<Variant, string> = {
    primary: colors.primary,
    secondary: colors.success,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.error,
  };
  const textColor: Record<Variant, string> = {
    primary: colors.textInverse,
    secondary: colors.textInverse,
    outline: colors.primary,
    ghost: colors.primary,
    danger: colors.textInverse,
  };
  const padding: Record<Size, number> = { sm: SPACING.sm, md: SPACING.md, lg: SPACING.lg };
  const fontSize: Record<Size, number> = { sm: 13, md: 15, lg: 17 };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={1}
      style={[
          styles.base,
          { backgroundColor: bg[variant], paddingVertical: padding[size], opacity: disabled ? 0.5 : 1 },
          variant === 'outline' && styles.outlineBorder,
          variant === 'primary' && styles.primaryShadow,
          style,
        ]}
      >
        {loading
          ? <ActivityIndicator color={textColor[variant]} size="small" />
          : <Text style={[styles.label, { color: textColor[variant], fontSize: fontSize[size] }]} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    base: { borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, alignItems: 'center', justifyContent: 'center' },
    primaryShadow: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 5,
    },
    outlineBorder: { borderWidth: 1, borderColor: colors.primary },
    label: { fontFamily: FONTS.medium, letterSpacing: 0.2 },
  });
}
