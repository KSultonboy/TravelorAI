import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../constants/fonts';
import { CONTROL_HEIGHT, RADIUS, SPACING } from '../constants/spacing';
import { primaryGlow, aiGlowShadow } from '../constants/effects';
import { type AppColors, useAppTheme } from '../theme/app-theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'ai';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

const GRADIENT_VARIANTS: Variant[] = ['primary', 'ai'];

export default function Button({ title, onPress, variant = 'primary', size = 'md', loading, disabled, icon, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  const isGradient = GRADIENT_VARIANTS.includes(variant);

  const solidBg: Record<Variant, string> = {
    primary: 'transparent',
    ai: 'transparent',
    secondary: colors.success,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.error,
  };
  const textColor: Record<Variant, string> = {
    primary: colors.onGradient,
    ai: colors.onGradient,
    secondary: colors.textInverse,
    outline: colors.primary,
    ghost: colors.primary,
    danger: colors.textInverse,
  };

  const height: Record<Size, number> = { sm: CONTROL_HEIGHT.sm, md: CONTROL_HEIGHT.md, lg: CONTROL_HEIGHT.lg };
  const fontSize: Record<Size, number> = { sm: 13, md: 15, lg: 17 };
  const iconName = icon ?? (variant === 'ai' ? 'sparkles' : undefined);

  const content = loading ? (
    <ActivityIndicator color={textColor[variant]} size="small" />
  ) : (
    <View style={styles.row}>
      {iconName ? <Ionicons name={iconName} size={fontSize[size] + 2} color={textColor[variant]} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: textColor[variant], fontSize: fontSize[size] }]} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        style={[
          styles.base,
          { height: height[size], backgroundColor: solidBg[variant], opacity: disabled ? 0.5 : 1 },
          variant === 'outline' && styles.outlineBorder,
          variant === 'primary' && primaryGlow(colors),
          variant === 'ai' && aiGlowShadow(colors),
          style,
        ]}
      >
        {isGradient ? (
          <LinearGradient
            colors={colors.gradientPrimary as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientFill}
          >
            {content}
          </LinearGradient>
        ) : (
          content
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    base: {
      borderRadius: RADIUS.button,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    gradientFill: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
    icon: { marginRight: SPACING.sm },
    outlineBorder: { borderWidth: 1.5, borderColor: colors.primary },
    label: { fontFamily: FONTS.medium, letterSpacing: 0.2 },
  });
}
