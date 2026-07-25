import React, { useEffect, useState } from 'react';
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
import { useWishlist } from '../src/hooks/useWishlist';
import { type AuthUser } from '../src/utils/auth';
import { KEYS, getJSON } from '../src/utils/storage';

export default function WishlistScreen() {
  const { colors } = useStitchMobileStyles();
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getJSON<AuthUser>(KEYS.USER).then((user) => setUserId(user?.id ?? null));
  }, []);

  const { wishlist, remove } = useWishlist(userId);

  return (
    <StitchScrollScreen>
      <StitchHeader title={t('profile.wishlist')} subtitle="Saqlangan joylar" back />
      <StitchHero title="Keyingi boradigan joylaringiz" subtitle={`${wishlist.length} ta joy wishlist ichida saqlangan.`} />

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
            <StitchButton title="Turlarni ko‘rish" icon="briefcase-outline" onPress={() => router.push('/(tabs)' as any)} />
          </View>
        </StitchCard>
      ) : (
        <StitchCard>
          {wishlist.map((item) => (
            <View
              key={item.id}
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
              <TouchableOpacity onPress={() => remove(item.id)} activeOpacity={0.82}>
                <Ionicons name="heart-dislike-outline" size={21} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </StitchCard>
      )}

      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
