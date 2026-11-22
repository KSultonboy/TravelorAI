import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchHero,
  StitchScrollScreen,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';
import { tourIdFromWishlistItem, useWishlist } from '../src/hooks/useWishlist';

export default function WishlistScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const { wishlist, remove } = useWishlist();

  return (
    <StitchScrollScreen>
      <StitchHeader title={t('profile.wishlist')} subtitle={t('wishlist.subtitle')} back />
      <StitchHero title={t('wishlist.heroTitle')} subtitle={t('wishlist.count', { count: wishlist.length })} />

      {wishlist.length === 0 ? (
        <StitchCard>
          <View style={{ alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg }}>
            <View
              style={{
                width: 74,
                height: 74,
                borderRadius: 26,
                backgroundColor: colors.successPale,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="heart-outline" size={34} color={colors.success} />
            </View>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text }}>{t('profile.wishlistEmpty')}</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center' }}>
              {t('profile.wishlistHint')}
            </Text>
            <StitchButton title={t('home.browseTours')} icon="briefcase-outline" onPress={() => router.push('/home-tours' as any)} />
          </View>
        </StitchCard>
      ) : (
        <StitchCard>
          {wishlist.map((item) => {
            const tourId = tourIdFromWishlistItem(item);
            const open = tourId ? () => router.push({ pathname: '/tour-details', params: { id: tourId } } as any) : undefined;
            const Row = open ? TouchableOpacity : View;
            return (
              <Row
                key={item.id}
                onPress={open}
                activeOpacity={0.85}
                accessibilityRole={open ? 'button' : undefined}
                style={{
                  minHeight: 70,
                  borderRadius: 20,
                  backgroundColor: colors.cardMuted,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: SPACING.md,
                  gap: SPACING.md,
                }}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: colors.successPale,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.text }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{item.city}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => void remove(item.id)}
                  activeOpacity={0.82}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.wishlistRemove')}
                >
                  <Ionicons name="heart-dislike-outline" size={21} color={colors.error} />
                </TouchableOpacity>
              </Row>
            );
          })}
        </StitchCard>
      )}

      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
