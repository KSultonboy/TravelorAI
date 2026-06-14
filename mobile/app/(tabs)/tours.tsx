import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
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

export default function ToursScreen() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 22);
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [tours, setTours] = useState<HomeTourItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        ) : tours.length > 0 ? (
          tours.map(renderTourCard)
        ) : (
          <View style={styles.stateCard}>
            <Ionicons name="briefcase-outline" size={26} color={colors.success} />
            <Text style={styles.stateTitle}>Hali agentlik turlari yo‘q</Text>
            <Text style={styles.stateText}>Admin tasdiqlagan turlar shu yerda avtomatik ko‘rinadi.</Text>
          </View>
        )}
        <View style={{ height: 120 + safeBottom }} />
      </ScrollView>
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
    pageIntro: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
    pageTitle: { fontFamily: FONTS.display, fontSize: 24, color: colors.text, marginBottom: 4 },
    pageSubtitle: {
      maxWidth: 320,
      fontFamily: FONTS.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
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
