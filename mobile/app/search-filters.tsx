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

const filters = [
  { label: 'Barchasi', value: 'all' },
  { label: 'Restoranlar', value: 'restaurant' },
  { label: 'Mehmonxonalar', value: 'hotel' },
  { label: 'Landmarklar', value: 'landmark' },
  { label: 'Transport', value: 'transport' },
] as const;
const distances = [5, 10, 20, 50];

export default function SearchFiltersScreen() {
  const { colors } = useStitchMobileStyles();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<(typeof filters)[number]['value']>('all');
  const [radius, setRadius] = useState(10);

  const applyFilters = () => {
    router.replace({
      pathname: '/(tabs)/explore',
      params: { q: query.trim(), category: active, radius: String(radius) },
    } as any);
  };

  return (
    <StitchScrollScreen>
      <StitchHeader title="Search Filters" subtitle="Natijalarni toraytirish" back />
      <StitchInput label="Qidiruv" icon="search-outline" placeholder="Shahar, joy yoki kategoriya" value={query} onChangeText={setQuery} />

      <StitchSectionTitle title="Kategoriyalar" />
      <StitchCard>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {filters.map((item) => {
            const selected = active === item.value;
            return (
              <TouchableOpacity
                key={item.value}
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
                onPress={() => setActive(item.value)}
                activeOpacity={0.84}
              >
                {selected ? <Ionicons name="checkmark" size={13} color={colors.textInverse} /> : null}
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: selected ? colors.textInverse : colors.textSecondary }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </StitchCard>

      <StitchCard>
        <StitchSectionTitle title="Masofa" action={`${radius} km`} />
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          {distances.map((distance) => (
            <TouchableOpacity
              key={distance}
              onPress={() => setRadius(distance)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: RADIUS.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: radius === distance ? colors.success : colors.cardMuted,
              }}
            >
              <Text style={{ fontFamily: FONTS.semibold, fontSize: 12, color: radius === distance ? colors.textInverse : colors.text }}>
                {distance} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
          Yaqinlashgan sari yangi joylar yuklanadi, butun dunyo bir martada yuklanmaydi.
        </Text>
      </StitchCard>

      <StitchButton title="Natijalarni ko‘rish" icon="search" onPress={applyFilters} />
      <StitchBottomSpace />
    </StitchScrollScreen>
  );
}
