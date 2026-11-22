import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { useAuth } from '../src/auth/AuthContext';
import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { bookingsAPI, resolveMediaUrl, type TourBookingItemPayload } from '../src/utils/api';
import { extractApiData } from '../src/utils/auth';

/** Minute-precision countdown; re-rendered by a 30s tick only while something is pending. */
function remaining(t: TFunction, deadline?: string | null) {
  if (!deadline) return t('bookings.noDeadline');
  const distance = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(distance)) return t('bookings.noDeadline');
  if (distance <= 0) return t('bookings.deadlinePassed');
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.max(1, Math.ceil((distance % 3_600_000) / 60_000));
  return hours > 0 ? t('bookings.leftHours', { hours, minutes }) : t('bookings.leftMinutes', { minutes });
}

const STATUS_KEYS: Record<string, string> = {
  pending: 'bookings.statusPending',
  new: 'bookings.statusPending',
  contacted: 'bookings.statusContacted',
  accepted: 'bookings.statusAccepted',
  confirmed: 'bookings.statusConfirmed',
  rejected: 'bookings.statusRejected',
  declined: 'bookings.statusRejected',
  cancelled: 'bookings.statusCancelled',
  canceled: 'bookings.statusCancelled',
  expired: 'bookings.statusExpired',
  completed: 'bookings.statusCompleted',
};

export default function BookingsScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { ready, isLoggedIn } = useAuth();
  const [items, setItems] = useState<TourBookingItemPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const load = useCallback(
    async (refresh = false) => {
      if (!isLoggedIn) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      setError(null);
      try {
        const data = extractApiData<{ items: TourBookingItemPayload[] }>(await bookingsAPI.getMine());
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('bookings.loadError'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLoggedIn, t]
  );

  useFocusEffect(
    useCallback(() => {
      if (ready) void load();
    }, [load, ready])
  );

  // Countdown refresh: only while a pending booking with a deadline is shown.
  const hasPending = items.some((booking) => booking.status === 'pending' && booking.responseDeadlineAt);
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, [hasPending]);

  const guest = ready && !isLoggedIn;
  const showSpinner = !ready || (loading && !guest);

  const retry = () => {
    setLoading(true);
    void load();
  };

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        isLoggedIn ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />
        ) : undefined
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>{t('bookings.eyebrow')}</Text>
          <Text style={styles.title} accessibilityRole="header">{t('bookings.title')}</Text>
        </View>
      </View>

      {showSpinner ? <ActivityIndicator color={colors.primary} /> : null}
      {guest ? (
        <View style={styles.empty}>
          <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
          <Text style={styles.emptyTitle}>{t('bookings.guestTitle')}</Text>
          <Text style={styles.muted}>{t('bookings.guestHint')}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push('/login' as never)}>
            <Text style={styles.primaryText}>{t('bookings.loginCta')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push('/home-tours' as never)}>
            <Text style={styles.ghostBtnText}>{t('home.browseTours')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!showSpinner && !guest && error ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.error} />
          <Text style={styles.emptyTitle}>{t('bookings.loadErrorTitle')}</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.primary} onPress={retry}>
            <Text style={styles.primaryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {!showSpinner && !guest && !error && items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={34} color={colors.primary} />
          <Text style={styles.emptyTitle}>{t('bookings.emptyTitle')}</Text>
          <Text style={styles.muted}>{t('bookings.emptyHint')}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push('/home-tours' as never)}>
            <Text style={styles.primaryText}>{t('home.browseTours')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!guest && !error
        ? items.map((booking) => {
            const imageUrl = resolveMediaUrl(booking.tour?.imageUrl);
            const statusKey = STATUS_KEYS[String(booking.status || '').toLowerCase()];
            return (
              <View style={styles.card} key={booking.id}>
                {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
                <View style={styles.body}>
                  <View style={styles.statusRow}>
                    <Text style={styles.status}>{statusKey ? t(statusKey) : booking.status}</Text>
                    <Text style={styles.price}>
                      {booking.totalEstimate ? `${booking.totalEstimate} ${booking.currency}` : t('bookings.priceNegotiable')}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{booking.tour?.title || t('bookings.tourFallback')}</Text>
                  <Text style={styles.muted}>
                    {[booking.tour?.city, booking.tour?.duration, t('bookings.travelers', { count: booking.travelers })]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.detail}>
                    {t('bookings.agency')}: {booking.agency?.name || t('bookings.notAssigned')}
                  </Text>
                  <Text style={styles.detail}>
                    {t('bookings.contact')}: {booking.agency?.phone || booking.agency?.website || t('bookings.waiting')}
                  </Text>
                  {booking.customerEmail ? <Text style={styles.detail}>Email: {booking.customerEmail}</Text> : null}
                  {booking.message ? (
                    <Text style={styles.detail}>
                      {t('bookings.note')}: {booking.message}
                    </Text>
                  ) : null}
                  {booking.status === 'pending' ? (
                    <View style={styles.countdown}>
                      <Ionicons name="timer-outline" size={16} color={colors.warning} />
                      <Text style={styles.countdownText}>{remaining(t, booking.responseDeadlineAt)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        : null}
      <View style={{ height: Math.max(insets.bottom, 20) + 70 }} />
    </ScrollView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, gap: SPACING.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
    back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { fontFamily: FONTS.semibold, color: colors.primary, fontSize: 10, letterSpacing: 1 },
    title: { fontFamily: FONTS.display, color: colors.text, fontSize: 25 },
    card: { overflow: 'hidden', borderRadius: RADIUS.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
    image: { width: '100%', height: 190 },
    body: { padding: SPACING.lg, gap: 7 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
    status: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.primary, textTransform: 'uppercase' },
    price: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.text },
    cardTitle: { fontFamily: FONTS.display, fontSize: 20, color: colors.text },
    muted: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    detail: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary },
    countdown: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, alignSelf: 'flex-start', marginTop: SPACING.sm, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: colors.warningPale },
    countdownText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.warning },
    empty: { alignItems: 'center', gap: SPACING.md, padding: SPACING.xl, borderRadius: RADIUS.xl, backgroundColor: colors.surface },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 21, color: colors.text },
    primary: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.full, backgroundColor: colors.primary },
    primaryText: { fontFamily: FONTS.semibold, color: colors.textInverse },
    ghostBtn: {
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    ghostBtnText: { fontFamily: FONTS.semibold, color: colors.text },
  });
}
