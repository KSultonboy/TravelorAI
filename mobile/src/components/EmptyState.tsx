import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import Button from './Button';
import { type AppColors, useAppTheme } from '../theme/app-theme';

interface Props {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon, title, description, ctaLabel, onCta }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      {ctaLabel && onCta && (
        <Button title={ctaLabel} onPress={onCta} style={styles.btn} />
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
    },
    icon: { fontSize: 36 },
    title: { fontFamily: FONTS.semibold, fontSize: 18, color: colors.text, marginBottom: SPACING.sm, textAlign: 'center' },
    desc: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: SPACING.xl,
    },
    btn: { marginTop: SPACING.xl },
  });
}
