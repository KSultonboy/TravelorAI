import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { RADIUS, SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';

interface Props {
  children: React.ReactNode;
  intensity?: number;
  padding?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Frosted-glass panel for use over photos, maps, and gradient backgrounds.
 * Uses real blur (expo-blur) plus a tinted overlay for legibility.
 */
export default function GlassCard({ children, intensity = 40, padding = SPACING.lg, radius = RADIUS.card, style }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.shell, { borderRadius: radius }, style]}>
      <BlurView intensity={intensity} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <View style={[styles.tint, { borderRadius: radius }]} />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    shell: {
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.glassStrong,
    },
    tint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.glass,
    },
  });
}
