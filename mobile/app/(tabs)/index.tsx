import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AiSpark from '../../src/components/AiSpark';
import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { primaryGlow } from '../../src/constants/effects';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { extractApiData, getUserDisplayName, type AuthUser } from '../../src/utils/auth';
import { homeAPI } from '../../src/utils/api';
import { KEYS, getJSON, saveJSON } from '../../src/utils/storage';
import { useWishlist } from '../../src/hooks/useWishlist';
import {
  HOME_DEFAULT_HERO,
  PLACE_FILTERS,
  buildPlaceParams,
  getPlaceTypeLabel,
  normalizeAgencies,
  normalizeHeroSlides,
  normalizePopularPlaces,
  normalizeTours,
  type HomeAgencyItem,
  type HomeHeroSlide,
  type HomePayload,
  type HomePlaceType,
  type HomeTourItem,
  type PopularPlaceItem,
} from '../../src/utils/homeContent';

type HeroSlidesPayload = {
  items?: unknown[];
};

function firstNameFromUser(user: AuthUser | null) {
  if (!user) return 'Sayohatchi';
  const displayName = getUserDisplayName(user).trim();
  return displayName.split(/\s+/)[0] || 'Sayohatchi';
}

function getPlaceImage(item: PopularPlaceItem) {
  return item.imageUrl || null;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(26)).current;
  const heroFadeAnim = useRef(new Animated.Value(1)).current;
  const heroTextAnim = useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);
  const [popularPlaces, setPopularPlaces] = useState<PopularPlaceItem[]>([]);
  const [homeTours, setHomeTours] = useState<HomeTourItem[]>([]);
  const [homeAgencies, setHomeAgencies] = useState<HomeAgencyItem[]>([]);
  const [heroSlides, setHeroSlides] = useState<HomeHeroSlide[]>([]);
  const [placeFilter, setPlaceFilter] = useState<HomePlaceType>('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(user?.id || null);

  const loadHomeData = useCallback(async () => {
    const [savedUser, cached] = await Promise.all([
      getJSON<AuthUser>(KEYS.USER).catch(() => null),
      getJSON<HomePayload>(KEYS.HOME_CACHE_V2).catch(() => null),
    ]);

    setUser(savedUser);

    const cachedPlaces = normalizePopularPlaces(cached?.places || []);
    const cachedTours = normalizeTours(cached?.tours || []);
    const cachedAgencies = normalizeAgencies(cached?.agencies || []);
    const cachedHeroSlides = normalizeHeroSlides(cached?.heroSlides || []);
    if (cachedPlaces.length > 0) {
      setPopularPlaces(cachedPlaces);
    }
    if (cachedTours.length > 0) setHomeTours(cachedTours);
    if (cachedAgencies.length > 0) setHomeAgencies(cachedAgencies);
    if (cachedHeroSlides.length > 0) setHeroSlides(cachedHeroSlides);

    const [homeResult, heroSlidesResult] = await Promise.allSettled([
      homeAPI.getHome({ limit: 48 }),
      homeAPI.getHeroSlides({ limit: 8 }),
    ]);

    try {
      if (homeResult.status === 'rejected' && heroSlidesResult.status === 'rejected') {
        throw homeResult.reason || heroSlidesResult.reason;
      }

      const hasFreshHomePayload = homeResult.status === 'fulfilled';
      const payload: Partial<HomePayload> =
        homeResult.status === 'fulfilled'
          ? extractApiData<HomePayload>(homeResult.value) || {}
          : {};
      const heroPayload: HeroSlidesPayload =
        heroSlidesResult.status === 'fulfilled'
          ? extractApiData<HeroSlidesPayload>(heroSlidesResult.value) || {}
          : {};
      const nextPlaces = hasFreshHomePayload ? normalizePopularPlaces(payload.places || []) : cachedPlaces;
      const nextTours = hasFreshHomePayload ? normalizeTours(payload.tours || []) : cachedTours;
      const nextAgencies = hasFreshHomePayload ? normalizeAgencies(payload.agencies || []) : cachedAgencies;
      const directHeroSlides = normalizeHeroSlides(heroPayload.items || []);
      const nextHeroSlides = directHeroSlides.length > 0 ? directHeroSlides : normalizeHeroSlides(payload.heroSlides || []);

      setPopularPlaces(nextPlaces);
      setHomeTours(nextTours);
      setHomeAgencies(nextAgencies);
      setHeroSlides(nextHeroSlides);
      await saveJSON(KEYS.HOME_CACHE_V2, {
        places: nextPlaces,
        tours: nextTours,
        agencies: nextAgencies,
        heroSlides: nextHeroSlides,
        stats: payload.stats,
        updatedAt: payload.updatedAt,
      });
      await saveJSON(KEYS.HOME_STATS_CACHE, {
        poi: nextPlaces.length,
        tours: nextTours.length,
        agencies: nextAgencies.length,
      });
    } catch {
      if (cachedPlaces.length === 0) setPopularPlaces([]);
      if (cachedTours.length === 0) setHomeTours([]);
      if (cachedAgencies.length === 0) setHomeAgencies([]);
      if (cachedHeroSlides.length === 0) setHeroSlides([]);
    }
  }, []);

  useEffect(() => {
    void loadHomeData();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, loadHomeData, slideAnim]);

  const computedHeroSlides = useMemo(() => {
    const backendSlides = heroSlides.filter((item) => item.imageUrl);
    return backendSlides.length > 0 ? backendSlides.slice(0, 6) : [HOME_DEFAULT_HERO];
  }, [heroSlides]);

  useEffect(() => {
    if (computedHeroSlides.length <= 1) return;
    const timer = setInterval(() => {
      Animated.parallel([
        Animated.timing(heroFadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(heroTextAnim, { toValue: -12, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        setHeroIndex((current) => (current + 1) % computedHeroSlides.length);
        heroTextAnim.setValue(12);
        Animated.parallel([
          Animated.timing(heroFadeAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
          Animated.timing(heroTextAnim, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]).start();
      });
    }, 4200);
    return () => clearInterval(timer);
  }, [computedHeroSlides.length, heroFadeAnim, heroTextAnim]);

  useEffect(() => {
    if (heroIndex >= computedHeroSlides.length) setHeroIndex(0);
  }, [heroIndex, computedHeroSlides.length]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomeData();
    setRefreshing(false);
  };

  const userName = firstNameFromUser(user);
  const activeHero = computedHeroSlides[heroIndex] || HOME_DEFAULT_HERO;
  const filteredPlaces = useMemo(
    () => (placeFilter === 'all' ? popularPlaces : popularPlaces.filter((item) => item.type === placeFilter)),
    [placeFilter, popularPlaces]
  );
  const popularPlaceSlides = useMemo(
    () => [...popularPlaces].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 8),
    [popularPlaces]
  );
  const latestTours = useMemo(() => homeTours.filter((tour) => tour.badge === 'Latest'), [homeTours]);
  const popularTours = useMemo(() => homeTours.filter((tour) => tour.badge === 'Popular'), [homeTours]);

  const openPlace = (item: PopularPlaceItem) => {
    router.push({
      pathname: '/place/[slug]',
      params: buildPlaceParams(item),
    });
  };

  const renderPlaceCard = ({ item }: { item: PopularPlaceItem }) => (
    <TouchableOpacity style={styles.placeSlideCard} activeOpacity={0.88} onPress={() => openPlace(item)}>
      <PlaceCardMedia imageUrl={getPlaceImage(item)} styles={styles} colors={colors}>
        <View style={styles.cardScrim} />
        <TouchableOpacity
          style={styles.cardHeart}
          activeOpacity={0.82}
          onPress={(event) => {
            event.stopPropagation();
            void toggleWishlist({
              id: item.id,
              poiId: item.id,
              name: item.name,
              city: item.city || 'Global',
              slug: item.slug,
              type: item.type,
              icon: '📍',
            });
          }}
        >
          <Ionicons name={isWishlisted(item.id) || isWishlisted(item.slug) ? 'heart' : 'heart-outline'} size={15} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.placeSlideBody}>
          <Text style={styles.placeSlideName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.placeSlideMeta} numberOfLines={1}>
            {item.city || 'Global'} · {getPlaceTypeLabel(item.type)}
          </Text>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color={colors.gold} />
            <Text style={styles.ratingText}>{item.rating ? item.rating.toFixed(1) : 'Yandex'}</Text>
          </View>
        </View>
      </PlaceCardMedia>
    </TouchableOpacity>
  );

  const openTour = (item: HomeTourItem) => {
    router.push({
      pathname: '/tour-details',
      params: { tour: encodeURIComponent(JSON.stringify(item)) },
    } as any);
  };

  const renderTourCard = ({ item }: { item: HomeTourItem }) => (
    <TouchableOpacity style={styles.tourCard} activeOpacity={0.88} onPress={() => openTour(item)}>
      <TourCardMedia imageUrl={item.imageUrl || null} styles={styles} colors={colors}>
        <View style={styles.cardScrim} />
        <View style={styles.tourBadge}>
          <Text style={styles.tourBadgeText}>{item.badge}</Text>
        </View>
      </TourCardMedia>
      <View style={styles.tourBody}>
        <Text style={styles.tourTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.tourSub} numberOfLines={2}>{item.subtitle}</Text>
        <View style={styles.tourMetaRow}>
          <Text style={styles.tourMeta}>{item.duration}</Text>
          <Text style={styles.tourPrice}>{item.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderAgency = (item: HomeAgencyItem) => (
    <TouchableOpacity key={item.id} style={styles.agencyRow} activeOpacity={0.86} onPress={() => router.push('/home-agencies' as any)}>
      <View style={styles.agencyAvatar}>
        <Text style={styles.agencyAvatarText}>{item.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text>
      </View>
      <View style={styles.agencyCopy}>
        <Text style={styles.agencyName}>{item.name}</Text>
        <Text style={styles.agencySub} numberOfLines={1}>{item.city} · {item.specialty}</Text>
      </View>
      <View style={styles.agencyRating}>
        <Ionicons name="star" size={12} color={colors.gold} />
        <Text style={styles.agencyRatingText}>{item.rating.toFixed(1)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.success} colors={[colors.success]} />}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push('/side-menu' as any)} activeOpacity={0.82}>
          <Ionicons name="menu" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.brandText}>TravelorAI</Text>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.82}>
          <Ionicons name="person" size={17} color={colors.textInverse} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {activeHero.imageUrl ? (
          <Animated.View style={[styles.heroImageAnimated, { opacity: heroFadeAnim }]}>
            <ImageBackground source={{ uri: activeHero.imageUrl }} style={styles.heroImage} imageStyle={styles.heroImageRadius}>
              <View style={styles.heroOverlay} />
            </ImageBackground>
          </Animated.View>
        ) : (
          <View style={styles.heroFallback}>
            <View style={styles.heroGlowLarge} />
            <View style={styles.heroGlowSmall} />
            <View style={styles.heroOverlay} />
          </View>
        )}
        <Animated.View style={[styles.heroCopy, { transform: [{ translateY: heroTextAnim }] }]}>
            <Text style={styles.heroKicker}>Dunyo bo‘ylab aqlli marshrut</Text>
            <Text style={styles.heroWelcome}>Xush kelibsiz,</Text>
            <Text style={styles.heroName}>{userName}!</Text>
            <Text style={styles.heroSub}>{activeHero.subtitle}</Text>
            <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(tabs)/explore' as any)} activeOpacity={0.88}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <Text style={styles.searchText}>Qayerga sayohat qilmoqchisiz?</Text>
              <View style={styles.searchAction}>
                <Ionicons name="arrow-forward" size={16} color={colors.textInverse} />
              </View>
            </TouchableOpacity>
            <View style={styles.heroDots}>
              {computedHeroSlides.map((slide, index) => (
                <View key={slide.id} style={[styles.heroDot, index === heroIndex && styles.heroDotActive]} />
              ))}
            </View>
          </Animated.View>
      </Animated.View>

      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.aiCtaWrap}
        onPress={() => router.push('/(tabs)/planner' as any)}
      >
        <LinearGradient
          colors={colors.gradientPrimary as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiCta}
        >
          <View style={styles.aiCtaSpark}>
            <AiSpark size={34} glow animated />
          </View>
          <View style={styles.aiCtaCopy}>
            <Text style={styles.aiCtaTitle}>AI bilan sayohat rejasi</Text>
            <Text style={styles.aiCtaSub}>Byudjet va qiziqishlaringizga mos reja — bir necha soniyada</Text>
          </View>
          <View style={styles.aiCtaArrow}>
            <Ionicons name="arrow-forward" size={18} color={colors.onGradient} />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.section}>
        <SectionHeader title="Joylarni filterlash" action="View all" onPress={() => router.push('/home-places' as any)} styles={styles} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {PLACE_FILTERS.map((filter) => {
            const active = filter.key === placeFilter;
            return (
              <TouchableOpacity key={filter.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setPlaceFilter(filter.key)} activeOpacity={0.84}>
                <Ionicons name={filter.icon} size={14} color={active ? colors.textInverse : colors.textSecondary} />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <FlatList
          horizontal
          data={filteredPlaces.slice(0, 8)}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaceCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={<Text style={styles.emptyText}>Bu filter uchun joy topilmadi.</Text>}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Popular places" action="View all" onPress={() => router.push('/home-places' as any)} styles={styles} />
        <FlatList
          horizontal
          data={popularPlaceSlides}
          keyExtractor={(item) => `popular-${item.id}`}
          renderItem={renderPlaceCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Latest tours" action="View all" onPress={() => router.push('/home-tours' as any)} styles={styles} />
        <FlatList
          horizontal
          data={latestTours}
          keyExtractor={(item) => item.id}
          renderItem={renderTourCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={<Text style={styles.emptyText}>Latest tours hali backendga qo‘shilmagan.</Text>}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Popular tours" action="View all" onPress={() => router.push('/home-tours' as any)} styles={styles} />
        <FlatList
          horizontal
          data={popularTours}
          keyExtractor={(item) => item.id}
          renderItem={renderTourCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={<Text style={styles.emptyText}>Popular tours hali backendga qo‘shilmagan.</Text>}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Tour agency reytingi" action="View all" onPress={() => router.push('/home-agencies' as any)} styles={styles} />
        <View style={styles.agencyCard}>
          {homeAgencies.slice(0, 3).map(renderAgency)}
          {homeAgencies.length === 0 ? <Text style={styles.emptyText}>Agentliklar hali backendga qo‘shilmagan.</Text> : null}
        </View>
      </View>

      <View style={{ height: 166 + Math.max(insets.bottom, 22) }} />
    </ScrollView>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
  styles,
}: {
  title: string;
  action: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.seeAll}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PlaceCardMedia({
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
      <ImageBackground source={{ uri: imageUrl }} style={styles.placeSlideImage} imageStyle={styles.placeSlideImageRadius}>
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.placeSlideImage, styles.placeholderMedia]}>
      <Ionicons name="image-outline" size={28} color={colors.textInverse} />
      {children}
    </View>
  );
}

function TourCardMedia({
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
      <ImageBackground source={{ uri: imageUrl }} style={styles.tourImage} imageStyle={styles.tourImageRadius}>
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.tourImage, styles.placeholderMedia]}>
      <Ionicons name="map-outline" size={28} color={colors.textInverse} />
      {children}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
    },
    menuBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    brandText: {
      fontFamily: FONTS.display,
      fontSize: 19,
      color: colors.text,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    hero: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 30,
      overflow: 'hidden',
      backgroundColor: colors.primary,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 26,
      elevation: 7,
      minHeight: 294,
      justifyContent: 'flex-end',
    },
    heroImageAnimated: { ...StyleSheet.absoluteFillObject },
    heroImage: { minHeight: 294, justifyContent: 'flex-end' },
    heroImageRadius: { borderRadius: 30 },
    heroFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.primary,
      overflow: 'hidden',
    },
    heroGlowLarge: {
      position: 'absolute',
      width: 240,
      height: 240,
      borderRadius: 120,
      right: -58,
      top: -42,
      backgroundColor: 'rgba(104,219,169,0.24)',
    },
    heroGlowSmall: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      left: -42,
      bottom: -26,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(8,18,32,0.50)',
    },
    heroCopy: { padding: SPACING.xl, paddingTop: 86 },
    heroKicker: {
      alignSelf: 'flex-start',
      marginBottom: SPACING.md,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textInverse,
      overflow: 'hidden',
    },
    heroWelcome: {
      fontFamily: FONTS.display,
      fontSize: 34,
      lineHeight: 38,
      color: colors.textInverse,
    },
    heroName: {
      fontFamily: FONTS.display,
      fontSize: 43,
      lineHeight: 47,
      color: colors.textInverse,
      marginBottom: 8,
    },
    heroSub: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      lineHeight: 20,
      color: 'rgba(255,255,255,0.84)',
      marginBottom: SPACING.lg,
      maxWidth: 278,
    },
    searchBar: {
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: SPACING.md,
      paddingRight: 6,
      gap: SPACING.sm,
    },
    searchText: {
      flex: 1,
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    searchAction: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    aiCtaWrap: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.xl,
      borderRadius: RADIUS.card,
      ...primaryGlow(colors),
    },
    aiCta: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: RADIUS.card,
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
    },
    aiCtaSpark: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiCtaCopy: { flex: 1 },
    aiCtaTitle: {
      fontFamily: FONTS.display,
      fontSize: 17,
      color: colors.onGradient,
    },
    aiCtaSub: {
      fontFamily: FONTS.regular,
      fontSize: 12.5,
      color: colors.onGradient,
      opacity: 0.82,
      marginTop: 2,
      lineHeight: 17,
    },
    aiCtaArrow: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroDots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: SPACING.md,
      justifyContent: 'center',
    },
    heroDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.42)',
    },
    heroDotActive: {
      width: 18,
      backgroundColor: colors.textInverse,
    },
    section: { marginBottom: SPACING.xl, overflow: 'visible' },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
    },
    sectionTitle: {
      fontFamily: FONTS.display,
      fontSize: 22,
      color: colors.text,
    },
    seeAll: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.primary },
    filterRow: {
      paddingLeft: SPACING.lg,
      paddingRight: SPACING.lg,
      gap: SPACING.sm,
      paddingBottom: SPACING.sm,
    },
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
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    filterChipTextActive: {
      color: colors.textInverse,
    },
    horizontalList: {
      paddingLeft: SPACING.lg,
      paddingRight: SPACING.lg,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    placeSlideCard: {
      width: 178,
      height: 220,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.cardMuted,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 4,
    },
    placeSlideImage: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    placeSlideImageRadius: { borderRadius: 24 },
    placeholderMedia: {
      backgroundColor: colors.primary,
      overflow: 'hidden',
    },
    cardScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(7,15,28,0.30)',
    },
    cardHeart: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeSlideBody: {
      padding: SPACING.md,
      gap: 5,
    },
    placeSlideName: {
      fontFamily: FONTS.display,
      fontSize: 17,
      lineHeight: 20,
      color: colors.textInverse,
    },
    placeSlideMeta: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: 'rgba(255,255,255,0.80)',
    },
    ratingPill: {
      alignSelf: 'flex-start',
      height: 24,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.88)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      marginTop: 2,
    },
    ratingText: {
      fontFamily: FONTS.semibold,
      fontSize: 10,
      color: colors.text,
    },
    tourCard: {
      width: 254,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 4,
    },
    tourImage: {
      height: 126,
      padding: SPACING.sm,
      alignItems: 'flex-start',
    },
    tourImageRadius: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    tourBadge: {
      borderRadius: RADIUS.full,
      backgroundColor: colors.success,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    tourBadgeText: {
      fontFamily: FONTS.semibold,
      fontSize: 10,
      color: colors.textInverse,
    },
    tourBody: {
      padding: SPACING.md,
      gap: 6,
    },
    tourTitle: {
      fontFamily: FONTS.display,
      fontSize: 18,
      color: colors.text,
    },
    tourSub: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    tourMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    tourMeta: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    tourPrice: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.success,
    },
    agencyCard: {
      marginHorizontal: SPACING.lg,
      borderRadius: 24,
      backgroundColor: colors.surface,
      padding: SPACING.sm,
      gap: SPACING.xs,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
    agencyRow: {
      minHeight: 70,
      borderRadius: 20,
      backgroundColor: colors.cardMuted,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      gap: SPACING.md,
    },
    agencyAvatar: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: colors.successPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agencyAvatarText: {
      fontFamily: FONTS.display,
      fontSize: 13,
      color: colors.success,
    },
    agencyCopy: { flex: 1 },
    agencyName: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.text,
    },
    agencySub: {
      marginTop: 3,
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textMuted,
    },
    agencyRating: {
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
    },
    agencyRatingText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.text,
    },
    emptyText: {
      width: 260,
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textMuted,
      paddingVertical: SPACING.lg,
    },
  });
}
