import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { useAchievements } from '../src/hooks/useAchievements';
import { useTrips } from '../src/hooks/useTrips';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { type AuthUser } from '../src/utils/auth';
import { KEYS, getJSON } from '../src/utils/storage';

export default function ProfileStatsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getJSON<AuthUser>(KEYS.USER).then((u) => setUserId(u?.id ?? null));
  }, []);

  const { trips, loadTrips } = useTrips(userId);
  const { achievements, loadAchievements } = useAchievements(trips, userId);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
      loadAchievements();
    }, [loadAchievements, loadTrips])
  );

  const stats = useMemo(() => {
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
    const mostVisited = Object.keys(frequencyMap).sort((a, b) => frequencyMap[b] - frequencyMap[a])[0] ?? '-';
    const lastTrip =
      trips.length > 0
        ? trips.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null;

    return {
      tripCount,
      cityCount,
      totalSpent,
      totalDays,
      avgCost,
      mostVisited,
      lastTrip,
    };
  }, [achievements, trips]);

  const formatMoney = (value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${Math.round(value / 1_000)}K`;
    }
    return String(value);
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
          <Text style={styles.backTxt}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{t('profile.stats')}</Text>

        <View style={styles.statsRow}>
          {([
            { icon: 'map-outline', value: String(stats.tripCount), label: t('profile.trips'), accent: false },
            { icon: 'location-outline', value: String(stats.cityCount), label: t('profile.cities'), accent: false },
            { icon: 'wallet-outline', value: formatMoney(stats.totalSpent), label: t('profile.totalSpent'), accent: true },
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
            <Text style={styles.stat2Val}>{stats.totalDays}</Text>
            <Text style={styles.stat2Label}>{t('profile.days')}</Text>
          </View>
          <View style={styles.stat2Divider} />
          <View style={styles.stat2}>
            <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
            <Text style={styles.stat2Val}>{formatMoney(stats.avgCost)}</Text>
            <Text style={styles.stat2Label}>{t('profile.avgTrip')}</Text>
          </View>
          <View style={styles.stat2Divider} />
          <View style={styles.stat2}>
            <Ionicons name="star-outline" size={16} color={colors.gold} />
            <Text style={[styles.stat2Val, { color: colors.gold }]}>{stats.mostVisited}</Text>
            <Text style={styles.stat2Label}>{t('profile.mostVisited')}</Text>
          </View>
        </View>

        {stats.lastTrip ? (
          <View style={styles.lastTripCard}>
            <View style={styles.lastTripLeft}>
              <View style={styles.lastTripIconWrap}>
                <Ionicons name="airplane-outline" size={20} color={colors.textInverse} />
              </View>
              <View style={styles.lastTripBody}>
                <Text style={styles.lastTripBadge}>{t('profile.lastTrip')}</Text>
                <Text style={styles.lastTripTitle} numberOfLines={1}>
                  {stats.lastTrip.title}
                </Text>
                <Text style={styles.lastTripMeta}>
                  {stats.lastTrip.duration} {t('common.days')} | {stats.lastTrip.destinations?.join(', ') || '-'}
                </Text>
              </View>
            </View>
            <View style={styles.lastTripRight}>
              <Text style={styles.lastTripCost}>{formatMoney(stats.lastTrip.totalCost)}</Text>
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
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
    headerRow: { paddingVertical: SPACING.md },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    backTxt: { fontFamily: FONTS.medium, fontSize: 13, color: colors.primary },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    title: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.text, marginBottom: SPACING.md },
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
      elevation: 5,
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
    },
    lastTripBadge: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      color: colors.primary,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    lastTripTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    lastTripMeta: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    lastTripRight: { alignItems: 'flex-end' },
    lastTripCost: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.primary },
    lastTripCostLabel: { fontFamily: FONTS.regular, fontSize: 10, color: colors.textMuted },
    emptyStats: { alignItems: 'center', paddingVertical: SPACING.lg, gap: SPACING.sm },
    emptyStatsTxt: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  });
}
