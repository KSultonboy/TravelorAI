import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Badge from '../../src/components/Badge';
import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { formatSum } from '../../src/utils/formatter';
import { destinationsAPI } from '../../src/utils/api';
import { extractApiData } from '../../src/utils/auth';
import { KEYS, getJSON, saveJSON } from '../../src/utils/storage';

export default function DestinationDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const [destRaw, setDestRaw] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    let active = true;

    (async () => {
      const cached = await getJSON<any[]>(KEYS.DESTINATIONS_CACHE_V1);
      const cachedMatch = Array.isArray(cached)
        ? cached.find((item) => String(item.slug || '').toLowerCase() === String(slug).toLowerCase())
        : null;

      if (active && cachedMatch) {
        setDestRaw(cachedMatch);
        setLoading(false);
      }

      try {
        const res = await destinationsAPI.getById(slug as string);
        const destination = extractApiData<any>(res);
        if (!destination) return;

        if (active) {
          setDestRaw(destination);
          setLoading(false);
        }

        const nextCache = Array.isArray(cached) ? [...cached] : [];
        const idx = nextCache.findIndex((item) => String(item.slug || '').toLowerCase() === String(destination.slug || '').toLowerCase());
        if (idx >= 0) nextCache[idx] = destination;
        else nextCache.push(destination);
        await saveJSON(KEYS.DESTINATIONS_CACHE_V1, nextCache);
      } catch {
        if (active && !cachedMatch) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!destRaw) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundTxt}>{t('destination.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backFallback}>
          <Text style={styles.backFallbackTxt}>{t('destination.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Normalize field names between static (image) and API (imageUrl)
  const dest = {
    ...destRaw,
    image: destRaw.imageUrl || destRaw.image || '',
    landmarks: Array.isArray(destRaw.landmarks) ? destRaw.landmarks : [],
    hotels:    Array.isArray(destRaw.hotels)    ? destRaw.hotels    : [],
    categories: Array.isArray(destRaw.categories) ? destRaw.categories : [],
    tags: Array.isArray(destRaw.tags) ? destRaw.tags : [],
    bestSeasons: Array.isArray(destRaw.bestSeasons) ? destRaw.bestSeasons : [],
    trainPrice: Number(destRaw.trainPrice || 0),
    busPrice: Number(destRaw.busPrice || 0),
    flightPrice: Number(destRaw.flightPrice || 0),
    budgetDaily: Number(destRaw.budgetDaily || 0),
    midDaily: Number(destRaw.midDaily || 0),
    luxuryDaily: Number(destRaw.luxuryDaily || 0),
  };

  const transports = [
    dest.trainPrice > 0 && { name: t('destination.train'), price: dest.trainPrice },
    dest.busPrice   > 0 && { name: t('destination.bus'),   price: dest.busPrice   },
    dest.flightPrice > 0 && { name: t('destination.plane'), price: dest.flightPrice },
  ].filter(Boolean) as { name: string; price: number }[];

  const pricingRows = [
    { label: t('destination.budget'), value: dest.budgetDaily, color: colors.success },
    { label: t('destination.mid'),    value: dest.midDaily,    color: colors.primary },
    { label: t('destination.luxury'), value: dest.luxuryDaily, color: colors.gold   },
  ];
  const confidence = Number(destRaw.confidenceScore || 0);
  const confidenceLabel =
    confidence >= 0.75 ? 'Tekshirilgan maʼlumot' : confidence >= 0.55 ? 'Oʼrtacha ishonch' : 'Taxminiy maʼlumot';
  const verifiedDate = destRaw.lastVerifiedAt ? new Date(destRaw.lastVerifiedAt).toLocaleDateString('uz-UZ') : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: dest.image }} style={styles.heroImg} resizeMode="cover" />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backArrow}>{t('destination.back')}</Text>
          </TouchableOpacity>
          <View style={styles.ratingPill}>
            <Text style={styles.ratingTxt}>{dest.rating}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.destName}>{dest.name}</Text>
          <Text style={styles.destRegion}>{dest.region}</Text>
          <View style={styles.qualityPill}>
            <Text style={styles.qualityPillTxt}>
              {confidenceLabel}{verifiedDate ? ` • ${verifiedDate}` : ''}
            </Text>
          </View>
          <Text style={styles.destDesc}>{dest.description}</Text>

          <View style={styles.tagsRow}>
            {dest.categories.map((category: string) => (
              <Badge key={category} label={category} variant="primary" />
            ))}
            {dest.tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} label={tag} variant="muted" />
            ))}
          </View>

          <Text style={styles.secTitle}>{t('destination.dailyPrice')}</Text>
          <View style={styles.card}>
            {pricingRows.map((row) => (
              <View key={row.label} style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={[styles.rowVal, { color: row.color }]}>{formatSum(row.value)}</Text>
              </View>
            ))}
          </View>

          {transports.length > 0 && (
            <>
              <Text style={styles.secTitle}>{t('destination.transport')}</Text>
              <View style={styles.card}>
                {transports.map((transport) => (
                  <View key={transport.name} style={styles.row}>
                    <Text style={styles.rowLabel}>{transport.name}</Text>
                    <Text style={[styles.rowVal, { color: colors.primary }]}>{formatSum(transport.price)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={styles.secTitle}>{t('destination.sights')}</Text>
          <View style={styles.card}>
            {dest.landmarks.map((landmark: any, index: number) => (
              <View key={index} style={[styles.row, index < dest.landmarks.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lmName}>{landmark.name}</Text>
                  <Text style={styles.lmDur}>{landmark.duration} {t('destination.minutes')}</Text>
                </View>
                <Text style={styles.lmFee}>{landmark.entryFee > 0 ? formatSum(landmark.entryFee) : t('destination.free')}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.secTitle}>{t('destination.hotels')}</Text>
          <View style={styles.card}>
            {dest.hotels.map((hotel: any, index: number) => (
              <View key={index} style={[styles.row, index < dest.hotels.length - 1 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lmName}>{hotel.name}</Text>
                  <Text style={styles.lmDur}>{hotel.stars} {t('destination.stars')}</Text>
                </View>
                <Text style={[styles.rowVal, { color: colors.gold }]}>{formatSum(hotel.pricePerNight)}{t('destination.perNight')}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.secTitle}>{t('destination.bestSeasons')}</Text>
          <View style={styles.tagsRow}>
            {dest.bestSeasons.map((season: string) => (
              <Badge key={season} label={season} variant="gold" />
            ))}
          </View>

          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/(tabs)/planner')} activeOpacity={0.85}>
          <Text style={styles.ctaTxt}>{t('destination.planFor')} {dest.name}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    notFound: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    notFoundTxt: { fontFamily: FONTS.medium, fontSize: 16, color: colors.textMuted, marginBottom: SPACING.md },
    backFallback: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: colors.primaryPale, borderRadius: RADIUS.md },
    backFallbackTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.primary },
    heroWrap: { height: 260, position: 'relative' },
    heroImg: { width: '100%', height: '100%' },
    backBtn: {
      position: 'absolute',
      top: SPACING.md,
      left: SPACING.md,
      minWidth: 54,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    backArrow: { color: '#fff', fontSize: 12, lineHeight: 16, fontFamily: FONTS.semibold },
    ratingPill: {
      position: 'absolute',
      top: SPACING.md,
      right: SPACING.md,
      backgroundColor: colors.overlay,
      paddingHorizontal: SPACING.md,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
    },
    ratingTxt: { fontFamily: FONTS.medium, fontSize: 13, color: '#fff' },
    body: { padding: SPACING.lg },
    destName: { fontFamily: FONTS.display, fontSize: 28, color: colors.text, marginBottom: 4 },
    destRegion: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textSecondary, marginBottom: SPACING.md },
    qualityPill: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.success,
      backgroundColor: colors.successPale,
      paddingHorizontal: SPACING.md,
      paddingVertical: 5,
      marginBottom: SPACING.md,
    },
    qualityPillTxt: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.success },
    destDesc: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: SPACING.md },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
    secTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text, marginBottom: SPACING.sm },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: SPACING.xl,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
    rowLabel: { fontFamily: FONTS.medium, fontSize: 14, color: colors.text },
    rowVal: { fontFamily: FONTS.semibold, fontSize: 14 },
    lmName: { fontFamily: FONTS.medium, fontSize: 13, color: colors.text },
    lmDur: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    lmFee: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.gold },
    cta: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
    ctaBtn: { backgroundColor: colors.primary, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' },
    ctaTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.textInverse },
  });
}
