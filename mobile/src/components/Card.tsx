import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { RADIUS, SPACING } from '../constants/spacing';
import { cardShadow } from '../constants/effects';
import { type AppColors, useAppTheme } from '../theme/app-theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
}

export default function Card({ children, onPress, style, padding = SPACING.lg }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.card, { padding }, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.card, { padding }, style]}>{children}</View>;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderLight,
      ...cardShadow(colors),
    },
  });
}
