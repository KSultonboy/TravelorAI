import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { useAppTheme } from '../theme/app-theme';

type Variant = 'primary' | 'gold' | 'success' | 'warning' | 'error' | 'muted';

interface Props {
  label: string;
  variant?: Variant;
}

export default function Badge({ label, variant = 'primary' }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles();
  const configs: Record<Variant, { bg: string; text: string }> = {
    primary: { bg: colors.primaryPale, text: colors.primary },
    gold: { bg: colors.goldPale, text: colors.gold },
    success: { bg: colors.successPale, text: colors.success },
    warning: { bg: colors.warningPale, text: colors.warning },
    error: { bg: colors.errorPale, text: colors.error },
    muted: { bg: colors.borderLight, text: colors.textMuted },
  };
  const { bg, text } = configs[variant];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
    text: { fontFamily: FONTS.medium, fontSize: 11 },
  });
}
