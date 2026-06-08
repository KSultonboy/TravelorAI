import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { formatSum } from '../utils/formatter';
import { DayPlan } from '../utils/tripPlanner';
import { type AppColors, useAppTheme } from '../theme/app-theme';

export default function DayItineraryCard({ day }: { day: DayPlan }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const toggle = () => {
    Animated.spring(anim, { toValue: open ? 0 : 1, useNativeDriver: false, speed: 20 }).start();
    setOpen(!open);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={styles.header}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayNum}>{day.day}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.dest}>{day.destination}</Text>
          <Text style={styles.sub}>{day.activities.length} faoliyat • {day.hotel}</Text>
        </View>
        <Text style={styles.arrow}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {day.activities.map((act, i) => (
            <View key={i} style={styles.actRow}>
              <Text style={styles.actTime}>{act.time}</Text>
              <Text style={styles.actIcon}>{act.icon}</Text>
              <View style={styles.actInfo}>
                <Text style={styles.actName}>{act.name}</Text>
                {act.cost > 0 && <Text style={styles.actCost}>{formatSum(act.cost)}</Text>}
                {typeof act.confidenceScore === 'number' && (
                  <Text style={styles.actMeta}>
                    {Math.round(act.confidenceScore * 100)}% ishonch{act.source ? ` • ${act.source}` : ''}
                  </Text>
                )}
                {!!act.note && <Text style={styles.actMeta}>{act.note}</Text>}
              </View>
            </View>
          ))}
          <View style={styles.hotelRow}>
            <Text style={styles.hotelIcon}>🏨</Text>
            <Text style={styles.hotelName}>{day.hotel}</Text>
            <Text style={styles.hotelCost}>{formatSum(day.hotelCost)}/kecha</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: SPACING.md,
      overflow: 'hidden',
    },
    header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
    dayBadge: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    dayNum: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textInverse },
    headerInfo: { flex: 1 },
    dest: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    sub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    arrow: { fontSize: 12, color: colors.textMuted },
    body: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: colors.borderLight },
    actRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm },
    actTime: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted, width: 46 },
    actIcon: { fontSize: 16, width: 28 },
    actInfo: { flex: 1 },
    actName: { fontFamily: FONTS.regular, fontSize: 13, color: colors.text },
    actCost: { fontFamily: FONTS.medium, fontSize: 12, color: colors.primary, marginTop: 2 },
    actMeta: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
    hotelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      paddingTop: SPACING.sm,
      marginTop: SPACING.xs,
    },
    hotelIcon: { fontSize: 16, marginRight: SPACING.sm },
    hotelName: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: colors.text },
    hotelCost: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold },
  });
}
