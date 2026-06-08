import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ImageBackground, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { extractApiData } from '../src/utils/auth';
import { homeAPI } from '../src/utils/api';
import { KEYS, getJSON, saveJSON } from '../src/utils/storage';
import {
  PLACE_FILTERS,
  buildPlaceParams,
  getPlaceTypeLabel,
  normalizePopularPlaces,
  type HomePlaceType,
  type PopularPlaceItem,
} from '../src/utils/homeContent';
import { StitchHeader } from '../src/components/stitch/StitchMobile';

export default function HomePlacesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [places, setPlaces] = useState<PopularPlaceItem[]>([]);
  const [filter, setFilter] = useState<HomePlaceType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadPlaces = useCallback(async () => {
    const cached = await getJSON<PopularPlaceItem[]>(KEYS.HOME_PLACES_CACHE_V2).catch(() => []);
    const cachedPlaces = normalizePopularPlaces(Array.isArray(cached) ? cached : []);
    if (cachedPlaces.length > 0) setPlaces(cachedPlaces);

    try {
      const payload = extractApiData<{ items?: PopularPlaceItem[] }>(await homeAPI.getPlaces({ limit: 100 }));
      const next = normalizePopularPlaces(payload?.items || []);
      setPlaces(next);
      await saveJSON(KEYS.HOME_PLACES_CACHE_V2, next);
    } catch {
      if (cachedPlaces.length === 0) setPlaces([]);
    }
  }, []);

  useEffect(() => {
    void loadPlaces();
  }, [loadPlaces]);

  const filtered = useMemo(
    () => (filter === 'all' ? places : places.filter((item) => item.type === filter)),
    [filter, places]
  );

  const refresh = async () => {
    setRefreshing(true);
    await loadPlaces();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.success]} tintColor={colors.success} />}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <StitchHeader title="Barcha joylar" subtitle="Yandex va TravelorAI ma’lumotlari" back />
            <Text style={styles.title}>Place katalog</Text>
            <Text style={styles.subtitle}>Filter tanlang va har bir joyning detail sahifasini oching.</Text>
            <FlatList
              horizontal
              data={PLACE_FILTERS}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => {
                const active = item.key === filter;
                return (
                  <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setFilter(item.key)} activeOpacity={0.84}>
                    <Ionicons name={item.icon} size={14} color={active ? colors.textInverse : colors.textSecondary} />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.88}
            onPress={() => router.push({ pathname: '/place/[slug]', params: buildPlaceParams(item) })}
          >
            <PlaceImage imageUrl={item.imageUrl || null} styles={styles} colors={colors}>
              <View style={styles.scrim} />
              <View style={styles.typePill}>
                <Text style={styles.typeText}>{getPlaceTypeLabel(item.type)}</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{item.city || 'Global'} · {item.rating ? item.rating.toFixed(1) : 'Yandex'}</Text>
              </View>
            </PlaceImage>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Bu filter uchun joy topilmadi.</Text>}
      />
    </View>
  );
}

function PlaceImage({
  imageUrl,
  children,
  styles,
  colors,
}: {
  imageUrl: string | null;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  if (imageUrl) {
    return (
      <ImageBackground source={{ uri: imageUrl }} style={styles.image} imageStyle={styles.imageRadius}>
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.image, styles.placeholder]}>
      <Ionicons name="image-outline" size={26} color={colors.textInverse} />
      {children}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, paddingBottom: 64, gap: SPACING.sm },
    headerWrap: { gap: SPACING.sm, marginBottom: SPACING.sm },
    title: { fontFamily: FONTS.display, fontSize: 30, color: colors.text },
    subtitle: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    filterRow: { gap: SPACING.sm, paddingVertical: SPACING.sm },
    filterChip: {
      height: 38,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textSecondary },
    filterTextActive: { color: colors.textInverse },
    column: { gap: SPACING.sm },
    card: {
      flex: 1,
      height: 208,
      borderRadius: 22,
      overflow: 'hidden',
      marginBottom: SPACING.sm,
      backgroundColor: colors.cardMuted,
    },
    image: { flex: 1, justifyContent: 'space-between', padding: SPACING.sm },
    imageRadius: { borderRadius: 22 },
    placeholder: { backgroundColor: colors.primary },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,15,28,0.36)' },
    typePill: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.86)',
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    typeText: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.text },
    cardCopy: { gap: 4 },
    name: { fontFamily: FONTS.display, fontSize: 16, lineHeight: 19, color: colors.textInverse },
    meta: { fontFamily: FONTS.regular, fontSize: 11, color: 'rgba(255,255,255,0.78)' },
    empty: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, padding: SPACING.lg },
  });
}
