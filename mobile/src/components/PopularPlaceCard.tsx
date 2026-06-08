import React from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';

import { FONTS } from '../constants/fonts';
import { RADIUS, SPACING } from '../constants/spacing';
import { type AppColors, useAppTheme } from '../theme/app-theme';

interface PopularPlaceItem {
  id: string;
  name: string;
  city: string;
  type: string;
  icon: string;
  imageUrl?: string | null;
}

interface Props {
  item: PopularPlaceItem;
  onPress: () => void;
}

function getTypeLabel(type: string): string {
  const key = String(type || '').toLowerCase();
  if (key === 'landmark') return 'Tarixiy joy';
  if (key === 'restaurant') return 'Restoran';
  if (key === 'hotel') return 'Mehmonxona';
  if (key === 'transport') return 'Transport';
  return 'Joy';
}

export default function PopularPlaceCard({ item, onPress }: Props) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={styles.card}>
      <View style={styles.imageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.fallbackEmoji}>{item.icon || '📍'}</Text>
          </View>
        )}
        <View style={styles.scrim} />
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{getTypeLabel(item.type)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.city} numberOfLines={1}>
          {item.city}
        </Text>
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
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 4,
    },
    imageWrap: {
      height: 126,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageFallback: {
      flex: 1,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fallbackEmoji: {
      fontSize: 34,
    },
    typeBadge: {
      position: 'absolute',
      left: SPACING.sm,
      top: SPACING.sm,
      backgroundColor: colors.glassStrong,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
    },
    typeBadgeText: {
      color: colors.primary,
      fontFamily: FONTS.medium,
      fontSize: 10,
    },
    scrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15,23,42,0.10)',
    },
    body: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
    },
    name: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: colors.text,
      marginBottom: 2,
    },
    city: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
}
