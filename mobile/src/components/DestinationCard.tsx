import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { formatSum } from '../utils/formatter';
import { Destination } from '../constants/data';
import { type AppColors, useAppTheme } from '../theme/app-theme';

interface Props {
  item: Destination;
  onPress: () => void;
}

export default function DestinationCard({ item, onPress }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.imgWrap}>
        <Image source={{ uri: item.image }} style={styles.img} resizeMode="cover" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.categories?.[0] || 'travel'}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>⭐ {item.rating}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.region} numberOfLines={1}>{item.region}</Text>
        <Text style={styles.price}>{formatSum(item.budgetDaily)}/kun</Text>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      marginBottom: SPACING.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 4,
    },
    imgWrap: { position: 'relative', height: 154 },
    img: { width: '100%', height: '100%' },
    badge: {
      position: 'absolute',
      top: SPACING.sm,
      left: SPACING.sm,
      backgroundColor: colors.glassStrong,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
      borderRadius: RADIUS.sm,
    },
    badgeText: { fontFamily: FONTS.medium, fontSize: 10, color: colors.primary },
    ratingBadge: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      backgroundColor: colors.glassStrong,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
      borderRadius: RADIUS.sm,
    },
    ratingText: { fontFamily: FONTS.medium, fontSize: 11, color: colors.primary },
    info: { padding: SPACING.md },
    name: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text },
    region: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginVertical: 3 },
    price: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.primary },
  });
}
