import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';

import { FONTS } from '../constants/fonts';
import { useAppTheme, type AppColors } from '../theme/app-theme';

type BrandAlign = 'left' | 'center' | 'right';

interface AnimatedBrandProps {
  size?: number;
  align?: BrandAlign;
  subtitle?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  showGlow?: boolean;
}

export default function AnimatedBrand({
  size = 30,
  align = 'center',
  subtitle,
  style,
  textStyle,
  showGlow = true,
}: AnimatedBrandProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, size, align), [colors, size, align]);
  const pulse = useRef(new Animated.Value(0)).current;
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -2, duration: 1800, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );

    pulseLoop.start();
    floatLoop.start();

    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [floatY, pulse]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.46] });

  return (
    <Animated.View style={[styles.wrap, style, { transform: [{ translateY: floatY }] }]}>
      {showGlow ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
        />
      ) : null}
      <Text style={[styles.brandText, textStyle]}>
        Travelor<Text style={styles.brandAccent}>AI</Text>
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

function createStyles(colors: AppColors, size: number, align: BrandAlign) {
  const textAlign: TextStyle['textAlign'] = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';

  return StyleSheet.create({
    wrap: {
      alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    glow: {
      position: 'absolute',
      width: size * 4.2,
      height: size * 1.9,
      borderRadius: size,
      backgroundColor: colors.primaryPale,
      top: -(size * 0.22),
    },
    brandText: {
      fontFamily: FONTS.display,
      fontSize: size,
      color: colors.text,
      textAlign,
      letterSpacing: 0.4,
    },
    brandAccent: {
      color: colors.primary,
      fontFamily: FONTS.display,
    },
    subtitle: {
      marginTop: 5,
      fontFamily: FONTS.regular,
      fontSize: Math.max(12, Math.round(size * 0.5)),
      color: colors.textSecondary,
      textAlign,
    },
  });
}
