import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../src/constants/fonts';
import { RADIUS, SPACING } from '../src/constants/spacing';
import { type AppColors, useAppTheme } from '../src/theme/app-theme';
import { bookingsAPI, resolveMediaUrl, type TourBookingItemPayload } from '../src/utils/api';
import { extractApiData } from '../src/utils/auth';
import { getItem, KEYS } from '../src/utils/storage';

function remaining(deadline?: string | null) {
  if (!deadline) return 'Deadline belgilanmagan';
  const distance = new Date(deadline).getTime() - Date.now();
  if (distance <= 0) return 'Javob muddati tugagan';
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  const seconds = Math.floor((distance % 60_000) / 1000);
  return `${hours ? `${hours} soat ` : ''}${minutes} daqiqa ${seconds} soniya`;
}

export default function BookingsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const [items, setItems] = useState<TourBookingItemPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async (refresh = false) => {
    const token = await getItem(KEYS.TOKEN);
    if (!token) {
      setLoading(false);
      return;
    }
    if (refresh) setRefreshing(true);
    try {
      const data = extractApiData<{ items: TourBookingItemPayload[] }>(await bookingsAPI.getMine());
      setItems(data.items || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>WEB VA MOBIL BIR XIL</Text>
          <Text style={styles.title}>Mening bookinglarim</Text>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={34} color={colors.primary} />
          <Text style={styles.emptyTitle}>Booking hali yo‘q</Text>
          <Text style={styles.muted}>Web yoki mobil ilovada shu akkaunt bilan yaratilgan bookinglar shu yerda chiqadi.</Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push('/home-tours' as never)}>
            <Text style={styles.primaryText}>Tourlarni ko‘rish</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {items.map((booking) => {
        const imageUrl = resolveMediaUrl(booking.tour?.imageUrl);
        return (
          <View style={styles.card} key={booking.id}>
            {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
            <View style={styles.body}>
              <View style={styles.statusRow}>
                <Text style={styles.status}>{booking.status}</Text>
                <Text style={styles.price}>{booking.totalEstimate ? `${booking.totalEstimate} ${booking.currency}` : 'Narx kelishiladi'}</Text>
              </View>
              <Text style={styles.cardTitle}>{booking.tour?.title || 'Tour'}</Text>
              <Text style={styles.muted}>{booking.tour?.city} · {booking.tour?.duration} · {booking.travelers} kishi</Text>
              <Text style={styles.detail}>Agentlik: {booking.agency?.name || 'Belgilanmagan'}</Text>
              <Text style={styles.detail}>Kontakt: {booking.agency?.phone || booking.agency?.website || 'Kutilmoqda'}</Text>
              <Text style={styles.detail}>Email: {booking.customerEmail}</Text>
              {booking.message ? <Text style={styles.detail}>Izoh: {booking.message}</Text> : null}
              {booking.status === 'pending' ? (
                <View style={styles.countdown}>
                  <Ionicons name="timer-outline" size={16} color={colors.warning} />
                  <Text style={styles.countdownText}>{remaining(booking.responseDeadlineAt)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
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
  });
}
