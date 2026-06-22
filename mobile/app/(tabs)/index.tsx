import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
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

import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { aiGlowShadow } from '../../src/constants/effects';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { homeAPI } from '../../src/utils/api';
import { extractApiData } from '../../src/utils/auth';
import { normalizeTours, serializeTourParam, type HomeTourItem } from '../../src/utils/homeContent';
import { STITCH_IMAGES } from '../../src/components/stitch/StitchMobile';

const HOW_STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'search-outline', title: 'Turni tanlang', text: 'Yo‘nalish, narx va muddat bo‘yicha filtrlang, batafsil ko‘ring.' },
  { icon: 'chatbubbles-outline', title: 'Agentlik bilan bog‘laning', text: 'To‘g‘ridan-to‘g‘ri, vositachisiz — bepul so‘rov yuboring.' },
  { icon: 'airplane-outline', title: 'Sayohatga chiqing', text: 'Tasdiqlangan agentlik bilan bemalol safarga otlaning.' },
];

const WHY_POINTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'shield-checkmark-outline', text: 'Faqat tasdiqlangan agentliklar turlari' },
  { icon: 'pricetags-outline', text: 'Foydalanish mutlaqo bepul' },
  { icon: 'flash-outline', text: 'Tez javob, to‘g‘ridan-to‘g‘ri aloqa' },
];

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);

  const [tours, setTours] = useState<HomeTourItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const payload = extractApiData<{ items?: HomeTourItem[]; total?: number }>(
          await homeAPI.getTours({ agencyOnly: true, limit: 6, page: 1 })
        );
        if (!alive) return;
        setTours(normalizeTours(payload?.items || []));
        setTotal(Number.isFinite(Number(payload?.total)) ? Number(payload?.total) : 0);
      } catch {
        if (alive) { setTours([]); setTotal(0); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const goTours = () => router.push('/(tabs)/tours' as any);
  const openTour = (item: HomeTourItem) =>
    router.push({ pathname: '/tour-details', params: { tour: serializeTourParam(item) } } as any);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.sm }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>Travelor<Text style={{ color: colors.aiAccent }}>AI</Text></Text>
          <Text style={styles.brandSub}>Tasdiqlangan turlar bozori</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.82} onPress={() => router.push('/(tabs)/profile' as any)}>
          <Ionicons name="person-outline" size={19} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Banner */}
      <ImageBackground source={{ uri: STITCH_IMAGES.hero }} style={styles.hero} imageStyle={styles.heroImg}>
        <LinearGradient
          colors={['rgba(3,10,20,0.15)', 'rgba(3,10,20,0.86)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroBody}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={12} color={colors.onGradient} />
            <Text style={styles.heroBadgeText}>Bepul · Vositachisiz</Text>
          </View>
          <Text style={styles.heroTitle}>Ishonchli{'\n'}sayohat turlari</Text>
          <Text style={styles.heroSub}>
            Tasdiqlangan agentliklarning eng yaxshi turlarini bir joyda ko‘ring va to‘g‘ridan-to‘g‘ri bog‘laning.
          </Text>
          <TouchableOpacity style={styles.heroCta} activeOpacity={0.9} onPress={goTours}>
            <LinearGradient
              colors={colors.gradientPrimary as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.heroCtaText}>Turlarni ko‘rish</Text>
            <Ionicons name="arrow-forward" size={17} color={colors.onGradient} />
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* How it works */}
      <Text style={styles.h2}>Qanday ishlaydi?</Text>
      <View style={styles.stepWrap}>
        {HOW_STEPS.map((step, i) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepIcon}>
              <Ionicons name={step.icon} size={20} color={colors.aiAccent} />
              <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Featured tours */}
      <View style={styles.sectionRow}>
        <Text style={styles.h2}>Tavsiya etilgan turlar</Text>
        <TouchableOpacity onPress={goTours} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>Barchasi{total ? ` (${total})` : ''}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
      ) : tours.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="briefcase-outline" size={24} color={colors.success} />
          <Text style={styles.emptyText}>Hozircha tur yo‘q. Tez orada qo‘shiladi.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
        >
          {tours.map((item) => (
            <TouchableOpacity key={item.id} style={styles.tourCard} activeOpacity={0.9} onPress={() => openTour(item)}>
              <TourThumb imageUrl={item.imageUrl || null} styles={styles} colors={colors} badge={item.badge} />
              <View style={styles.tourBody}>
                <Text style={styles.tourTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.tourCity} numberOfLines={1}>{item.city || 'Global'}{item.duration ? ` · ${item.duration}` : ''}</Text>
                <View style={styles.tourMeta}>
                  <View style={styles.tourRating}>
                    <Ionicons name="star" size={11} color={colors.gold} />
                    <Text style={styles.tourRatingText}>{Number(item.rating || 0).toFixed(1)}</Text>
                  </View>
                  <Text style={styles.tourPrice} numberOfLines={1}>{item.price || 'So‘rovda'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Why TravelorAI */}
      <View style={styles.whyCard}>
        <Text style={styles.whyTitle}>Nega TravelorAI?</Text>
        {WHY_POINTS.map((p) => (
          <View key={p.text} style={styles.whyRow}>
            <View style={styles.whyIcon}><Ionicons name={p.icon} size={16} color={colors.aiAccent} /></View>
            <Text style={styles.whyText}>{p.text}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.whyCta} activeOpacity={0.9} onPress={goTours}>
          <Text style={styles.whyCtaText}>Hoziroq turlarni ko‘rish</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ height: 96 + Math.max(insets.bottom, 22) }} />
    </ScrollView>
  );
}

function TourThumb({
  imageUrl, styles, colors, badge,
}: {
  imageUrl: string | null;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
  badge?: string;
}) {
  const Badge = (
    <View style={styles.tourBadge}><Text style={styles.tourBadgeText}>{badge || 'Tur'}</Text></View>
  );
  if (imageUrl) {
    return (
      <ImageBackground source={{ uri: imageUrl }} style={styles.tourImg} imageStyle={styles.tourImgRadius}>
        <View style={styles.tourScrim} />
        {Badge}
      </ImageBackground>
    );
  }
  return (
    <View style={[styles.tourImg, styles.tourPlaceholder]}>
      <Ionicons name="map-outline" size={22} color={colors.onGradient} />
      {Badge}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.lg, gap: SPACING.md },

    topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    brand: { fontFamily: FONTS.display, fontSize: 22, color: colors.text },
    brandSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
    iconBtn: {
      width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    },

    hero: {
      minHeight: 280, borderRadius: 28, overflow: 'hidden', justifyContent: 'flex-end',
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.2, shadowRadius: 26, elevation: 8,
    },
    heroImg: { borderRadius: 28 },
    heroBody: { padding: SPACING.xl, gap: SPACING.sm },
    heroBadge: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.full, paddingHorizontal: 11, paddingVertical: 6,
    },
    heroBadgeText: { fontFamily: FONTS.semibold, fontSize: 11, color: '#fff' },
    heroTitle: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 36, color: '#fff' },
    heroSub: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.9)' },
    heroCta: {
      marginTop: SPACING.sm, alignSelf: 'flex-start', height: 50, borderRadius: RADIUS.full, overflow: 'hidden',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: SPACING.xl,
    },
    heroCtaText: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.onGradient },

    h2: { fontFamily: FONTS.display, fontSize: 21, color: colors.text, marginTop: SPACING.xs },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xs },
    sectionAction: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.primary },

    stepWrap: { gap: SPACING.sm },
    stepCard: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md,
      borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    },
    stepIcon: {
      width: 48, height: 48, borderRadius: 16, backgroundColor: colors.aiAccentPale,
      alignItems: 'center', justifyContent: 'center', ...aiGlowShadow(colors),
    },
    stepNum: {
      position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    stepNumText: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.onGradient },
    stepCopy: { flex: 1, gap: 3 },
    stepTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text },
    stepText: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },

    loadingBox: { paddingVertical: SPACING.xl, alignItems: 'center' },
    emptyBox: {
      paddingVertical: SPACING.xl, alignItems: 'center', gap: SPACING.sm, borderRadius: 20,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    },
    emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },

    railContent: { gap: SPACING.md, paddingRight: SPACING.lg, paddingVertical: 2 },
    tourCard: {
      width: 224, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden',
      borderWidth: 1, borderColor: colors.borderLight,
      shadowColor: colors.shadow, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 3,
    },
    tourImg: { height: 126, padding: SPACING.sm },
    tourImgRadius: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
    tourPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    tourScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,15,28,0.26)' },
    tourBadge: {
      alignSelf: 'flex-start', borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.26)',
      paddingHorizontal: 8, paddingVertical: 4,
    },
    tourBadgeText: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 0.5, color: '#fff' },
    tourBody: { padding: SPACING.md, gap: 6 },
    tourTitle: { fontFamily: FONTS.display, fontSize: 15, lineHeight: 19, color: colors.text },
    tourCity: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted },
    tourMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
    tourRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    tourRatingText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.text },
    tourPrice: { flex: 1, textAlign: 'right', fontFamily: FONTS.semibold, fontSize: 11, color: colors.success },

    whyCard: {
      marginTop: SPACING.sm, borderRadius: 24, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.borderLight, padding: SPACING.lg, gap: SPACING.sm,
    },
    whyTitle: { fontFamily: FONTS.display, fontSize: 18, color: colors.text, marginBottom: 2 },
    whyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    whyIcon: {
      width: 34, height: 34, borderRadius: 12, backgroundColor: colors.aiAccentPale,
      alignItems: 'center', justifyContent: 'center',
    },
    whyText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13, color: colors.textSecondary },
    whyCta: {
      marginTop: SPACING.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      height: 48, borderRadius: RADIUS.full, backgroundColor: colors.aiAccentPale,
    },
    whyCtaText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.primary },
  });
}
