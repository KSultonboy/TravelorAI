import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { StitchHeader } from '../src/components/stitch/StitchMobile';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { extractApiData } from '../src/utils/auth';
import { homeAPI } from '../src/utils/api';
import { normalizeAgencies, type HomeAgencyItem } from '../src/utils/homeContent';

type AgencyFilter = 'all' | 'top' | 'mostTours';

export default function HomeAgenciesScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [filter, setFilter] = useState<AgencyFilter>('all');
  const [allAgencies, setAllAgencies] = useState<HomeAgencyItem[]>([]);

  const agencies = useMemo(() => {
    const list = [...allAgencies];
    if (filter === 'top') return list.sort((a, b) => b.rating - a.rating);
    if (filter === 'mostTours') return list.sort((a, b) => b.tours - a.tours);
    return list;
  }, [allAgencies, filter]);

  const loadAgencies = useCallback(async () => {
    const payload = extractApiData<{ items?: HomeAgencyItem[] }>(await homeAPI.getAgencies({ limit: 100 }));
    setAllAgencies(normalizeAgencies(payload?.items || []));
  }, []);

  useEffect(() => {
    void loadAgencies().catch(() => setAllAgencies([]));
  }, [loadAgencies]);

  const renderAgency = ({ item, index }: { item: HomeAgencyItem; index: number }) => (
    <View style={styles.card}>
      <View style={styles.rankPill}>
        <Text style={styles.rankText}>#{index + 1}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.city}>{item.city}</Text>
          </View>
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Text style={styles.specialty} numberOfLines={2}>{item.specialty}</Text>
        <View style={styles.stats}>
          <View style={styles.statPill}>
            <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.success} />
            <Text style={styles.statText}>{item.reviews} review</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="map-outline" size={13} color={colors.success} />
            <Text style={styles.statText}>{item.tours} tur</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.84} onPress={() => router.push('/home-tours' as any)}>
            <Text style={styles.primaryText}>Turlarini ko‘rish</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} activeOpacity={0.84} onPress={() => router.push('/help-center' as any)}>
            <Text style={styles.ghostText}>Bog‘lanish</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={agencies}
        keyExtractor={(item) => item.id}
        renderItem={renderAgency}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <StitchHeader title="Tour agency reytingi" subtitle="Ishonchli hamkorlar" back />
            <Text style={styles.pageTitle}>Agentliklar reytingi</Text>
            <Text style={styles.pageSub}>
              Reyting, review soni va mavjud turlar bo‘yicha eng faol agentliklarni ko‘ring.
            </Text>
            <View style={styles.filterRow}>
              {[
                { key: 'all', label: 'Barchasi' },
                { key: 'top', label: 'Top rating' },
                { key: 'mostTours', label: 'Ko‘p turlar' },
              ].map((item) => {
                const active = item.key === filter;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setFilter(item.key as AgencyFilter)}
                    activeOpacity={0.84}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Agentliklar hali backendga qo‘shilmagan.</Text>}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, paddingBottom: 90, gap: SPACING.md },
    headerWrap: { gap: SPACING.sm },
    pageTitle: { fontFamily: FONTS.display, fontSize: 30, color: colors.text },
    pageSub: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    filterRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
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
    card: {
      borderRadius: 28,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      flexDirection: 'row',
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
    rankPill: {
      position: 'absolute',
      right: SPACING.md,
      top: SPACING.md,
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: 9,
      paddingVertical: 5,
      zIndex: 2,
    },
    rankText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textSecondary },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 20,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    avatarText: { fontFamily: FONTS.display, fontSize: 18, color: colors.primary },
    body: { flex: 1, gap: SPACING.sm, paddingRight: 44 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
    titleBlock: { flex: 1 },
    name: { fontFamily: FONTS.display, fontSize: 19, color: colors.text },
    city: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.success, marginTop: 2 },
    rating: {
      height: 30,
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
    },
    ratingText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.text },
    specialty: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
    statPill: {
      height: 30,
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
    },
    statText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textSecondary },
    actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
    primaryButton: {
      flex: 1,
      height: 42,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textInverse },
    ghostButton: {
      flex: 1,
      height: 42,
      borderRadius: 16,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.text },
    empty: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, padding: SPACING.lg },
  });
}
