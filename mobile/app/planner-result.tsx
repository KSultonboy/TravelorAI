import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import BudgetBreakdownChart from '../src/components/BudgetBreakdownChart';
import DayItineraryCard from '../src/components/DayItineraryCard';
import LottieAnim from '../src/components/LottieAnim';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { primaryGlow } from '../src/constants/effects';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { useTrips } from '../src/hooks/useTrips';
import { type AuthUser } from '../src/utils/auth';
import { formatSum } from '../src/utils/formatter';
import { KEYS, getItem, getJSON } from '../src/utils/storage';
import type { TransportLeg, TripPlan } from '../src/utils/tripPlanner';

const CONFETTI_COLORS = ['#56E0D8', '#2D9CDB', '#F2D6A2', '#5BB4E5', '#3DD9A0', '#F2C14E'];
const PLAN_REFRESH_INTERVAL_MS = 1500;

function Confetti() {
  const items = useRef(
    Array.from({ length: 20 }, (_, index) => ({
      y: new Animated.Value(0),
      x: new Animated.Value(0),
      op: new Animated.Value(1),
      left: `${((index * 5) % 90) + 5}%`,
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    }))
  ).current;

  useEffect(() => {
    Animated.stagger(
      40,
      items.map(({ y, x, op }) =>
        Animated.parallel([
          Animated.timing(y, { toValue: 500, duration: 1600, useNativeDriver: true }),
          Animated.timing(x, { toValue: (Math.random() - 0.5) * 160, duration: 1600, useNativeDriver: true }),
          Animated.sequence([
            Animated.delay(900),
            Animated.timing(op, { toValue: 0, duration: 700, useNativeDriver: true }),
          ]),
        ])
      )
    ).start();
  }, [items]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {items.map((item, index) => (
        <Animated.View
          key={index}
          style={{
            position: 'absolute',
            top: -12,
            left: item.left as any,
            width: 8,
            height: 16,
            borderRadius: 3,
            backgroundColor: item.color,
            opacity: item.op,
            transform: [{ translateY: item.y }, { translateX: item.x }, { rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}

function confidenceColor(level: string | undefined, colors: AppColors): string {
  if (level === 'high') return colors.success;
  if (level === 'medium') return colors.warning;
  return colors.error;
}

function modeLabel(mode: string): string {
  if (mode === 'train') return 'Poyezd';
  if (mode === 'bus') return 'Avtobus';
  if (mode === 'flight') return 'Samolyot';
  if (mode === 'taxi') return 'Taxi';
  if (mode === 'metro') return 'Metro';
  return mode || 'Transport';
}

function TransportLegCard({ leg, colors, styles }: { leg: TransportLeg; colors: AppColors; styles: ReturnType<typeof createStyles> }) {
  const color = leg.confidenceScore >= 0.75 ? colors.success : leg.confidenceScore >= 0.55 ? colors.warning : colors.error;
  return (
    <View style={styles.routeCard}>
      <View style={styles.routeHead}>
        <View style={styles.routePathWrap}>
          <Text style={styles.routeTitle}>{leg.fromCity} {'->'} {leg.toCity}</Text>
          <Text style={styles.routeMeta}>{modeLabel(leg.mode)} • {leg.providerName || 'Provider'} • {leg.duration || `${leg.durationMinutes || 0} min`}</Text>
        </View>
        <View style={[styles.confidencePill, { borderColor: color, backgroundColor: `${color}18` }]}>
          <Text style={[styles.confidencePillTxt, { color }]}>{Math.round((leg.confidenceScore || 0) * 100)}%</Text>
        </View>
      </View>
      <Text style={styles.routePrice}>{formatSum(leg.priceMin)} - {formatSum(leg.priceMax)}</Text>
      {!!leg.scheduleNote && <Text style={styles.routeNote}>{leg.scheduleNote}</Text>}
      {!!leg.whyChosen && <Text style={styles.routeWhy}>{leg.whyChosen}</Text>}
    </View>
  );
}

export default function PlanResultScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);
  const STYLE_LABELS: Record<string, string> = { budget: t('plannerResult.budget'), mid: t('plannerResult.mid'), luxury: t('plannerResult.luxury') };
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { saveTrip } = useTrips(userId);
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const firstPlanLoaded = useRef(false);

  useEffect(() => {
    Promise.all([getJSON<AuthUser>(KEYS.USER), getItem(KEYS.TOKEN)]).then(([u, tok]) => {
      setUserId(u?.id ?? null);
      setToken(tok);
    });
  }, []);

  const loadPlan = useCallback(async () => {
    const savedPlan = await getJSON<TripPlan>(KEYS.CURRENT_PLAN);
    if (!savedPlan) return;

    setPlan((current) => {
      if (
        !current ||
        current.id !== savedPlan.id ||
        current.status !== savedPlan.status ||
        current.updatedAt !== savedPlan.updatedAt
      ) {
        return savedPlan;
      }
      return current;
    });

    if (!firstPlanLoaded.current) {
      firstPlanLoaded.current = true;
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  useEffect(() => {
    loadPlan();
    const refreshTimer = setInterval(loadPlan, PLAN_REFRESH_INTERVAL_MS);
    const timer = setTimeout(() => setShowConfetti(false), 2800);
    return () => {
      clearInterval(refreshTimer);
      clearTimeout(timer);
    };
  }, [loadPlan]);

  const handleSave = async () => {
    if (!plan) return;
    if (!token || !userId) {
      Alert.alert(
        t('plannerResult.loginRequiredTitle', { defaultValue: 'Kirish talab qilinadi' }),
        t('plannerResult.loginRequiredMsg', {
          defaultValue: "Mehmon rejimida reja ko'rishingiz mumkin, lekin tripni saqlash uchun hisobga kiring.",
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.login'), onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    setSaving(true);
    const result = await saveTrip(plan);
    setSaving(false);

    if (result.syncStatus === 'pending') {
      Alert.alert(
        t('plannerResult.saved'),
        t('plannerResult.savedPendingMsg', {
          defaultValue: "Trip saqlandi. Internet qaytgach server bilan sinxronlanadi.",
        }),
        [{ text: t('common.ok'), onPress: () => router.push('/(tabs)/planner') }]
      );
      return;
    }

    setSavedOk(true);
    setTimeout(() => router.push('/(tabs)/planner'), 1700);
  };

  if (!plan) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.noplan}>{t('plannerResult.notFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBack}>
          <Text style={styles.goBackTxt}>{t('plannerResult.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isDraft = plan.status === 'draft';
  const isFailed = plan.status === 'failed';
  const statusTitle = isDraft
    ? t('plannerResult.statusDraftTitle', { defaultValue: 'Dastlabki reja' })
    : isFailed
      ? t('plannerResult.statusFailedTitle', { defaultValue: 'Offline reja' })
      : t('plannerResult.statusFinalTitle', { defaultValue: 'Yakuniy reja' });
  const statusMessage = isDraft
    ? t('plannerResult.statusDraftText', {
        defaultValue: 'AI javobi tayyor bo‘lgach, bu ekran avtomatik yangilanadi.',
      })
    : isFailed
      ? t('plannerResult.statusFailedText', {
          defaultValue: 'Serverga ulanib bo‘lmadi, shuning uchun lokal tavsiya ko‘rsatildi.',
        })
      : t('plannerResult.statusFinalText', {
          defaultValue: plan.source === 'backend' ? 'Backend AI javobi asosida yangilandi.' : 'Lokal reja tayyor.',
        });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {showConfetti && <Confetti />}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>{t('plannerResult.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('plannerResult.title')}</Text>
        <View style={{ width: 80 }} />
      </View>

      <Animated.ScrollView style={{ opacity: fadeAnim }} showsVerticalScrollIndicator={false}>
        <View style={styles.metaBlock}>
          <Text style={styles.tripName}>{plan.title}</Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{plan.duration} {t('plannerResult.days')}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{plan.travelers} {t('plannerResult.people')}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{STYLE_LABELS[plan.style] || plan.style}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statusBox, isDraft ? styles.statusBoxDraft : isFailed ? styles.statusBoxFailed : styles.statusBoxFinal]}>
          {isDraft ? <ActivityIndicator size="small" color={colors.warning} /> : null}
          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusTitle, isFailed ? styles.statusTitleFailed : isDraft ? styles.statusTitleDraft : styles.statusTitleFinal]}>
              {statusTitle}
            </Text>
            <Text style={styles.statusMessage}>{statusMessage}</Text>
          </View>
        </View>

        {plan.warnings && plan.warnings.length > 0 && (
          <View>
            {plan.warnings.map((warning, index) => (
              <View key={`warning-${index}`} style={styles.warning}>
                <Text style={styles.warningTxt}>{warning}</Text>
              </View>
            ))}
          </View>
        )}

        {!!plan.dataConfidence && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>{t('plannerResult.dataConfidence', { defaultValue: 'Maʼlumot ishonchliligi' })}</Text>
            <View style={styles.card}>
              <View style={styles.confidenceRow}>
                <View>
                  <Text style={styles.confidenceTitle}>{plan.dataConfidence.label}</Text>
                  <Text style={styles.confidenceSub}>
                    {Math.round(plan.dataConfidence.score * 100)}% • {plan.sourceSummary?.poiCount || 0} POI • {plan.sourceSummary?.transportRouteCount || 0} transport route
                  </Text>
                </View>
                <View
                  style={[
                    styles.confidenceBadge,
                    {
                      backgroundColor: `${confidenceColor(plan.dataConfidence.level, colors)}18`,
                      borderColor: confidenceColor(plan.dataConfidence.level, colors),
                    },
                  ]}
                >
                  <Text style={[styles.confidenceBadgeTxt, { color: confidenceColor(plan.dataConfidence.level, colors) }]}>
                    {plan.dataConfidence.level}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {!!plan.transportLegs?.length && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>{t('plannerResult.transportRoutes', { defaultValue: 'Transport yoʼnalishlari' })}</Text>
            {plan.transportLegs.map((leg) => (
              <TransportLegCard key={leg.id} leg={leg} colors={colors} styles={styles} />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.secTitle}>{t('plannerResult.breakdown')}</Text>
          <View style={styles.card}>
            <BudgetBreakdownChart breakdown={plan.breakdown} total={plan.totalCost} />
          </View>
        </View>

        {plan.highlights?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>{t('plannerResult.highlights')}</Text>
            <View>
              {plan.highlights.map((highlight, index) => (
                <View key={`h-${index}`} style={styles.highlightRow}>
                  <Text style={styles.hlIcon}>•</Text>
                  <Text style={styles.hlTxt}>{highlight}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.secTitle}>{t('plannerResult.itinerary')}</Text>
          <View>
            {plan.days?.map((day, i) => (
              <DayItineraryCard key={`day-${day.day ?? i}`} day={day} />
            ))}
          </View>
        </View>

        {false && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>{t('plannerResult.tips')}</Text>
            <View style={styles.card}>
              {([] as string[]).map((tip, index) => (
                <Text key={index} style={styles.tipLine}>
                  • {tip}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 150 }} />
      </Animated.ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <Text style={styles.outlineBtnTxt}>{t('common.cancel', { defaultValue: 'Bekor' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.9}>
          <LinearGradient
            colors={colors.gradientPrimary as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtnFill}
          >
            <Text style={styles.saveBtnTxt}>
              {saving
                ? t('plannerResult.saving', { defaultValue: 'Saqlanmoqda...' })
                : t('common.save', { defaultValue: 'Saqlash' })}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {savedOk && (
        <View style={styles.savedOverlay}>
          <LottieAnim name="success" size={150} loop={false} />
          <Text style={styles.savedText}>{t('plannerResult.saved')}</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    noplan: { fontFamily: FONTS.medium, fontSize: 16, color: colors.textMuted, marginBottom: SPACING.md },
    goBack: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, backgroundColor: colors.primaryPale, borderRadius: RADIUS.md },
    goBackTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.primary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    backBtn: { width: 80 },
    backTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.primary },
    headerTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.text },
    metaBlock: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
    tripName: { fontFamily: FONTS.display, fontSize: 22, color: colors.text, marginBottom: SPACING.md },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    badge: { backgroundColor: colors.primaryPale, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
    badgeTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.primary },
    statusBox: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    statusBoxDraft: { backgroundColor: colors.warningPale, borderColor: `${colors.warning}55` },
    statusBoxFailed: { backgroundColor: colors.errorPale, borderColor: `${colors.error}55` },
    statusBoxFinal: { backgroundColor: colors.successPale, borderColor: `${colors.success}55` },
    statusTextWrap: { flex: 1 },
    statusTitle: { fontFamily: FONTS.semibold, fontSize: 13, marginBottom: 2 },
    statusTitleDraft: { color: colors.warning },
    statusTitleFailed: { color: colors.error },
    statusTitleFinal: { color: colors.success },
    statusMessage: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    warning: { marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, backgroundColor: colors.warningPale, borderRadius: RADIUS.md, padding: SPACING.md },
    warningTxt: { fontFamily: FONTS.regular, fontSize: 13, color: colors.warning },
    section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
    secTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.text, marginBottom: SPACING.md },
    card: { backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: colors.borderLight },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    hlIcon: { fontSize: 18, marginRight: SPACING.sm, color: colors.primary },
    hlTxt: { fontFamily: FONTS.medium, fontSize: 14, color: colors.text, flex: 1 },
    tipLine: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 24 },
    confidenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    confidenceTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.text },
    confidenceSub: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted, marginTop: 4 },
    confidenceBadge: {
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
    },
    confidenceBadgeTxt: { fontFamily: FONTS.semibold, fontSize: 11, textTransform: 'uppercase' },
    routeCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: SPACING.sm,
    },
    routeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    routePathWrap: { flex: 1 },
    routeTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.text },
    routeMeta: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, marginTop: 3 },
    routePrice: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.primary, marginTop: SPACING.sm },
    routeNote: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    routeWhy: { fontFamily: FONTS.medium, fontSize: 12, color: colors.text, marginTop: 4 },
    confidencePill: {
      borderWidth: 1,
      borderRadius: RADIUS.full,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    confidencePillTxt: { fontFamily: FONTS.semibold, fontSize: 11 },
    footer: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    outlineBtn: {
      flex: 1,
      height: 52,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineBtnTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.primary },
    saveBtn: {
      flex: 2,
      height: 52,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
      ...primaryGlow(colors),
    },
    saveBtnFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.onGradient },
    savedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    savedText: { fontFamily: FONTS.semibold, fontSize: 18, color: colors.textInverse, marginTop: SPACING.sm },
  });
}
