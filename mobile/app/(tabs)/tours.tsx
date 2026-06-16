import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { homeAPI } from '../../src/utils/api';
import { extractApiData } from '../../src/utils/auth';
import { normalizeTours, type HomeTourItem } from '../../src/utils/homeContent';
import { getJSON, saveJSON } from '../../src/utils/storage';

const TOURS_CACHE_KEY = 'agency_tours_cache_v1';

// "Qayerga" dropdown — yo'nalishlar. match: tur matnida qidiriladigan kalit so'zlar.
const COUNTRY_OPTIONS: { key: string; label: string; match: string[] }[] = [
  { key: 'all', label: 'Barchasi', match: [] },
  { key: 'uae', label: 'BAA (Dubay)', match: ['baa', 'dubai', 'dubay', 'uae', 'emirat', 'abu dhabi', 'abu-dhabi'] },
  { key: 'turkey', label: 'Turkiya', match: ['turkiya', 'turkey', 'turk', 'antalya', 'istanbul', 'stambul', 'bodrum'] },
  { key: 'egypt', label: 'Misr', match: ['misr', 'egypt', 'sharm', 'hurghada'] },
  { key: 'saudi', label: 'Saudiya Arabistoni', match: ['saudiya', 'saudi', 'makka', 'madina', 'umra', 'umrah', 'hajj', 'haj'] },
  { key: 'thailand', label: 'Tailand', match: ['tailand', 'thailand', 'phuket', 'bangkok', 'pattaya'] },
  { key: 'maldives', label: 'Maldiv orollari', match: ['maldiv', 'maldive'] },
  { key: 'georgia', label: 'Gruziya', match: ['gruziya', 'georgia', 'batumi', 'tbilisi'] },
  { key: 'malaysia', label: 'Malayziya', match: ['malayziya', 'malaysia', 'kuala'] },
  { key: 'indonesia', label: 'Indoneziya (Bali)', match: ['indoneziya', 'indonesia', 'bali', 'jakarta'] },
  { key: 'qatar', label: 'Qatar', match: ['qatar', 'doha'] },
  { key: 'azerbaijan', label: 'Ozarbayjon', match: ['ozarbayjon', 'azerbaijan', 'baku', 'boku'] },
  { key: 'europe', label: 'Yevropa', match: ['yevropa', 'europe', 'parij', 'paris', 'rim', 'rome', 'london', 'barcelona', 'praga'] },
];

export default function ToursScreen() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 22);
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [tours, setTours] = useState<HomeTourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedKey, setSelectedKey] = useState('all'); // dropdown'da tanlangan
  const [appliedKey, setAppliedKey] = useState('all'); // "Qidirish" bosilgach qo'llangan
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedLabel = COUNTRY_OPTIONS.find((o) => o.key === selectedKey)?.label || 'Barchasi';

  const filteredTours = useMemo(() => {
    const opt = COUNTRY_OPTIONS.find((o) => o.key === appliedKey);
    if (!opt || opt.key === 'all' || opt.match.length === 0) return tours;
    return tours.filter((t) => {
      const hay = `${t.title} ${t.city} ${t.destinationCountry || ''} ${t.subtitle || ''}`.toLowerCase();
      return opt.match.some((m) => hay.includes(m));
    });
  }, [tours, appliedKey]);

  // Keshdan darrov ko'rsatamiz — birinchi yuklash sekin/uzilsa ham bo'sh qotmaydi.
  useEffect(() => {
    let active = true;
    getJSON<HomeTourItem[]>(TOURS_CACHE_KEY)
      .then((cached) => {
        if (active && Array.isArray(cached) && cached.length > 0) {
          setTours(cached);
          setLoading(false);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadTours = useCallback(async () => {
    try {
      const payload = extractApiData<{ items?: HomeTourItem[] }>(
        await homeAPI.getTours({ agencyOnly: true, limit: 24, page: 1 })
      );
      const items = normalizeTours(payload?.items || []);
      // Bo'sh javob kelsa keshdagi mavjud ro'yxatni o'chirmaymiz (xato/uzilishdan himoya).
      if (items.length > 0) {
        setTours(items);
        await saveJSON(TOURS_CACHE_KEY, items);
      } else {
        setTours((prev) => prev);
      }
    } catch {
      // tarmoq xatosi — keshdagi narsani saqlab qolamiz
    } finally {
      setLoading(false);
    }
  }, []);

  // Har safar tab ochilganda yangilab turadi (mount'da bir marta emas).
  useFocusEffect(
    useCallback(() => {
      void loadTours();
    }, [loadTours])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTours();
    setRefreshing(false);
  }, [loadTours]);

  const openTour = useCallback((item: HomeTourItem) => {
    router.push({
      pathname: '/tour-details',
      params: { tour: encodeURIComponent(JSON.stringify(item)) },
    } as any);
  }, []);

  const renderTourCard = (tour: HomeTourItem) => {
    const cardContent = (
      <>
        <View style={styles.tourScrim} />
        <View style={styles.tourTopRow}>
          <View style={styles.tourBadge}>
            <Text style={styles.tourBadgeTxt}>{tour.badge}</Text>
          </View>
          <View style={styles.tourRating}>
            <Ionicons name="star" size={10} color={colors.gold} />
            <Text style={styles.tourRatingTxt}>{tour.rating.toFixed(1)}</Text>
          </View>
        </View>
        <View style={styles.tourContent}>
          <View style={styles.tourDays}>
            <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.82)" />
            <Text style={styles.tourDaysTxt}>{tour.duration || 'Tour'}</Text>
          </View>
          <Text style={styles.tourTitle} numberOfLines={2}>{tour.title}</Text>
          <Text style={styles.tourSub} numberOfLines={2}>{tour.subtitle || tour.city}</Text>
          <View style={styles.tourFooter}>
            <View style={styles.flex}>
              <Text style={styles.fromTxt} numberOfLines={1}>{tour.agency?.name || tour.city || 'Agentlik'}</Text>
              <Text style={styles.tourPrice}>{tour.price || 'Narx so‘rovda'}</Text>
            </View>
            <TouchableOpacity style={styles.detailsBtn} onPress={() => openTour(tour)} activeOpacity={0.84}>
              <Text style={styles.detailsBtnTxt}>Batafsil</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );

    return (
      <TouchableOpacity key={tour.id} style={styles.tourCard} activeOpacity={0.9} onPress={() => openTour(tour)}>
        {tour.imageUrl ? (
          <ImageBackground source={{ uri: tour.imageUrl }} style={styles.tourImage} imageStyle={styles.tourImageRadius}>
            {cardContent}
          </ImageBackground>
        ) : (
          <View style={[styles.tourImage, styles.tourImagePlaceholder]}>{cardContent}</View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={{ width: 30 }} />
        <Text style={styles.brand}>TravelorAI</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.82}>
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.pageIntro}>
        <Text style={styles.pageTitle}>Turlar</Text>
        <Text style={styles.pageSubtitle}>Tasdiqlangan agentlik turlari bilan tanishing va to‘g‘ridan-to‘g‘ri bron qiling.</Text>
      </View>

      <View style={styles.filterCard}>
        <Text style={styles.filterLabel}>Qayerga</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.dropdown} onPress={() => setPickerOpen(true)} activeOpacity={0.84}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            <Text style={styles.dropdownText} numberOfLines={1}>{selectedLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={() => setAppliedKey(selectedKey)} activeOpacity={0.86}>
            <Ionicons name="search" size={16} color={colors.textInverse} />
            <Text style={styles.searchBtnText}>Qidirish</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.stateText}>Agentlik turlari yuklanmoqda...</Text>
          </View>
        ) : filteredTours.length > 0 ? (
          filteredTours.map(renderTourCard)
        ) : appliedKey !== 'all' ? (
          <View style={styles.stateCard}>
            <Ionicons name="search-outline" size={26} color={colors.success} />
            <Text style={styles.stateTitle}>Bu yo‘nalish bo‘yicha tur topilmadi</Text>
            <Text style={styles.stateText}>Boshqa davlatni tanlang yoki «Barchasi»ni belgilang.</Text>
          </View>
        ) : (
          <View style={styles.stateCard}>
            <Ionicons name="briefcase-outline" size={26} color={colors.success} />
            <Text style={styles.stateTitle}>Hali agentlik turlari yo‘q</Text>
            <Text style={styles.stateText}>Admin tasdiqlagan turlar shu yerda avtomatik ko‘rinadi.</Text>
          </View>
        )}
        <View style={{ height: 120 + safeBottom }} />
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Qayerga sayohat?</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {COUNTRY_OPTIONS.map((opt) => {
                const active = opt.key === selectedKey;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.countryRow, active && styles.countryRowActive]}
                    onPress={() => {
                      setSelectedKey(opt.key);
                      setPickerOpen(false);
                    }}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.countryText, active && styles.countryTextActive]}>{opt.label}</Text>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.md,
    },
    iconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    brand: { fontFamily: FONTS.display, fontSize: 13, color: colors.text },
    pageIntro: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
    pageTitle: { fontFamily: FONTS.display, fontSize: 24, color: colors.text, marginBottom: 4 },
    pageSubtitle: {
      maxWidth: 320,
      fontFamily: FONTS.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    filterCard: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: SPACING.sm,
    },
    filterLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    dropdown: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      height: 46,
      borderRadius: RADIUS.md,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
    },
    dropdownText: { flex: 1, fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    searchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 46,
      paddingHorizontal: SPACING.lg,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
    },
    searchBtnText: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textInverse },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
    },
    modalCard: {
      borderRadius: RADIUS.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
    },
    modalTitle: { fontFamily: FONTS.display, fontSize: 18, color: colors.text, marginBottom: SPACING.sm },
    countryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.md,
    },
    countryRowActive: { backgroundColor: colors.primaryPale },
    countryText: { fontFamily: FONTS.medium, fontSize: 15, color: colors.text },
    countryTextActive: { fontFamily: FONTS.semibold, color: colors.primary },
    scroll: { flex: 1 },
    stateCard: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    stateTitle: { fontFamily: FONTS.display, fontSize: 18, color: colors.text, textAlign: 'center' },
    stateText: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      textAlign: 'center',
    },
    tourCard: {
      height: 312,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.primary,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 7,
    },
    tourImage: { flex: 1, justifyContent: 'space-between' },
    tourImageRadius: { borderRadius: 24 },
    tourImagePlaceholder: { borderRadius: 24, backgroundColor: colors.primary },
    tourScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,18,0.34)' },
    tourTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.md,
    },
    tourBadge: {
      borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.24)',
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    tourBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.7, color: colors.textInverse },
    tourRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    tourRatingTxt: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.text },
    tourContent: { padding: SPACING.md },
    tourDays: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    tourDaysTxt: { fontFamily: FONTS.medium, fontSize: 10, color: 'rgba(255,255,255,0.82)' },
    tourTitle: { fontFamily: FONTS.display, fontSize: 28, lineHeight: 32, color: colors.textInverse },
    tourSub: {
      marginTop: 2,
      maxWidth: 290,
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 17,
      color: 'rgba(255,255,255,0.86)',
    },
    tourFooter: {
      marginTop: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    fromTxt: { fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.72)' },
    tourPrice: { fontFamily: FONTS.display, fontSize: 20, color: colors.textInverse },
    detailsBtn: {
      minWidth: 110,
      height: 36,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
    },
    detailsBtnTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textInverse },
  });
}
