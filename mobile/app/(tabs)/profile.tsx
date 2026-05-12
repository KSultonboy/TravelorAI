import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { type AppColors, type ThemePreference, useAppTheme } from '../../src/theme/app-theme';
import { useAchievements } from '../../src/hooks/useAchievements';
import { useTrips } from '../../src/hooks/useTrips';
import { useWishlist } from '../../src/hooks/useWishlist';
import { authAPI } from '../../src/utils/api';
import { type AuthUser, getUserDisplayName, getUserInitials } from '../../src/utils/auth';
import { extractApiData } from '../../src/utils/auth';
import { KEYS, clearAll, clearAuthSession, getItem, getJSON, getUserKey, saveItem, saveUserProfile } from '../../src/utils/storage';
import { type Language, LANGUAGE_OPTIONS } from '../../src/i18n';
import { useTranslation } from 'react-i18next';
import AnimatedBrand from '../../src/components/AnimatedBrand';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, preference, resolvedTheme, systemTheme, setPreference } = useAppTheme();
  const { t, i18n } = useTranslation();
  const styles = createStyles(colors, insets.bottom);

  const THEME_OPTIONS = [
    { key: 'system' as ThemePreference, label: t('profile.themeSystem'), icon: 'phone-portrait-outline' as const },
    { key: 'light' as ThemePreference, label: t('profile.themeLight'), icon: 'sunny-outline' as const },
    { key: 'dark' as ThemePreference, label: t('profile.themeDark'), icon: 'moon-outline' as const },
  ];

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const userId = user?.id ?? null;
  const { trips, loadTrips } = useTrips(userId);
  const { achievements, loadAchievements } = useAchievements(trips, userId);
  const { wishlist, remove: removeWishlist } = useWishlist(userId);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState<Language>('uz');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const syncUserFromServer = useCallback(
    async (fallbackUser: AuthUser | null): Promise<AuthUser | null> => {
      const [tok, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);
      if (!tok || offlineMode === 'true') {
        return fallbackUser;
      }

      try {
        const response = extractApiData<any>(await authAPI.me());
        const remoteUser = response?.user as AuthUser | undefined;
        if (remoteUser?.id) {
          setUser(remoteUser);
          await saveUserProfile(remoteUser);
          return remoteUser;
        }
      } catch {
        // keep local user fallback
      }

      return fallbackUser;
    },
    []
  );

  const refreshProfileData = useCallback(async () => {
    if (!token || !userId) return;

    setRefreshing(true);
    try {
      await syncUserFromServer(user);
      await Promise.all([loadTrips(), loadAchievements()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadAchievements, loadTrips, syncUserFromServer, token, user, userId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const [savedUser, tok, offlineRaw, langRaw] = await Promise.all([
          getJSON<AuthUser>(KEYS.USER),
          getItem(KEYS.TOKEN),
          getItem(KEYS.OFFLINE_MODE),
          getItem(KEYS.LANGUAGE),
        ]);
        if (!active) return;

        setUser(savedUser);
        setToken(tok);
        setOffline(offlineRaw === 'true');
        if (langRaw) {
          setLanguage(langRaw as Language);
          i18n.changeLanguage(langRaw);
        }
        setIsReady(true);

        if (tok) {
          const syncedUser = await syncUserFromServer(savedUser);
          if (!active) return;
          if (syncedUser) {
            setUser(syncedUser);
          }
        }
      })();

      return () => { active = false; };
    }, [i18n, syncUserFromServer])
  );

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;

      (async () => {
        await Promise.all([loadTrips(), loadAchievements()]);
      })();
    }, [loadAchievements, loadTrips, userId])
  );

  const isLoggedIn = Boolean(token);

  if (!isReady) {
    return <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]} />;
  }

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.authWall}>
          <View style={styles.authWallGlowPrimary} />
          <View style={styles.authWallGlowGold} />
          <View style={styles.authWallIconWrap}>
            <Ionicons name="globe-outline" size={44} color={colors.textInverse} />
          </View>
          <AnimatedBrand
            size={34}
            align="center"
            showGlow
            style={styles.authWallBrandWrap}
            textStyle={styles.authWallBrandText}
          />
          <Text style={styles.authWallTitle}>{t('profile.authWallTitle')}</Text>
          <Text style={styles.authWallSub}>{t('profile.authWallSub')}</Text>
          <TouchableOpacity style={styles.authWallLoginBtn} onPress={() => router.push('/login')} activeOpacity={0.85}>
            <Ionicons name="log-in-outline" size={18} color={colors.textInverse} />
            <Text style={styles.authWallLoginTxt}>{t('profile.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.authWallRegisterBtn} onPress={() => router.push('/register')} activeOpacity={0.85}>
            <Text style={styles.authWallRegisterTxt}>{t('profile.register')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  const localTripCount = trips.length;
  const localTotalSpent = trips.reduce((sum, trip) => sum + (trip.totalCost || 0), 0);
  const totalDays = trips.reduce((sum, trip) => sum + (trip.duration || 0), 0);
  const allDestinations = trips.flatMap((trip) => trip.destinations || []);
  const localCities = [...new Set(allDestinations)].length;
  const remoteStats = achievements?.stats;
  const tripCount = typeof remoteStats?.tripCount === 'number' ? remoteStats.tripCount : localTripCount;
  const cityCount = typeof remoteStats?.uniqueCities === 'number' ? remoteStats.uniqueCities : localCities;
  const totalSpent = typeof remoteStats?.totalSpent === 'number' ? remoteStats.totalSpent : localTotalSpent;
  const avgCost = tripCount > 0 ? Math.round(totalSpent / tripCount) : 0;
  const frequencyMap: Record<string, number> = {};
  allDestinations.forEach((destination) => {
    frequencyMap[destination] = (frequencyMap[destination] || 0) + 1;
  });
  const mostVisited = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a])[0] ?? null;
  const achievementPreview =
    achievements.unlocked.length > 0 ? achievements.unlocked.slice(0, 3) : achievements.locked.slice(0, 3);
  const lastTrip =
    trips.length > 0
      ? trips.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;
  const wishlistCount = wishlist.length;
  const achievementProgress = Math.round(achievements.completionRate * 100);

  const name = user ? getUserDisplayName(user) : t('profile.guestName');
  const initials = getUserInitials(user);

  const formatMoney = (value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
      return `${Math.round(value / 1_000)}K`;
    }

    return String(value);
  };

  // ── Notification toggle ───────────────────────────────────────────────────
  // ── Offline mode toggle ───────────────────────────────────────────────────
  const handleOfflineToggle = async (value: boolean) => {
    if (value) {
      const hasCachedRecords = (data: unknown) => {
        if (Array.isArray(data)) return data.length > 0;
        if (data && typeof data === 'object') {
          const items = (data as { items?: unknown }).items;
          if (Array.isArray(items)) return items.length > 0;
          return Object.keys(data).length > 0;
        }
        return false;
      };
      const scopedTripsKey = userId ? getUserKey(userId, KEYS.TRIPS) : KEYS.TRIPS;
      const [poiCache, homePoiCache, destinationCache, tripsCache] = await Promise.all([
        getJSON<unknown>(KEYS.POI_CACHE_V2),
        getJSON<unknown>(KEYS.HOME_CACHE_V2),
        getJSON<unknown>(KEYS.DESTINATIONS_CACHE_V1),
        getJSON<unknown>(scopedTripsKey),
      ]);
      const hasOfflineData = [poiCache, homePoiCache, destinationCache, tripsCache].some(hasCachedRecords);

      if (!hasOfflineData) {
        Alert.alert(
          t('profile.offlineUnavailableTitle', { defaultValue: 'Offline data tayyor emas' }),
          t('profile.offlineUnavailableMsg', {
            defaultValue: 'Avval internet bilan Explore yoki Trips sahifalarini ochib, malumotlar cache bolishini kuting.',
          })
        );
        return;
      }
    }

    setOffline(value);
    await saveItem(KEYS.OFFLINE_MODE, String(value));
    if (value) {
      Alert.alert(t('profile.offlineTitle'), t('profile.offlineMsg'));
    }
  };

  // ── Language change ───────────────────────────────────────────────────────
  const handleLanguageChange = async (lang: Language) => {
    setLanguage(lang);
    setShowLangPicker(false);
    await i18n.changeLanguage(lang);
    await saveItem(KEYS.LANGUAGE, lang);
  };

  const logout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.yes'),
        style: 'destructive',
        onPress: async () => {
          await clearAuthSession();
          router.replace('/login');
        },
      },
    ]);
  };

  const openDeleteAccountModal = () => {
    setDeletePassword('');
    setDeleteModalVisible(true);
  };

  const closeDeleteAccountModal = () => {
    if (isDeletingAccount) return;
    setDeleteModalVisible(false);
    setDeletePassword('');
  };

  const submitDeleteAccount = async () => {
    if (!user) return;

    if (user.authProvider === 'local' && deletePassword.trim().length === 0) {
      Alert.alert(t('profile.errorTitle'), t('profile.deletePasswordRequired'));
      return;
    }

    setIsDeletingAccount(true);
    try {
      await authAPI.deleteAccount({
        confirm: true,
        ...(user.authProvider === 'local' ? { password: deletePassword.trim() } : {}),
      });
      await clearAll();
      setDeleteModalVisible(false);
      Alert.alert(t('profile.deleteSuccessTitle'), t('profile.deleteSuccessMsg'));
      router.replace('/login');
    } catch (e: any) {
      const message =
        typeof e?.message === 'string' && e.message.trim().length > 0
          ? e.message
          : t('profile.deleteErrorMsg');
      Alert.alert(t('profile.errorTitle'), message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const menu = [
    {
      icon: 'chatbubble-ellipses-outline' as const,
      label: t('profile.feedback', { defaultValue: 'Fikr va shikoyatlar' }),
      onPress: () => router.push('/feedback'),
    },
    {
      icon: 'language-outline' as const,
      label: 'Tilni tanlash',
      onPress: () => router.push('/language' as any),
    },
    {
      icon: 'card-outline' as const,
      label: 'To‘lov usullari',
      onPress: () => router.push('/payment-methods' as any),
    },
    {
      icon: 'gift-outline' as const,
      label: 'Aksiyalar',
      onPress: () => router.push('/promotions' as any),
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Yordam markazi',
      onPress: () => router.push('/help-center' as any),
    },
    {
      icon: 'settings-outline' as const,
      label: t('profile.settings'),
      onPress: () => router.push('/settings'),
    },
  ];

  const quickActions = [
    {
      key: 'stats',
      icon: 'stats-chart-outline' as const,
      title: t('profile.stats'),
      subtitle: `${tripCount} ${t('profile.trips')} · ${cityCount} ${t('profile.cities')}`,
      onPress: () => router.push('/profile-stats'),
      badge: null as number | null,
    },
    {
      key: 'achievements',
      icon: 'trophy-outline' as const,
      title: t('profile.achievements'),
      subtitle: `${achievements.unlockedCount}/${achievements.totalCount} ${t('achievements.unlocked')} · ${achievementProgress}%`,
      onPress: () => router.push('/achievements'),
      badge: achievements.unlockedCount,
    },
    {
      key: 'wishlist',
      icon: 'heart-outline' as const,
      title: t('profile.wishlist'),
      subtitle: wishlistCount > 0 ? `${wishlistCount} ${t('profile.wishlist')}` : t('profile.wishlistEmpty'),
      onPress: () => router.push('/wishlist'),
      badge: wishlistCount > 0 ? wishlistCount : null,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshProfileData}
          colors={[colors.primary]}
          tintColor={colors.primary}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.pageTitle}>{t('profile.title')}</Text>
        <View style={styles.modeChip}>
          <Text style={styles.modeChipText}>{resolvedTheme === 'dark' ? t('profile.themeDark') : t('profile.themeLight')}</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowGold} />

        <TouchableOpacity style={styles.editPill} onPress={() => router.push('/profile-edit')} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={14} color={colors.textInverse} />
          <Text style={styles.editPillTxt}>{t('common.edit')}</Text>
        </TouchableOpacity>

        <View style={styles.avatarCircle}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        <Text style={styles.userName}>{name}</Text>
        {user?.email ? <Text style={styles.userEmail}>{user.email}</Text> : null}
        {user?.bio ? <Text style={styles.userBio}>{user.bio}</Text> : null}
        <View style={styles.heroMetricRow}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{tripCount}</Text>
            <Text style={styles.heroMetricLabel}>{t('profile.trips')}</Text>
          </View>
          <View style={styles.heroMetricDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{cityCount}</Text>
            <Text style={styles.heroMetricLabel}>{t('profile.cities')}</Text>
          </View>
          <View style={styles.heroMetricDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{achievementProgress}%</Text>
            <Text style={styles.heroMetricLabel}>{t('achievements.progressLabel')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>{t('profile.quickAccess', { defaultValue: 'Quick access' })}</Text>
        <View style={styles.quickActionList}>
          {quickActions.map((item) => (
            <TouchableOpacity key={item.key} style={styles.quickActionRow} onPress={item.onPress} activeOpacity={0.82}>
              <View style={styles.quickActionIconWrap}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.quickActionBody}>
                <Text style={styles.quickActionTitle}>{item.title}</Text>
                <Text style={styles.quickActionSub} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              {item.badge !== null ? (
                <View style={styles.quickActionBadge}>
                  <Text style={styles.quickActionBadgeTxt}>{item.badge}</Text>
                </View>
              ) : null}
              <View style={styles.quickActionArrow}>
                <Ionicons name="arrow-forward" size={15} color={colors.textInverse} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.hiddenSection}>
        <Text style={styles.statsSectionTitle}>{t('profile.stats')}</Text>

        <View style={styles.statsRow}>
          {([
            { icon: 'map-outline', value: String(tripCount), label: t('profile.trips'), accent: false },
            { icon: 'location-outline', value: String(cityCount), label: t('profile.cities'), accent: false },
            { icon: 'wallet-outline', value: formatMoney(totalSpent), label: t('profile.totalSpent'), accent: true },
          ] as const).map((item) => (
            <View key={item.label} style={[styles.stat, item.accent && styles.statAccent]}>
              <View style={[styles.statIconWrap, item.accent && styles.statIconWrapAccent]}>
                <Ionicons name={item.icon} size={18} color={item.accent ? colors.textInverse : colors.primary} />
              </View>
              <Text style={[styles.statVal, item.accent && styles.statValAccent]}>{item.value}</Text>
              <Text style={[styles.statLabel, item.accent && styles.statLabelAccent]}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.statsRow2}>
          <View style={styles.stat2}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={styles.stat2Val}>{totalDays}</Text>
            <Text style={styles.stat2Label}>{t('profile.days')}</Text>
          </View>
          <View style={styles.stat2Divider} />
          <View style={styles.stat2}>
            <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
            <Text style={styles.stat2Val}>{formatMoney(avgCost)}</Text>
            <Text style={styles.stat2Label}>{t('profile.avgTrip')}</Text>
          </View>
          <View style={styles.stat2Divider} />
          <View style={styles.stat2}>
            <Ionicons name="star-outline" size={16} color={colors.gold} />
            <Text style={[styles.stat2Val, { color: colors.gold }]}>{mostVisited ?? '-'}</Text>
            <Text style={styles.stat2Label}>{t('profile.mostVisited')}</Text>
          </View>
        </View>

        {lastTrip ? (
          <View style={styles.lastTripCard}>
            <View style={styles.lastTripLeft}>
              <View style={styles.lastTripIconWrap}>
                <Ionicons name="airplane-outline" size={20} color={colors.textInverse} />
              </View>
              <View style={styles.lastTripBody}>
                <Text style={styles.lastTripBadge}>{t('profile.lastTrip')}</Text>
                <Text style={styles.lastTripTitle} numberOfLines={1}>
                  {lastTrip.title}
                </Text>
                <Text style={styles.lastTripMeta}>
                  {lastTrip.duration} {t('common.days')} | {lastTrip.destinations?.join(', ') || '-'}
                </Text>
              </View>
            </View>
            <View style={styles.lastTripRight}>
              <Text style={styles.lastTripCost}>{formatMoney(lastTrip.totalCost)}</Text>
              <Text style={styles.lastTripCostLabel}>{t('common.som')}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyStats}>
            <Ionicons name="map-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyStatsTxt}>{t('profile.noTrips')}</Text>
          </View>
        )}
      </View>

      <View style={styles.hiddenSection}>
        <View style={styles.achievementCard}>
          <View style={styles.achievementHeader}>
            <View style={styles.achievementHeaderCopy}>
              <Text style={styles.secTitle}>{t('profile.achievements')}</Text>
              <Text style={styles.achievementSub}>{t('achievements.subtitle')}</Text>
            </View>
            <TouchableOpacity
              style={styles.achievementLinkBtn}
              onPress={() => router.push('/achievements')}
              activeOpacity={0.82}
            >
              <Text style={styles.achievementLinkTxt}>{t('profile.achievementsView')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.achievementSummaryRow}>
            <View style={styles.achievementSummaryBox}>
              <Text style={styles.achievementSummaryValue}>{achievements.unlockedCount}</Text>
              <Text style={styles.achievementSummaryLabel}>{t('achievements.unlocked')}</Text>
            </View>
            <View style={styles.achievementSummaryDivider} />
            <View style={styles.achievementSummaryBox}>
              <Text style={styles.achievementSummaryValue}>{achievements.totalCount}</Text>
              <Text style={styles.achievementSummaryLabel}>{t('achievements.total')}</Text>
            </View>
            <View style={styles.achievementSummaryDivider} />
            <View style={styles.achievementSummaryBox}>
              <Text style={styles.achievementSummaryValue}>{Math.round(achievements.completionRate * 100)}%</Text>
              <Text style={styles.achievementSummaryLabel}>{t('achievements.progressLabel')}</Text>
            </View>
          </View>

          <View style={styles.achievementPreviewRow}>
            {achievementPreview.map((item) => (
              <View key={item.id} style={styles.achievementMiniCard}>
                <View
                  style={[
                    styles.achievementMiniIconWrap,
                    { backgroundColor: item.unlocked ? `${item.accent}18` : colors.cardMuted },
                  ]}
                >
                  <Ionicons
                    name={(item.unlocked ? item.icon : 'lock-closed-outline') as any}
                    size={18}
                    color={item.unlocked ? item.accent : colors.textMuted}
                  />
                </View>
                <Text style={styles.achievementMiniTitle} numberOfLines={2}>
                  {t(item.title)}
                </Text>
                <Text style={styles.achievementMiniMeta} numberOfLines={1}>
                  {item.unlocked ? t('achievements.unlocked') : item.progressText}
                </Text>
              </View>
            ))}
          </View>

          {achievements.nextAchievement ? (
            <View style={styles.achievementNextCard}>
              <Text style={styles.achievementNextLabel}>{t('achievements.nextBadge')}</Text>
              <Text style={styles.achievementNextTitle}>{t(achievements.nextAchievement.title)}</Text>
              <Text style={styles.achievementNextMeta}>{t(achievements.nextAchievement.hint)}</Text>
              <View style={styles.achievementProgressTrack}>
                <View
                  style={[
                    styles.achievementProgressFill,
                    {
                      width: `${Math.max(achievements.nextAchievement.progress * 100, 8)}%`,
                      backgroundColor: achievements.nextAchievement.accent,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Wishlist (Bormoqchi joylar) ── */}
      <View style={styles.hiddenSection}>
        <View style={styles.wishlistHeader}>
          <Text style={styles.secTitle}>{t('profile.wishlist')}</Text>
          {wishlist.length > 0 && (
            <View style={styles.wishlistBadge}>
              <Text style={styles.wishlistBadgeTxt}>{wishlist.length}</Text>
            </View>
          )}
        </View>

        {wishlist.length === 0 ? (
          <View style={styles.wishlistEmpty}>
            <Text style={styles.wishlistEmptyIcon}>♡</Text>
            <Text style={styles.wishlistEmptyTxt}>{t('profile.wishlistEmpty')}</Text>
            <Text style={styles.wishlistEmptyHint}>{t('profile.wishlistHint')}</Text>
          </View>
        ) : (
          wishlist.map((item) => (
            <View key={item.id} style={styles.wishRow}>
              <View style={styles.wishIconWrap}>
                <Text style={styles.wishIcon}>{item.icon}</Text>
              </View>
              <View style={styles.wishInfo}>
                <Text style={styles.wishName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.wishCity}>{item.city}</Text>
              </View>
              <TouchableOpacity
                style={styles.wishRemoveBtn}
                onPress={() => removeWishlist(item.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="heart-dislike-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.themeCard}>
          <View style={styles.themeCardHeader}>
            <View style={styles.themeHeaderCopy}>
              <Text style={styles.secTitle}>{t('profile.appearance')}</Text>
              <Text style={styles.themeSub}>{t('profile.appearanceHint')}</Text>
            </View>
            <View style={styles.systemBadge}>
              <Text style={styles.systemBadgeText}>{t('profile.themeNow')}: {preference === 'system' ? systemTheme : preference}</Text>
            </View>
          </View>

          <View style={styles.themeOptionsRow}>
            {THEME_OPTIONS.map((option) => {
              const active = preference === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.themeOption, active && styles.themeOptionActive]}
                  activeOpacity={0.85}
                  onPress={() => setPreference(option.key)}
                >
                  <View style={[styles.themeIconWrap, active && styles.themeIconWrapActive]}>
                    <Ionicons name={option.icon} size={20} color={active ? colors.textInverse : colors.primary} />
                  </View>
                  <Text style={[styles.themeLabel, active && styles.themeLabelActive]}>{option.label}</Text>
                  <Text style={[styles.themeHint, active && styles.themeHintActive]}>
                    {option.key === 'system' ? `${t('profile.themePhone')}: ${systemTheme}` : option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>{t('profile.preferences', { defaultValue: 'Preferences' })}</Text>

        {/* Language row */}
        <TouchableOpacity style={styles.toggleRow} onPress={() => setShowLangPicker((prev) => !prev)} activeOpacity={0.8}>
          <View style={styles.rowWithIcon}>
            <Ionicons name="language-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.toggleLabel}>{t('profile.language')}</Text>
              <Text style={styles.toggleSub}>
                {LANGUAGE_OPTIONS.find((l) => l.key === language)?.flag}{' '}
                {LANGUAGE_OPTIONS.find((l) => l.key === language)?.label}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Language picker inline */}
        {showLangPicker && (
          <View style={styles.langPicker}>
            {LANGUAGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.langOption, language === opt.key && styles.langOptionActive]}
                onPress={() => handleLanguageChange(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.langFlag}>{opt.flag}</Text>
                <Text style={[styles.langLabel, language === opt.key && styles.langLabelActive]}>{opt.label}</Text>
                {language === opt.key && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Offline mode toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.rowWithIcon}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.primary} />
            <View>
              <Text style={styles.toggleLabel}>{t('profile.offline')}</Text>
              <Text style={styles.toggleSub}>{offline ? t('profile.offlineOn') : t('profile.offlineOff')}</Text>
            </View>
          </View>
          <Switch
            value={offline}
            onValueChange={handleOfflineToggle}
            trackColor={{ false: colors.borderLight, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>{t('profile.other')}</Text>
        {menu.map((item) => (
          <TouchableOpacity key={item.label} style={styles.menuRow} onPress={item.onPress} activeOpacity={0.75}>
            <View style={styles.rowWithIcon}>
              <Ionicons name={item.icon} size={18} color={colors.primary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.logoutTxt}>{t('profile.logout')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={openDeleteAccountModal} activeOpacity={0.85}>
        <Ionicons name="trash-outline" size={18} color={colors.textInverse} />
        <Text style={styles.deleteTxt}>{t('profile.deleteAccount')}</Text>
      </TouchableOpacity>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={closeDeleteAccountModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.deleteModalTitle')}</Text>
            <Text style={styles.modalSub}>{t('profile.deleteModalSub')}</Text>

            {user?.authProvider === 'local' ? (
              <>
                <Text style={styles.modalLabel}>{t('profile.deletePasswordLabel')}</Text>
                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  editable={!isDeletingAccount}
                  placeholder={t('profile.deletePasswordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.modalInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : (
              <View style={styles.modalHintBox}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.modalHintText}>{t('profile.deleteGoogleHint')}</Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={closeDeleteAccountModal}
                disabled={isDeletingAccount}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnSecondaryText}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger, isDeletingAccount && styles.modalBtnDisabled]}
                onPress={submitDeleteAccount}
                disabled={isDeletingAccount}
                activeOpacity={0.8}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                  <Text style={styles.modalBtnDangerText}>{t('profile.deleteNow')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function createStyles(colors: AppColors, bottomInset: number) {
  const safeBottom = Math.max(bottomInset, 22);

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    pageTitle: { fontFamily: FONTS.display, fontSize: 24, color: colors.text },
    modeChip: {
      backgroundColor: colors.primaryPale,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modeChipText: { fontFamily: FONTS.medium, color: colors.primary, fontSize: 12 },
    heroCard: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 34,
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.lg,
      backgroundColor: colors.surface,
      alignItems: 'center',
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 8,
    },
    heroGlowPrimary: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      top: -80,
      left: -40,
      backgroundColor: colors.primaryPale,
    },
    heroGlowGold: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      bottom: -60,
      right: -20,
      backgroundColor: colors.goldPale,
    },
    editPill: {
      position: 'absolute',
      top: SPACING.md,
      right: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 6,
    },
    editPillTxt: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textInverse },
    avatarCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { fontFamily: FONTS.semibold, fontSize: 30, color: colors.textInverse },
    userName: { fontFamily: FONTS.semibold, fontSize: 20, color: colors.text, marginBottom: 2 },
    userEmail: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted },
    userBio: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    heroMetricRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: RADIUS.xl,
      backgroundColor: colors.glassStrong,
      paddingVertical: SPACING.md,
      marginTop: SPACING.lg,
    },
    heroMetric: { flex: 1, alignItems: 'center' },
    heroMetricValue: { fontFamily: FONTS.display, fontSize: 19, color: colors.text },
    heroMetricLabel: { marginTop: 2, fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    heroMetricDivider: { width: 1, height: 36, backgroundColor: colors.borderLight },
    guestLabel: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    authRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg, width: '100%' },
    loginBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      alignItems: 'center',
    },
    loginTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textInverse },
    registerBtn: {
      flex: 1,
      backgroundColor: colors.primaryPale,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    registerTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.primary },
    statsSection: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 5,
    },
    statsSectionTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: SPACING.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    stat: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    statAccent: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    statIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    statIconWrapAccent: { backgroundColor: 'rgba(255,255,255,0.2)' },
    statVal: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.text },
    statValAccent: { color: colors.textInverse },
    statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    statLabelAccent: { color: 'rgba(255,255,255,0.75)' },
    statsRow2: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.md,
    },
    stat2: { flex: 1, alignItems: 'center', gap: 4 },
    stat2Divider: { width: 1, height: 36, backgroundColor: colors.borderLight },
    stat2Val: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text },
    stat2Label: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },
    lastTripCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryPale,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: `${colors.primary}33`,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    lastTripLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    lastTripBody: { flex: 1 },
    lastTripIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    lastTripBadge: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    lastTripTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    lastTripMeta: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    lastTripRight: { alignItems: 'flex-end' },
    lastTripCost: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.primary },
    lastTripCostLabel: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },
    emptyStats: { alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.sm },
    emptyStatsTxt: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    section: { marginHorizontal: SPACING.lg, marginBottom: SPACING.lg },
    hiddenSection: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 28,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 5,
    },
    secTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text, marginBottom: SPACING.md },
    quickActionList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    quickActionRow: {
      width: '48%',
      minHeight: 150,
      alignItems: 'flex-start',
      gap: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: SPACING.md,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.09,
      shadowRadius: 18,
      elevation: 4,
    },
    quickActionIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
    },
    quickActionBody: { flex: 1, width: '100%' },
    quickActionTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text, marginBottom: 2 },
    quickActionSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    quickActionBadge: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
      backgroundColor: colors.primary,
    },
    quickActionBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textInverse },
    quickActionArrow: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
      alignSelf: 'flex-end',
    },
    achievementCard: {
      backgroundColor: 'transparent',
      borderRadius: RADIUS.xl,
    },
    achievementHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.md },
    achievementHeaderCopy: { flex: 1 },
    achievementSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    achievementLinkBtn: {
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    achievementLinkTxt: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.primary },
    achievementSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.md,
    },
    achievementSummaryBox: { flex: 1, alignItems: 'center' },
    achievementSummaryDivider: { width: 1, height: 34, backgroundColor: colors.borderLight },
    achievementSummaryValue: { fontFamily: FONTS.semibold, fontSize: 18, color: colors.text },
    achievementSummaryLabel: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    achievementPreviewRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    achievementMiniCard: {
      flex: 1,
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      alignItems: 'center',
      minHeight: 122,
    },
    achievementMiniIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    achievementMiniTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 4,
      minHeight: 34,
    },
    achievementMiniMeta: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted, textAlign: 'center' },
    achievementNextCard: {
      borderRadius: RADIUS.lg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.md,
    },
    achievementNextLabel: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, marginBottom: 2 },
    achievementNextTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text, marginBottom: 2 },
    achievementNextMeta: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, marginBottom: SPACING.sm },
    achievementProgressTrack: {
      height: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
    },
    achievementProgressFill: { height: '100%', borderRadius: RADIUS.full },
    // ── Wishlist ────────────────────────────────────────────────────────────
    wishlistHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
    wishlistBadge: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.full,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    wishlistBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textInverse },
    wishlistEmpty: {
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      paddingVertical: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    wishlistEmptyIcon: { fontSize: 32 },
    wishlistEmptyTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.textSecondary },
    wishlistEmptyHint: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted },
    wishRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      gap: SPACING.md,
    },
    wishIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wishIcon: { fontSize: 20 },
    wishInfo: { flex: 1 },
    wishName: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    wishCity: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    wishRemoveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.errorPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
    },
    themeCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.md },
    themeHeaderCopy: { flex: 1 },
    themeSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    systemBadge: {
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    systemBadgeText: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
    themeOptionsRow: { flexDirection: 'row', gap: SPACING.sm },
    themeOption: {
      flex: 1,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.cardMuted,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      alignItems: 'center',
    },
    themeOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 6,
    },
    themeIconWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    themeIconWrapActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    themeLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.text, marginBottom: 4 },
    themeLabelActive: { color: colors.textInverse },
    themeHint: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
    themeHintActive: { color: 'rgba(255,255,255,0.8)' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    rowWithIcon: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
    toggleLabel: { fontFamily: FONTS.medium, fontSize: 14, color: colors.text },
    toggleSub: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 1 },
    // ── Language picker ──────────────────────────────────────────────────────
    langPicker: {
      backgroundColor: colors.cardMuted,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: SPACING.sm,
      overflow: 'hidden',
    },
    langOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    langOptionActive: { backgroundColor: colors.primaryPale },
    langFlag: { fontSize: 22 },
    langLabel: { fontFamily: FONTS.medium, fontSize: 14, color: colors.text },
    langLabelActive: { color: colors.primary },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      justifyContent: 'space-between',
    },
    menuLabel: { fontFamily: FONTS.medium, fontSize: 14, color: colors.text },
    logoutBtn: {
      marginHorizontal: SPACING.lg,
      backgroundColor: colors.errorPale,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.error,
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    logoutTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.error },
    deleteBtn: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.sm,
      backgroundColor: colors.error,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.error,
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    deleteTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textInverse },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
    },
    modalTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 18,
      color: colors.text,
      marginBottom: SPACING.sm,
    },
    modalSub: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: SPACING.md,
    },
    modalLabel: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    modalHintBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: RADIUS.md,
      backgroundColor: colors.cardMuted,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    modalHintText: {
      flex: 1,
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    modalActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    modalBtn: {
      flex: 1,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    modalBtnSecondary: {
      backgroundColor: colors.cardMuted,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    modalBtnSecondaryText: {
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.text,
    },
    modalBtnDanger: {
      backgroundColor: colors.error,
    },
    modalBtnDangerText: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.textInverse,
    },
    modalBtnDisabled: {
      opacity: 0.7,
    },
    bottomSpace: { height: 164 + safeBottom },
    // ── Auth Wall ────────────────────────────────────────────────────────────
    authWall: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      overflow: 'hidden',
    },
    authWallGlowPrimary: {
      position: 'absolute',
      width: 280,
      height: 280,
      borderRadius: 140,
      top: -60,
      left: -80,
      backgroundColor: colors.primaryPale,
    },
    authWallGlowGold: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      bottom: -40,
      right: -60,
      backgroundColor: colors.goldPale,
    },
    authWallIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 10,
    },
    authWallBrandWrap: { marginBottom: SPACING.sm },
    authWallBrandText: { color: colors.text },
    authWallTitle: { fontFamily: FONTS.semibold, fontSize: 18, color: colors.text, textAlign: 'center', marginBottom: SPACING.sm },
    authWallSub: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
    authWallLoginBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      width: '100%',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
    authWallLoginTxt: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.textInverse },
    authWallRegisterBtn: {
      backgroundColor: colors.primaryPale,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xl,
      width: '100%',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    authWallRegisterTxt: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.primary },
  });
}
