import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  StitchBottomSpace,
  StitchCard,
  StitchHeader,
  StitchListRow,
  StitchScrollScreen,
  StitchStatGrid,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { type AuthUser, getUserDisplayName, getUserInitials } from '../src/utils/auth';
import { getJSON, KEYS } from '../src/utils/storage';
import { FONTS } from '../src/constants/fonts';
import { SPACING } from '../src/constants/spacing';
import { useTrips } from '../src/hooks/useTrips';
import { useWishlist } from '../src/hooks/useWishlist';

export default function SideMenuScreen() {
  const { colors } = useStitchMobileStyles();
  const [user, setUser] = useState<AuthUser | null>(null);
  const { trips } = useTrips(user?.id || null);
  const { wishlist } = useWishlist(user?.id || null);

  useEffect(() => {
    getJSON<AuthUser>(KEYS.USER).then((saved) => setUser(saved)).catch(() => {});
  }, []);

  const name = user ? getUserDisplayName(user) : 'Aziz sayohatchi';
  const initials = user ? getUserInitials(user) : 'TA';

  return (
    <StitchScrollScreen>
      <StitchHeader title="Menu" subtitle="TravelorAI navigatsiyasi" back />

      <StitchCard style={{ paddingTop: SPACING.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: 26,
              backgroundColor: colors.success,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: colors.textInverse }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: colors.text }}>{name}</Text>
            <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
              {user?.email || 'Dunyo bo‘ylab aqlli sayohat'}
            </Text>
          </View>
        </View>
        <StitchStatGrid
          items={[
            { label: 'Rejalar', value: String(trips.length), icon: 'map-outline' },
            { label: 'Shaharlar', value: String(new Set(trips.flatMap((trip) => trip.destinations || [])).size), icon: 'location-outline' },
            { label: 'Saqlangan', value: String(wishlist.length), icon: 'heart-outline' },
          ]}
        />
      </StitchCard>

      <StitchCard>
        <StitchListRow icon="home-outline" title="Home" subtitle="Asosiy sahifa" onPress={() => router.replace('/(tabs)' as any)} />
        <StitchListRow icon="map-outline" title="Planner" subtitle="AI yoki qo‘lda marshrut tuzish" onPress={() => router.push('/(tabs)/planner' as any)} />
        <StitchListRow icon="compass-outline" title="Explore" subtitle="Yandex joylari va xarita" onPress={() => router.push('/(tabs)/explore' as any)} />
        <StitchListRow icon="heart-outline" title="Wishlist" subtitle="Saqlangan joylar" onPress={() => router.push('/wishlist' as any)} />
      </StitchCard>

      <StitchCard>
        <StitchListRow icon="person-outline" title="Profil" subtitle="Shaxsiy ma’lumotlar" onPress={() => router.push('/(tabs)/profile' as any)} />
        <StitchListRow icon="settings-outline" title="Sozlamalar" subtitle="Til, tema va bildirishnomalar" onPress={() => router.push('/settings' as any)} />
        <StitchListRow icon="gift-outline" title="Aksiyalar" subtitle="Kupon va maxsus takliflar" onPress={() => router.push('/promotions' as any)} />
        <StitchListRow icon="help-circle-outline" title="Yordam markazi" subtitle="Savollar va qo‘llab-quvvatlash" onPress={() => router.push('/help-center' as any)} />
      </StitchCard>

      <TouchableOpacity
        style={{
          minHeight: 54,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        }}
        onPress={() => router.back()}
        activeOpacity={0.84}
      >
        <Ionicons name="close" size={17} color={colors.textInverse} />
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.textInverse }}>Yopish</Text>
      </TouchableOpacity>

      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
