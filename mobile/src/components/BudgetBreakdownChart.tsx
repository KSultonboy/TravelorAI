import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';
import { formatSum } from '../utils/formatter';

interface Breakdown {
  transport: number;
  accommodation: number;
  food: number;
  attractions: number;
  misc: number;
}

const SEGMENTS = [
  { key: 'transport' as keyof Breakdown, i18nKey: 'plannerResult.transport', fallback: 'Transport', icon: '🚆', color: '#3E9670', percent: 18 },
  { key: 'accommodation' as keyof Breakdown, i18nKey: 'plannerResult.accommodation', fallback: 'Accommodation', icon: '🏨', color: '#8EB69B', percent: 32 },
  { key: 'food' as keyof Breakdown, i18nKey: 'plannerResult.food', fallback: 'Food', icon: '🍽️', color: '#CBA869', percent: 27 },
  { key: 'attractions' as keyof Breakdown, i18nKey: 'plannerResult.attractions', fallback: 'Attractions', icon: '🏛️', color: '#5FC08A', percent: 18 },
  { key: 'misc' as keyof Breakdown, i18nKey: 'plannerResult.misc', fallback: 'Misc', icon: '💰', color: '#6E907E', percent: 5 },
];

export default function BudgetBreakdownChart({ breakdown, total }: { breakdown: Breakdown; total: number }) {
  const animations = useRef(SEGMENTS.map(() => new Animated.Value(0))).current;
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const breakdownTotal = Object.values(breakdown).reduce((sum, value) => sum + Number(value || 0), 0);
  const safeTotal = Number(total || 0) > 0 ? Number(total) : breakdownTotal;

  useEffect(() => {
    const anims = animations.map((anim, i) =>
      Animated.timing(anim, { toValue: 1, duration: 600, delay: i * 100, useNativeDriver: false })
    );
    Animated.stagger(80, anims).start();
  }, [animations]);

  return (
    <View>
      {SEGMENTS.map((seg, i) => {
        const amount = Number(breakdown[seg.key] || 0);
        const percent = safeTotal > 0 ? Math.round((amount / safeTotal) * 100) : 0;
        const barPercent = amount > 0 ? Math.max(percent, 4) : 0;
        const width = animations[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', `${barPercent}%`] });

        return (
          <View key={seg.key} style={styles.row}>
            <Text style={styles.icon}>{seg.icon}</Text>
            <View style={styles.info}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t(seg.i18nKey as any, { defaultValue: seg.fallback })}</Text>
                <Text style={styles.amount}>{formatSum(amount)}</Text>
              </View>
              <View style={styles.track}>
                <Animated.View style={[styles.bar, { width, backgroundColor: seg.color }]} />
              </View>
              <Text style={styles.pct}>{percent}%</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.total}>
        <Text style={styles.totalLabel}>{t('trips.totalSpent', { defaultValue: 'Total cost' })}</Text>
        <Text style={styles.totalAmount}>{formatSum(safeTotal)}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
    icon: { fontSize: 20, width: 32 },
    info: { flex: 1 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    label: { fontFamily: FONTS.medium, fontSize: 13, color: colors.text },
    amount: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.text },
    track: { height: 8, backgroundColor: colors.borderLight, borderRadius: RADIUS.full, overflow: 'hidden' },
    bar: { height: 8, borderRadius: RADIUS.full },
    pct: { fontFamily: FONTS.light, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    total: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: SPACING.md,
      marginTop: SPACING.sm,
    },
    totalLabel: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text },
    totalAmount: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.primary },
  });
}
