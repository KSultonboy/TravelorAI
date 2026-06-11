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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { extractApiData, getUserDisplayName, type AuthUser } from '../../src/utils/auth';
import { homeAPI } from '../../src/utils/api';
import { KEYS, getJSON, saveJSON } from '../../src/utils/storage';
import {
  HOME_DEFAULT_HERO,
  buildPlaceParams,
  getPlaceTypeLabel,
  normalizeAgencies,
  normalizeHeroSlides,
  normalizePopularPlaces,
  normalizeTours,
  type HomeAgencyItem,
  type HomeHeroSlide,
  type HomePayload,
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

type HomeShortcutKey = 'agencyTours' | 'planner' | 'hotels' | 'explore' | 'food' | 'transport' | 'wishlist' | 'profile';

type HomeShortcut = {
  key: HomeShortcutKey;
  label: string;
  subtitle: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const HOME_SHORTCUTS: HomeShortcut[] = [
  {
    key: 'agencyTours',
    label: 'Turlar',
    subtitle: 'Tasdiqlangan agency tourlarini toping.',
    cta: 'Turlarni ko‘rish',
    icon: 'briefcase-outline',
    route: '/home-tours',
  },
  {
    key: 'planner',
    label: 'AI Planner',
    subtitle: 'Budjet va qiziqishlarga mos marshrut tuzing.',
    cta: 'Reja tuzish',
    icon: 'sparkles-outline',
    route: '/(tabs)/planner',
  },
  {
    key: 'hotels',
    label: 'Mehmonxona',
    subtitle: 'Yaqin va mashhur mehmonxonalarni ko‘ring.',
    cta: 'Mehmonxonalar',
    icon: 'bed-outline',
    route: '/home-places',
  },
  {
    key: 'explore',
    label: 'Explore',
    subtitle: 'Map orqali joy, restoran va transportlarni toping.',
    cta: 'Xaritani ochish',
    icon: 'map-outline',
    route: '/(tabs)/explore',
  },
  {
    key: 'food',
    label: 'Restoran',
    subtitle: 'Mahalliy taomlar va mashhur restoranlarni saralang.',
    cta: 'Restoranlar',
    icon: 'restaurant-outline',
    route: '/home-places',
  },
  {
    key: 'transport',
    label: 'Transport',
    subtitle: 'Bekat, aeroport va yo‘nalishlarni Yandex orqali tekshiring.',
    cta: 'Transportni ko‘rish',
    icon: 'bus-outline',
    route: '/(tabs)/explore',
  },
  {
    key: 'wishlist',
    label: 'Saqlanganlar',
    subtitle: 'Keyingi safar uchun saqlagan joylaringiz.',
    cta: 'Wishlist',
    icon: 'heart-outline',
    route: '/wishlist',
  },
  {
    key: 'profile',
    label: 'Profil',
    subtitle: 'Booking, wishlist va hisob sozlamalari.',
    cta: 'Profilga o‘tish',
    icon: 'person-circle-outline',
    route: '/(tabs)/profile',
  },
];

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
  const [heroIndex, setHeroIndex] = useState(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedShortcutKey, setSelectedShortcutKey] = useState<HomeShortcutKey>('agencyTours');

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
  const popularPlaceSlides = useMemo(
    () => [...popularPlaces].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 8),
    [popularPlaces]
  );
  const tourSlides = useMemo(() => homeTours.slice(0, 8), [homeTours]);
  const selectedShortcut = useMemo(
    () => HOME_SHORTCUTS.find((item) => item.key === selectedShortcutKey) || HOME_SHORTCUTS[0],
    [selectedShortcutKey]
  );
  const heroKicker = activeHero.title && activeHero.title !== HOME_DEFAULT_HERO.title ? activeHero.title : 'AI powered travel';
  const heroSubtitle = activeHero.subtitle || 'Joy, tour va marshrutlarni bitta joydan toping.';

  const openShortcut = (shortcut: HomeShortcut) => {
    router.push(shortcut.route as any);
  };

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
        <TouchableOpacity style={styles.cardHeart} activeOpacity={0.82}>
          <Ionicons name="heart-outline" size={15} color={colors.text} />
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
            <Text style={styles.heroKicker} numberOfLines={1}>{heroKicker}</Text>
            <Text style={styles.heroWelcome}>Xush kelibsiz,</Text>
            <Text style={styles.heroName}>{userName}!</Text>
            <Text style={styles.heroSub}>{heroSubtitle}</Text>
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

      <View style={styles.section}>
        <SectionHeader title="Xizmatlar" action="Barchasi" onPress={() => router.push('/home-tours' as any)} styles={styles} />
        <View style={styles.shortcutGrid}>
          {HOME_SHORTCUTS.map((shortcut) => {
            const active = shortcut.key === selectedShortcutKey;
            return (
              <TouchableOpacity
                key={shortcut.key}
                style={[styles.shortcutCard, active && styles.shortcutCardActive]}
                onPress={() => setSelectedShortcutKey(shortcut.key)}
                activeOpacity={0.86}
              >
                <View style={[styles.shortcutIcon, active && styles.shortcutIconActive]}>
                  <Ionicons name={shortcut.icon} size={19} color={active ? colors.textInverse : colors.success} />
                </View>
                <Text style={[styles.shortcutLabel, active && styles.shortcutLabelActive]} numberOfLines={2}>
                  {shortcut.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.shortcutPanel}>
          <View style={styles.shortcutPanelIcon}>
            <Ionicons name={selectedShortcut.icon} size={22} color={colors.success} />
          </View>
          <View style={styles.shortcutPanelCopy}>
            <Text style={styles.shortcutPanelTitle}>{selectedShortcut.label}</Text>
            <Text style={styles.shortcutPanelText}>{selectedShortcut.subtitle}</Text>
          </View>
          <TouchableOpacity style={styles.shortcutPanelButton} onPress={() => openShortcut(selectedShortcut)} activeOpacity={0.84}>
            <Text style={styles.shortcutPanelButtonText}>{selectedShortcut.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Mashhur joylar" action="View all" onPress={() => router.push('/home-places' as any)} styles={styles} />
        <FlatList
          horizontal
          data={popularPlaceSlides}
          keyExtractor={(item) => `popular-${item.id}`}
          renderItem={renderPlaceCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={<EmptyState icon="map-outline" title="Popular joylar yo‘q" text="Backenddan joylar kelganda shu yerda ko‘rinadi." styles={styles} />}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Agentlik turlari" action="View all" onPress={() => router.push('/home-tours' as any)} styles={styles} />
        <FlatList
          horizontal
          data={tourSlides}
          keyExtractor={(item) => item.id}
          renderItem={renderTourCard}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          ListEmptyComponent={<EmptyState icon="briefcase-outline" title="Turlar yo‘q" text="Agencylar tasdiqlangan tour qo‘shsa, shu yerda chiqadi." styles={styles} />}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Tour agency reytingi" action="View all" onPress={() => router.push('/home-agencies' as any)} styles={styles} />
        <View style={styles.agencyCard}>
          {homeAgencies.slice(0, 3).map(renderAgency)}
          {homeAgencies.length === 0 ? <EmptyState icon="business-outline" title="Agencylar yo‘q" text="Tasdiqlangan agencylar qo‘shilgach reyting ko‘rinadi." styles={styles} compact /> : null}
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

function EmptyState({
  icon,
  title,
  text,
  styles,
  compact,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.emptyCard, compact && styles.emptyCardCompact]}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={19} color="#006C4A" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>{text}</Text>
      </View>
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
      minHeight: 292,
      justifyContent: 'flex-end',
    },
    heroImageAnimated: { ...StyleSheet.absoluteFillObject },
    heroImage: { minHeight: 292, justifyContent: 'flex-end' },
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
      backgroundColor: colors.success,
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
    shortcutGrid: {
      marginHorizontal: SPACING.lg,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    shortcutCard: {
      width: '22.8%',
      minHeight: 96,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: 9,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
      elevation: 2,
    },
    shortcutCardActive: {
      backgroundColor: colors.successPale,
      borderColor: colors.success,
      shadowOpacity: 0.06,
      elevation: 2,
    },
    shortcutIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successPale,
    },
    shortcutIconActive: {
      backgroundColor: colors.success,
    },
    shortcutLabel: {
      minHeight: 30,
      textAlign: 'center',
      fontFamily: FONTS.semibold,
      fontSize: 10,
      lineHeight: 14,
      color: colors.textSecondary,
    },
    shortcutLabelActive: { color: colors.success },
    shortcutPanel: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.md,
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    shortcutPanelIcon: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successPale,
    },
    shortcutPanelCopy: { flex: 1, gap: 4 },
    shortcutPanelTitle: {
      fontFamily: FONTS.display,
      fontSize: 17,
      color: colors.text,
    },
    shortcutPanelText: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
    shortcutPanelButton: {
      minHeight: 42,
      borderRadius: 21,
      backgroundColor: colors.success,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    shortcutPanelButtonText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textInverse,
    },
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
    seeAll: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.success },
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
    emptyCard: {
      width: 260,
      minHeight: 112,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    emptyCardCompact: {
      width: '100%',
      minHeight: 84,
    },
    emptyIcon: {
      width: 40,
      height: 40,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successPale,
    },
    emptyTitle: {
      fontFamily: FONTS.display,
      fontSize: 14,
      color: colors.text,
    },
    emptyText: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
  });
}
