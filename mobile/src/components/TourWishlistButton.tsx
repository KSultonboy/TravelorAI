import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { buildTourWishlistInput, tourWishlistSlug, useWishlist } from '../hooks/useWishlist';

interface Props {
  tour: { id: string; title: string; city?: string | null };
  /** "overlay" sits on top of a tour image; "plain" is for light headers. */
  variant?: 'overlay' | 'plain';
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function TourWishlistButton({ tour, variant = 'overlay', color, size = 18, style }: Props) {
  const { t } = useTranslation();
  const { isWishlisted, toggle } = useWishlist();
  const saved = isWishlisted(tourWishlistSlug(tour.id));
  const iconColor = saved ? '#E5484D' : color || (variant === 'overlay' ? '#FFFFFF' : '#64748B');

  return (
    <TouchableOpacity
      style={[variant === 'overlay' ? styles.overlay : styles.plain, style]}
      onPress={() => void toggle(buildTourWishlistInput(tour))}
      activeOpacity={0.8}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={saved ? t('a11y.wishlistRemove') : t('a11y.wishlistAdd')}
      accessibilityState={{ selected: saved }}
    >
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,15,28,0.42)',
  },
  plain: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
