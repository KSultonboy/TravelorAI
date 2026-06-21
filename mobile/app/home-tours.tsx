import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { StitchHeader } from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { extractApiData } from '../src/utils/auth';
import { homeAPI } from '../src/utils/api';
import { normalizeTours, type HomeTourItem } from '../src/utils/homeContent';

const PAGE_SIZE = 20;
type TourFilter = 'all' | 'Latest' | 'Popular';

export default function HomeToursScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [filter, setFilter] = useState<TourFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [tours, setTours] = useState<HomeTourItem[]>([]);
  const [loading, setLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadTours = useCallback(async () => {
    setLoading(true);
    try {
      const payload = extractApiData<{
        items?: HomeTourItem[];
        total?: number;
        page?: number;
        limit?: number;
      }>(
        await homeAPI.getTours({
          agencyOnly: true,
          limit: PAGE_SIZE,
          page,
          filter,
          q: query || undefined,
        })
      );
      const items = normalizeTours(payload?.items || []);
      setTours(items);
      setTotal(Number.isFinite(Number(payload?.total)) ? Number(payload?.total) : items.length);
    } finally {
      setLoading(false);
    }
  }, [filter, page, query]);

  useEffect(() => {
    void loadTours().catch(() => {
      setTours([]);
      setTotal(0);
      setLoading(false);
    });
  }, [loadTours]);

  const openTour = (item: HomeTourItem) => {
    router.push({
      pathname: '/tour-details',
      params: { tour: encodeURIComponent(JSON.stringify(item)) },
    } as any);
  };

  const applyFilter = (nextFilter: TourFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const applySearch = () => {
    setQuery(searchInput.trim());
    setPage(1);
  };

  const renderItem = ({ item }: { item: HomeTourItem }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openTour(item)}>
      <TourImage imageUrl={item.imageUrl || null} styles={styles} colors={colors}>
        <View style={styles.scrim} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      </TourImage>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.city} numberOfLines={1}>{item.city || 'Global'} · {item.duration || 'Tour'}</Text>
        <View style={styles.metaRow}>
          <View style={styles.rating}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.price} numberOfLines={1}>{item.price || 'So‘rovda'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <StitchHeader title="Travelora" subtitle="Tasdiqlangan tur katalogi" />
      <Text style={styles.pageTitle}>Barcha agency tourlari</Text>
      <Text style={styles.pageSub}>Filterlang, qidiring va kerakli tourni batafsil ko‘ring. Har sahifada 20 ta tour chiqadi.</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={applySearch}
          placeholder="Shahar, tour yoki mavzu..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={applySearch} activeOpacity={0.84}>
          <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'Latest', 'Popular'] as TourFilter[]).map((item) => {
          const active = item === filter;
          return (
            <TouchableOpacity key={item} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => applyFilter(item)} activeOpacity={0.84}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item === 'all' ? 'Barchasi' : item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.countText}>{total} ta tour topildi</Text>
    </View>
  );

  const renderFooter = () => {
    if (loading || totalPages <= 1) return <View style={styles.footerSpacer} />;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
          disabled={page <= 1}
          onPress={() => setPage((value) => Math.max(1, value - 1))}
          activeOpacity={0.84}
        >
          <Ionicons name="chevron-back" size={16} color={page <= 1 ? colors.textMuted : colors.text} />
          <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Oldingi</Text>
        </TouchableOpacity>
        <Text style={styles.pageNumber}>{page} / {totalPages}</Text>
        <TouchableOpacity
          style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
          disabled={page >= totalPages}
          onPress={() => setPage((value) => Math.min(totalPages, value + 1))}
          activeOpacity={0.84}
        >
          <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>Keyingi</Text>
          <Ionicons name="chevron-forward" size={16} color={page >= totalPages ? colors.textMuted : colors.text} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        key="agency-tour-grid"
        data={tours}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.empty}>Tourlar yuklanmoqda...</Text>
              </>
            ) : (
              <>
                <Ionicons name="briefcase-outline" size={26} color={colors.success} />
                <Text style={styles.emptyTitle}>Tour topilmadi</Text>
                <Text style={styles.empty}>Filter yoki qidiruvni o‘zgartirib ko‘ring.</Text>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

function TourImage({
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
      <Ionicons name="map-outline" size={24} color={colors.textInverse} />
      {children}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, paddingBottom: 92, gap: SPACING.md },
    headerWrap: { gap: SPACING.sm, marginBottom: SPACING.xs },
    pageTitle: { fontFamily: FONTS.display, fontSize: 30, color: colors.text },
    pageSub: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    searchRow: {
      minHeight: 52,
      borderRadius: RADIUS.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingLeft: SPACING.md,
      paddingRight: 6,
      marginTop: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      minHeight: 48,
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.text,
    },
    searchBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
    filterChip: {
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textSecondary },
    filterTextActive: { color: colors.textInverse },
    countText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    gridRow: { gap: SPACING.sm },
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: 22,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.09,
      shadowRadius: 18,
      elevation: 3,
      marginBottom: SPACING.sm,
    },
    image: { height: 118, padding: SPACING.sm },
    imageRadius: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    placeholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,15,28,0.28)' },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.24)',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5, color: colors.textInverse },
    body: { padding: SPACING.md, gap: 6 },
    title: { fontFamily: FONTS.display, fontSize: 15, lineHeight: 19, color: colors.text },
    city: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
    rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.text },
    price: { flex: 1, textAlign: 'right', fontFamily: FONTS.semibold, fontSize: 11, color: colors.success },
    emptyCard: {
      marginTop: SPACING.md,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 18, color: colors.text, textAlign: 'center' },
    empty: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
    pagination: {
      marginTop: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    pageBtn: {
      height: 42,
      minWidth: 104,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: SPACING.md,
    },
    pageBtnDisabled: { opacity: 0.45 },
    pageBtnText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.text },
    pageBtnTextDisabled: { color: colors.textMuted },
    pageNumber: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted },
    footerSpacer: { height: SPACING.lg },
  });
}
