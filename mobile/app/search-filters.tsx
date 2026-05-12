import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  StitchBottomSpace,
  StitchButton,
  StitchCard,
  StitchHeader,
  StitchInput,
  StitchScrollScreen,
  StitchSectionTitle,
  useStitchMobileStyles,
} from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';

const filters = ['Restoranlar', 'Mehmonxonalar', 'Landmarklar', 'Transport', 'Oilaviy', 'Halal', 'Arzon'];

export default function SearchFiltersScreen() {
  const { colors } = useStitchMobileStyles();
  const [active, setActive] = useState<string[]>(['Landmarklar', 'Halal']);

  const toggle = (item: string) => {
    setActive((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  };

  return (
    <StitchScrollScreen>
      <StitchHeader title="Search Filters" subtitle="Natijalarni toraytirish" back />
      <StitchInput label="Qidiruv" icon="search-outline" placeholder="Shahar, joy yoki kategoriya" />

      <StitchSectionTitle title="Kategoriyalar" />
      <StitchCard>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {filters.map((item) => {
            const selected = active.includes(item);
            return (
              <TouchableOpacity
                key={item}
                style={{
                  minHeight: 40,
                  borderRadius: RADIUS.full,
                  paddingHorizontal: SPACING.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                  backgroundColor: selected ? colors.success : colors.cardMuted,
                }}
                onPress={() => toggle(item)}
                activeOpacity={0.84}
              >
                {selected ? <Ionicons name="checkmark" size={13} color={colors.textInverse} /> : null}
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: selected ? colors.textInverse : colors.textSecondary }}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </StitchCard>

      <StitchCard>
        <StitchSectionTitle title="Masofa" action="10 km" />
        <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
          <View style={{ width: '42%', height: '100%', borderRadius: 999, backgroundColor: colors.success }} />
        </View>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
          Yaqinlashgan sari yangi joylar yuklanadi, butun dunyo bir martada yuklanmaydi.
        </Text>
      </StitchCard>

      <StitchButton title="Natijalarni ko‘rish" icon="search" onPress={() => router.back()} />
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
