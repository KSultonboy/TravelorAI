import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '../../constants/fonts';
import { RADIUS, SPACING } from '../../constants/spacing';
import { type AppColors, useAppTheme } from '../../theme/app-theme';
import { useTrips } from '../../hooks/useTrips';
import { plannerAPI, yandexAPI, type PoiPayload } from '../../utils/api';
import { type AuthUser } from '../../utils/auth';
import { formatSum } from '../../utils/formatter';
import { KEYS, getJSON, saveJSON } from '../../utils/storage';
import type { Activity, DayPlan, TripPlan } from '../../utils/tripPlanner';

const INTEREST_OPTIONS = [
  { key: 'culture', label: 'Madaniyat' },
  { key: 'food', label: 'Gastronomiya' },
  { key: 'nature', label: 'Tabiat' },
  { key: 'history', label: 'Tarix' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'family', label: 'Family' },
];

type TripFilter = 'all' | 'active' | 'draft' | 'archived' | 'synced';
type AiStyle = 'budget' | 'mid' | 'luxury';

interface AiFormState {
  destination: string;
  duration: string;
  travelers: string;
  budget: string;
  style: AiStyle;
  interests: string[];
}

interface ManualFormState {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: string;
  budget: string;
  notes: string;
}

function usePlannerStyles() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return { colors, insets, styles: createStyles(colors) };
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayISO(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseISO(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function addDaysISO(startDate: string, days: number): string {
  const date = parseISO(startDate) || parseISO(todayISO())!;
  date.setDate(date.getDate() + Math.max(0, days));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDuration(startDate?: string, endDate?: string, fallback = 1): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!start || !end) return fallback;
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  return Number.isFinite(days) && days > 0 ? Math.min(days, 30) : fallback;
}

function toNumber(value: string, fallback = 0): number {
  const parsed = Number(String(value || '').replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractApiData(response: any): any {
  if (response?.data && typeof response.data === 'object') return response.data;
  return response;
}

function getActivityKey(tripId: string, day: DayPlan, activity: Activity, index: number): string {
  return `${tripId}:d${day.day}:a${index}:${activity.name}`;
}

function getTripProgress(trip: TripPlan): number {
  const totalActivities = (trip.days || []).reduce((sum, day) => sum + (day.activities?.length || 0), 0);
  if (trip.status === 'draft' && totalActivities === 0) return 15;
  if (totalActivities === 0) return trip.status === 'final' ? 70 : 20;
  const visited = trip.progress?.visitedStopIds?.length || 0;
  return Math.min(100, Math.max(trip.status === 'draft' ? 12 : 28, Math.round((visited / totalActivities) * 100)));
}

function getCover(plan: TripPlan | null | undefined): string {
  return plan?.coverImage || '';
}

function formatTripDates(trip: TripPlan): string {
  if (trip.startDate && trip.endDate) return `${trip.startDate} - ${trip.endDate}`;
  if (trip.startDate) return trip.startDate;
  return `${trip.duration || 1} kun`;
}

function getStatusCopy(trip: TripPlan) {
  if (trip.status === 'archived') return { label: 'Arxiv', icon: 'archive-outline' as const };
  if (trip.status === 'draft') return { label: 'Draft', icon: 'create-outline' as const };
  if (trip.syncStatus === 'pending') return { label: 'Sinxron kutyapti', icon: 'cloud-upload-outline' as const };
  if (trip.syncStatus === 'failed') return { label: 'Offline saqlandi', icon: 'cloud-offline-outline' as const };
  return { label: 'Tayyor', icon: 'checkmark-circle-outline' as const };
}

function buildDays(destination: string, duration: number): DayPlan[] {
  return Array.from({ length: Math.max(1, duration) }, (_, index) => ({
    day: index + 1,
    destination,
    activities: [],
    hotel: '',
    hotelCost: 0,
  }));
}

function createManualPlan(form: ManualFormState): TripPlan {
  const now = new Date().toISOString();
  const duration = getDuration(form.startDate, form.endDate, 1);
  const destination = form.destination.trim();
  const budget = toNumber(form.budget);
  const travelers = Math.min(8, Math.max(1, toNumber(form.travelers, 1)));
  return {
    id: makeId('manual_trip'),
    title: form.title.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    notes: form.notes.trim(),
    totalCost: budget,
    duration,
    travelers,
    style: 'mid',
    destinations: [destination],
    transportLegs: [],
    breakdown: {
      transport: Math.round(budget * 0.2),
      accommodation: Math.round(budget * 0.32),
      food: Math.round(budget * 0.25),
      attractions: Math.round(budget * 0.15),
      misc: Math.max(0, budget - Math.round(budget * 0.92)),
    },
    days: buildDays(destination, duration),
    warnings: [],
    highlights: [],
    tips: [],
    dataConfidence: { score: 0.62, level: 'medium', label: "Qo'lda kiritilgan reja" },
    sourceSummary: { generatedFrom: ['manual'], destinationCount: 1, poiCount: 0 },
    verificationWarnings: [],
    status: 'draft',
    source: 'local',
    syncStatus: 'pending',
    progress: { visitedStopIds: [], notes: {}, updatedAt: now },
    updatedAt: now,
    createdAt: now,
  };
}

function unwrapYandexItems(response: any): PoiPayload[] {
  const payload = extractApiData(response);
  if (Array.isArray(payload?.items)) return payload.items as PoiPayload[];
  if (Array.isArray(payload)) return payload as PoiPayload[];
  return [];
}

function normalizeContextPlace(place: PoiPayload, fallbackCity: string) {
  const name = String(place?.name || '').trim();
  if (!name) return null;

  const lat = Number(place.lat);
  const lng = Number(place.lng);
  return {
    id: place.id,
    name,
    city: String(fallbackCity || place.city || '').trim() || fallbackCity,
    type: String(place.type || 'landmark').trim() || 'landmark',
    subtype: place.subtype || null,
    info: String(place.info || place.description || '').trim(),
    description: place.description || place.info || '',
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    price: Number.isFinite(Number(place.price)) ? Number(place.price) : undefined,
    rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : undefined,
    icon: place.icon,
    source: place.source || 'yandex_search',
    confidenceScore: Number.isFinite(Number(place.confidenceScore)) ? Number(place.confidenceScore) : 0.68,
  };
}

function estimatedContextPrice(type: string, style: AiStyle): number {
  if (type === 'restaurant') return style === 'budget' ? 60_000 : style === 'mid' ? 110_000 : 190_000;
  if (type === 'hotel') return style === 'budget' ? 220_000 : style === 'mid' ? 420_000 : 850_000;
  if (type === 'transport') return style === 'budget' ? 35_000 : style === 'mid' ? 60_000 : 110_000;
  return style === 'budget' ? 40_000 : style === 'mid' ? 75_000 : 140_000;
}

async function loadAiPoiContext(destination: string, form: AiFormState) {
  const geocodeItems = unwrapYandexItems(await yandexAPI.geocode({ query: destination, results: 1 }));
  const center = geocodeItems[0];
  const lat = Number(center?.lat);
  const lng = Number(center?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const searchItems = unwrapYandexItems(await yandexAPI.searchPlaces({ query: destination, type: 'landmark' }));
    const context = searchItems.map((item) => normalizeContextPlace(item, destination)).filter(Boolean);
    return {
      poiContext: context,
      recommendedPoiNames: context.slice(0, 10).map((item: any) => item.name),
      analysisContext: {
        city: destination,
        totalPoi: context.length,
        typeCounts: { landmark: context.length, restaurant: 0, hotel: 0, transport: 0 },
        avgPriceByType: {},
        estimatedDayCost: estimatedContextPrice('landmark', form.style) * 2,
        estimatedTripCost: estimatedContextPrice('landmark', form.style) * 2 * toNumber(form.duration, 3),
        source: 'yandex_search_no_center',
      },
    };
  }

  const types = ['landmark', 'restaurant', 'hotel', 'transport'] as const;
  const responses = await Promise.all(
    types.map((type) =>
      yandexAPI
        .getPlacesNearby({ lat, lng, radiusKm: type === 'transport' ? 12 : 18, type, limit: type === 'landmark' ? 45 : 28 })
        .then(unwrapYandexItems)
        .catch(() => [] as PoiPayload[])
    )
  );

  const rawPlaces = responses.flat();
  const seen = new Set<string>();
  const poiContext = rawPlaces
    .map((item) => normalizeContextPlace(item, destination))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => {
      const key = `${String(item.name).toLowerCase()}|${item.type}|${Number(item.lat || 0).toFixed(4)}|${Number(item.lng || 0).toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 120);

  const typeCounts = poiContext.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const avgPriceByType = Object.fromEntries(
    Object.keys(typeCounts).map((type) => [type, estimatedContextPrice(type, form.style)])
  );
  const dailyEstimate =
    estimatedContextPrice('hotel', form.style) +
    estimatedContextPrice('restaurant', form.style) * 2 +
    estimatedContextPrice('landmark', form.style) * 2 +
    estimatedContextPrice('transport', form.style);

  return {
    poiContext,
    recommendedPoiNames: poiContext
      .filter((item) => item.type === 'landmark' || item.type === 'restaurant')
      .slice(0, 14)
      .map((item) => item.name),
    analysisContext: {
      city: destination,
      center: { lat, lng },
      totalPoi: poiContext.length,
      typeCounts,
      avgPriceByType,
      estimatedDayCost: dailyEstimate,
      estimatedTripCost: dailyEstimate * Math.max(1, toNumber(form.duration, 3)),
      source: 'yandex_runtime_context',
    },
  };
}

function normalizeGeneratedPlan(rawPlan: any, form: AiFormState): TripPlan {
  const raw = extractApiData(rawPlan) || {};
  const now = new Date().toISOString();
  const duration = Math.min(14, Math.max(1, Number(raw.duration || toNumber(form.duration, 3))));
  const totalCost = Number(raw.totalCost || raw.estimatedCost || toNumber(form.budget, 1500000));
  const destination = form.destination.trim();
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  const days: DayPlan[] = rawDays.length
    ? rawDays.map((day: any, index: number) => ({
        day: Number(day.day || day.dayNumber || index + 1),
        destination: String(day.destination || day.city || destination),
        activities: Array.isArray(day.activities) ? day.activities : [],
        hotel: String(day.hotel || day.accommodation?.name || ''),
        hotelCost: Number(day.hotelCost || day.accommodation?.cost || 0),
      }))
    : buildDays(destination, duration);

  return {
    id: String(raw.id || makeId('ai_trip')),
    title: String(raw.title || `${destination} AI marshruti`),
    startDate: String(raw.startDate || todayISO()),
    endDate: String(raw.endDate || addDaysISO(String(raw.startDate || todayISO()), duration - 1)),
    coverImage: raw.coverImage || undefined,
    totalCost,
    duration,
    travelers: Number(raw.travelers || toNumber(form.travelers, 1)),
    style: String(raw.style || form.style),
    destinations: Array.isArray(raw.destinations) && raw.destinations.length ? raw.destinations : [destination],
    transportLegs: Array.isArray(raw.transportLegs) ? raw.transportLegs : [],
    breakdown: raw.breakdown || {
      transport: Math.round(totalCost * 0.18),
      accommodation: Math.round(totalCost * 0.32),
      food: Math.round(totalCost * 0.25),
      attractions: Math.round(totalCost * 0.18),
      misc: Math.round(totalCost * 0.07),
    },
    days,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    tips: Array.isArray(raw.tips) ? raw.tips : [],
    dataConfidence: raw.dataConfidence || { score: 0.72, level: 'medium', label: 'Backend AI reja' },
    sourceSummary: raw.sourceSummary || { generatedFrom: ['backend_ai'] },
    alternatives: raw.alternatives,
    verificationWarnings: Array.isArray(raw.verificationWarnings) ? raw.verificationWarnings : [],
    status: 'final',
    source: 'backend',
    syncStatus: 'pending',
    progress: { visitedStopIds: [], notes: {}, updatedAt: now },
    updatedAt: now,
    createdAt: String(raw.createdAt || now),
  };
}

function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors, styles } = usePlannerStyles();
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/side-menu' as any)} activeOpacity={0.82}>
        <Ionicons name="menu" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {right || (
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.82}>
          <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function CloseHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const { colors, styles } = usePlannerStyles();
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.back()} activeOpacity={0.82}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {action || <View style={styles.iconButtonGhost} />}
    </View>
  );
}

function loadUserId(setUserId: (id: string | null) => void) {
  let active = true;
  getJSON<AuthUser>(KEYS.USER).then((user) => {
    if (active) setUserId(user?.id ?? null);
  });
  return () => {
    active = false;
  };
}

export function MyPlansScreen() {
  const { colors, insets, styles } = usePlannerStyles();
  const safeBottom = Math.max(insets.bottom, 22);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TripFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { trips, loading, loadTrips, deleteTrip, duplicateTrip, archiveTrip } = useTrips(userId);

  useFocusEffect(useCallback(() => loadUserId(setUserId), []));

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  const filteredTrips = useMemo(() => {
    if (filter === 'active') return trips.filter((trip) => trip.status !== 'draft' && trip.status !== 'archived');
    if (filter === 'draft') return trips.filter((trip) => trip.status === 'draft');
    if (filter === 'archived') return trips.filter((trip) => trip.status === 'archived');
    if (filter === 'synced') return trips.filter((trip) => trip.syncStatus === 'synced');
    return trips;
  }, [filter, trips]);

  const stats = useMemo(() => {
    const active = trips.filter((trip) => trip.status !== 'draft' && trip.status !== 'archived').length;
    const draft = trips.filter((trip) => trip.status === 'draft').length;
    const archived = trips.filter((trip) => trip.status === 'archived').length;
    const destinations = new Set(trips.flatMap((trip) => trip.destinations || [])).size;
    return { total: trips.length, active, draft, archived, destinations };
  }, [trips]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadTrips();
    } finally {
      setRefreshing(false);
    }
  };

  const confirmDelete = (trip: TripPlan) => {
    Alert.alert("Rejani o'chirish", `${trip.title} o'chirilsinmi?`, [
      { text: 'Bekor', style: 'cancel' },
      {
        text: "O'chirish",
        style: 'destructive',
        onPress: () => {
          void deleteTrip(trip.id);
        },
      },
    ]);
  };

  const confirmDuplicate = (trip: TripPlan) => {
    Alert.alert('Rejani nusxalash', `${trip.title} asosida yangi draft yaratiladi.`, [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'Nusxalash',
        onPress: async () => {
          const result = await duplicateTrip(trip);
          await loadTrips();
          router.push({ pathname: '/multi-day-planner', params: { tripId: result.trip.id } } as any);
        },
      },
    ]);
  };

  const confirmArchive = (trip: TripPlan) => {
    Alert.alert('Arxivga olish', `${trip.title} arxivga olinsinmi?`, [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'Arxivlash',
        onPress: async () => {
          await archiveTrip(trip);
          await loadTrips();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={[styles.content, { paddingBottom: 132 + safeBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.success} colors={[colors.success]} />}
      >
        <Header title="Planner" subtitle="Mening sayohatlarim" />

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroKicker}>Trip workspace</Text>
            <Text style={styles.heroTitle}>Sayohatlaringiz bir joyda</Text>
            <Text style={styles.heroText}>{"AI reja, qo'lda yaratilgan draftlar, progress va sinxron holati shu yerda boshqariladi."}</Text>
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroPrimary} onPress={() => router.push('/ai-trip-setup' as any)} activeOpacity={0.86}>
              <Ionicons name="sparkles-outline" size={16} color={colors.textInverse} />
              <Text style={styles.heroPrimaryText}>AI yaratish</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroGhost} onPress={() => router.push('/manual-trip' as any)} activeOpacity={0.86}>
              <Ionicons name="create-outline" size={16} color={colors.text} />
              <Text style={styles.heroGhostText}>{"Qo'lda"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatTile label="Jami" value={String(stats.total)} icon="albums-outline" />
          <StatTile label="Tayyor" value={String(stats.active)} icon="checkmark-done-outline" />
          <StatTile label="Draft" value={String(stats.draft)} icon="create-outline" />
          <StatTile label="Arxiv" value={String(stats.archived)} icon="archive-outline" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[
            ['all', 'Barchasi'],
            ['active', 'Tayyor'],
            ['draft', 'Draftlar'],
            ['archived', 'Arxiv'],
            ['synced', 'Serverda'],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
              onPress={() => setFilter(key as TripFilter)}
              activeOpacity={0.82}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading && trips.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.success} />
            <Text style={styles.mutedText}>Rejalar yuklanmoqda...</Text>
          </View>
        ) : null}

        {filteredTrips.length === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="map-outline" size={30} color={colors.success} />
            </View>
            <Text style={styles.emptyTitle}>{"Hali sayohat rejasi yo'q"}</Text>
            <Text style={styles.emptyText}>{"AI bilan tezkor reja yarating yoki qo'lda draft ochib, keyin faoliyatlarni qo'shib boring."}</Text>
            <TouchableOpacity style={styles.primaryWide} onPress={() => router.push('/ai-trip-setup' as any)} activeOpacity={0.86}>
              <Ionicons name="sparkles-outline" size={16} color={colors.textInverse} />
              <Text style={styles.primaryWideText}>AI bilan boshlash</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryWide} onPress={() => router.push('/manual-trip' as any)} activeOpacity={0.86}>
              <Text style={styles.secondaryWideText}>{"Qo'lda yaratish"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.tripList}>
          {filteredTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onArchive={() => confirmArchive(trip)}
              onDelete={() => confirmDelete(trip)}
              onDuplicate={() => confirmDuplicate(trip)}
            />
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { bottom: safeBottom + 94 }]}
        onPress={() => router.push('/add-plan' as any)}
        activeOpacity={0.86}
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </TouchableOpacity>
    </View>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors, styles } = usePlannerStyles();
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={17} color={colors.success} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ImageSurface({
  imageUrl,
  style,
  imageStyle,
  children,
}: {
  imageUrl?: string;
  style: any;
  imageStyle?: any;
  children: React.ReactNode;
}) {
  const { styles } = usePlannerStyles();
  if (imageUrl) {
    return (
      <ImageBackground source={{ uri: imageUrl }} style={style} imageStyle={imageStyle}>
        {children}
      </ImageBackground>
    );
  }

  return <View style={[style, styles.generatedCover]}>{children}</View>;
}

function TripCard({
  trip,
  onArchive,
  onDelete,
  onDuplicate,
}: {
  trip: TripPlan;
  onArchive: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { colors, styles } = usePlannerStyles();
  const progress = getTripProgress(trip);
  const status = getStatusCopy(trip);
  const destination = trip.destinations?.join(', ') || 'Global';
  const coverImage = getCover(trip);

  return (
    <TouchableOpacity
      style={styles.tripCard}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/multi-day-planner', params: { tripId: trip.id } } as any)}
    >
      <ImageSurface imageUrl={coverImage} style={styles.tripCover} imageStyle={styles.tripCoverImage}>
        <View style={styles.coverScrim} />
        <View style={styles.tripCoverTop}>
          <View style={styles.statusPill}>
            <Ionicons name={status.icon} size={12} color={colors.success} />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
          <View style={styles.coverActions}>
            <TouchableOpacity style={styles.coverIconBtn} onPress={onDuplicate} activeOpacity={0.82}>
              <Ionicons name="copy-outline" size={15} color={colors.textInverse} />
            </TouchableOpacity>
            {trip.status !== 'archived' ? (
              <TouchableOpacity style={styles.coverIconBtn} onPress={onArchive} activeOpacity={0.82}>
                <Ionicons name="archive-outline" size={15} color={colors.textInverse} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.coverIconBtn} onPress={onDelete} activeOpacity={0.82}>
              <Ionicons name="trash-outline" size={15} color={colors.textInverse} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tripCoverBottom}>
          <Text style={styles.tripTitle} numberOfLines={2}>{trip.title}</Text>
          <Text style={styles.tripSubtitle} numberOfLines={1}>{destination} · {formatTripDates(trip)}</Text>
        </View>
      </ImageSurface>
      <View style={styles.tripBody}>
        <View style={styles.tripMetaRow}>
          <MetaPill icon="calendar-outline" label={`${trip.duration || 1} kun`} />
          <MetaPill icon="people-outline" label={`${trip.travelers || 1} kishi`} />
          <MetaPill icon="wallet-outline" label={trip.totalCost ? formatSum(trip.totalCost) : 'Budjet yoq'} />
        </View>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors, styles } = usePlannerStyles();
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.metaPillText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function AddPlanOptionsScreen() {
  const { insets, styles } = usePlannerStyles();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <CloseHeader title="Yangi sayohat" />
      <View style={styles.optionHero}>
        <Text style={styles.heroKicker}>Create trip</Text>
        <Text style={styles.optionTitle}>Rejani qanday boshlaymiz?</Text>
        <Text style={styles.heroText}>{"AI tezkor itinerary yaratadi, qo'lda rejada esa siz hammasini o'zingiz boshqarasiz."}</Text>
      </View>
      <View style={styles.optionSheet}>
        <OptionRow
          icon="sparkles-outline"
          title="AI orqali yaratish"
          subtitle="Manzil, budjet va qiziqishlardan avtomatik itinerary."
          onPress={() => router.replace('/ai-trip-setup' as any)}
          dark
        />
        <OptionRow
          icon="create-outline"
          title="Qo'lda yaratish"
          subtitle="Draft oching, kunlar va activitylarni keyin to'ldiring."
          onPress={() => router.replace('/manual-trip' as any)}
        />
        <TouchableOpacity style={styles.secondaryWide} onPress={() => router.back()} activeOpacity={0.84}>
          <Text style={styles.secondaryWideText}>Bekor qilish</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OptionRow({
  icon,
  title,
  subtitle,
  onPress,
  dark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  dark?: boolean;
}) {
  const { colors, styles } = usePlannerStyles();
  return (
    <TouchableOpacity style={[styles.optionRow, dark && styles.optionRowDark]} onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.optionIcon, dark && { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
        <Ionicons name={icon} size={19} color={dark ? colors.textInverse : colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionRowTitle, dark && { color: colors.textInverse }]}>{title}</Text>
        <Text style={[styles.optionRowSub, dark && { color: 'rgba(255,255,255,0.68)' }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={dark ? colors.textInverse : colors.textMuted} />
    </TouchableOpacity>
  );
}

export function ManualTripScreen() {
  const { colors, insets, styles } = usePlannerStyles();
  const [userId, setUserId] = useState<string | null>(null);
  const { saveTrip } = useTrips(userId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ManualFormState>({
    title: '',
    destination: '',
    startDate: todayISO(),
    endDate: addDaysISO(todayISO(), 2),
    travelers: '1',
    budget: '1500000',
    notes: '',
  });

  useFocusEffect(useCallback(() => loadUserId(setUserId), []));

  const update = (key: keyof ManualFormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) return Alert.alert('Sarlavha kerak', 'Trip sarlavhasini kiriting.');
    if (!form.destination.trim()) return Alert.alert('Manzil kerak', 'Shahar yoki mamlakat nomini kiriting.');
    if (!parseISO(form.startDate) || !parseISO(form.endDate)) return Alert.alert('Sana xato', 'Sanani YYYY-MM-DD formatida kiriting.');

    setSaving(true);
    try {
      const result = await saveTrip(createManualPlan(form));
      router.replace({ pathname: '/multi-day-planner', params: { tripId: result.trip.id } } as any);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CloseHeader
          title="Qo'lda yaratish"
          action={
            <TouchableOpacity style={styles.smallSaveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.84}>
              {saving ? <ActivityIndicator color={colors.textInverse} size="small" /> : <Ionicons name="save-outline" size={14} color={colors.textInverse} />}
              <Text style={styles.smallSaveText}>Saqlash</Text>
            </TouchableOpacity>
          }
        />

        <ImageSurface style={styles.manualCover} imageStyle={styles.manualCoverImage}>
          <View style={styles.coverScrim} />
          <Text style={styles.manualCoverTitle}>{"O'zingizning marshrutingiz"}</Text>
          <Text style={styles.manualCoverSub}>{"Draft yarating, keyin uni kunma-kun to'ldiring."}</Text>
        </ImageSurface>

        <View style={styles.formCard}>
          <Input label="Trip title" value={form.title} onChangeText={(v) => update('title', v)} placeholder="Sayohat sarlavhasi" icon="text-outline" />
          <Input label="Asosiy manzil" value={form.destination} onChangeText={(v) => update('destination', v)} placeholder="Shahar yoki mamlakat" icon="location-outline" />
          <View style={styles.twoCol}>
            <Input label="Boshlanish" value={form.startDate} onChangeText={(v) => update('startDate', v)} placeholder="YYYY-MM-DD" icon="calendar-outline" />
            <Input label="Tugash" value={form.endDate} onChangeText={(v) => update('endDate', v)} placeholder="YYYY-MM-DD" icon="calendar-outline" />
          </View>
          <View style={styles.twoCol}>
            <Input label="Kishi" value={form.travelers} onChangeText={(v) => update('travelers', v.replace(/\D/g, '').slice(0, 2))} placeholder="1" icon="people-outline" keyboardType="numeric" />
            <Input label="Budjet UZS" value={form.budget} onChangeText={(v) => update('budget', v.replace(/\D/g, '').slice(0, 10))} placeholder="1500000" icon="wallet-outline" keyboardType="numeric" />
          </View>
          <Input label="Izoh" value={form.notes} onChangeText={(v) => update('notes', v)} placeholder="Nimalarni ko'rmoqchisiz?" icon="document-text-outline" multiline />
          <TouchableOpacity style={styles.primaryWide} onPress={handleSave} disabled={saving} activeOpacity={0.86}>
            {saving ? <ActivityIndicator color={colors.textInverse} /> : <Ionicons name="save-outline" size={16} color={colors.textInverse} />}
            <Text style={styles.primaryWideText}>{saving ? 'Saqlanmoqda...' : 'Draft yaratish'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AiTripSetupScreen() {
  const { colors, insets, styles } = usePlannerStyles();
  const params = useLocalSearchParams<{ destination?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const { saveTrip } = useTrips(userId);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AiFormState>({
    destination: typeof params.destination === 'string' ? params.destination : '',
    duration: '3',
    travelers: '1',
    budget: '2000000',
    style: 'mid',
    interests: ['culture', 'food'],
  });

  useFocusEffect(useCallback(() => loadUserId(setUserId), []));

  useEffect(() => {
    if (typeof params.destination === 'string' && params.destination.trim()) {
      setForm((prev) => ({ ...prev, destination: params.destination!.trim() }));
    }
  }, [params.destination]);

  const toggleInterest = (key: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(key) ? prev.interests.filter((item) => item !== key) : [...prev.interests, key],
    }));
  };

  const generate = async () => {
    const destination = form.destination.trim();
    const budget = Math.max(200000, toNumber(form.budget, 2000000));
    const duration = Math.min(14, Math.max(1, toNumber(form.duration, 3)));
    const travelers = Math.min(8, Math.max(1, toNumber(form.travelers, 1)));

    if (!destination) return Alert.alert('Manzil kerak', 'AI reja uchun shahar yoki mamlakat kiriting.');
    if (form.interests.length === 0) return Alert.alert('Qiziqish tanlang', 'Kamida bitta qiziqish belgilang.');

    setLoading(true);
    try {
      const context = await loadAiPoiContext(destination, { ...form, budget: String(budget), duration: String(duration), travelers: String(travelers) }).catch(() => null);
      const payload = {
        country: 'Global',
        city: destination,
        startDate: todayISO(),
        endDate: addDaysISO(todayISO(), duration - 1),
        budget,
        duration,
        travelers,
        style: form.style,
        comfortLevel: form.style,
        interests: form.interests,
        companions: travelers > 2 ? 'family' : travelers === 2 ? 'couple' : 'solo',
        foodPreferences: form.interests.includes('food') ? 'halal' : 'none',
        transportType: form.style === 'budget' ? 'cheap' : form.style === 'luxury' ? 'comfort' : 'fast',
        flexibility: 'flexible',
        departureCity: destination,
        analysisContext: context?.analysisContext,
        recommendedPoiNames: context?.recommendedPoiNames || [],
        poiContext: context?.poiContext || [],
      };
      const response = await plannerAPI.generate(payload);
      const plan = normalizeGeneratedPlan(extractApiData(response), { ...form, budget: String(budget), duration: String(duration), travelers: String(travelers) });
      const result = await saveTrip(plan);
      await saveJSON(KEYS.CURRENT_PLAN, result.trip);
      router.replace('/planner-result' as any);
    } catch (error: any) {
      Alert.alert(
        'Reja yaratilmadi',
        error?.message ? `Backend javobi olinmadi: ${error.message}` : 'Backend vaqtincha ishlamadi. Iltimos, qayta urinib ko‘ring.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CloseHeader title="AI reja yaratish" />
        <ImageSurface style={styles.aiHero} imageStyle={styles.aiHeroImage}>
          <View style={styles.coverScrim} />
          <View style={styles.aiBadge}>
            <Ionicons name="sparkles" size={15} color={colors.gold} />
            <Text style={styles.aiBadgeText}>AI itinerary</Text>
          </View>
          <Text style={styles.aiHeroTitle}>Bir nechta javob, bitta tayyor marshrut</Text>
          <Text style={styles.aiHeroSub}>Manzil, budjet va qiziqishlarni kiriting. Reja avtomatik saqlanadi.</Text>
        </ImageSurface>

        <View style={styles.formCard}>
          <Input label="Qayerga borasiz?" value={form.destination} onChangeText={(v) => setForm((prev) => ({ ...prev, destination: v }))} placeholder="Shahar yoki mamlakat" icon="location-outline" />
          <View style={styles.twoCol}>
            <Input label="Kun" value={form.duration} onChangeText={(v) => setForm((prev) => ({ ...prev, duration: v.replace(/\D/g, '').slice(0, 2) }))} placeholder="3" icon="calendar-outline" keyboardType="numeric" />
            <Input label="Kishi" value={form.travelers} onChangeText={(v) => setForm((prev) => ({ ...prev, travelers: v.replace(/\D/g, '').slice(0, 2) }))} placeholder="1" icon="people-outline" keyboardType="numeric" />
          </View>
          <Input label="Budjet UZS" value={form.budget} onChangeText={(v) => setForm((prev) => ({ ...prev, budget: v.replace(/\D/g, '').slice(0, 10) }))} placeholder="2000000" icon="wallet-outline" keyboardType="numeric" />

          <Text style={styles.formLabel}>Sayohat stili</Text>
          <View style={styles.segmented}>
            {[
              ['budget', 'Ekonom'],
              ['mid', 'Standart'],
              ['luxury', 'Luxury'],
            ].map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.segmentItem, form.style === key && styles.segmentItemActive]}
                onPress={() => setForm((prev) => ({ ...prev, style: key as AiStyle }))}
                activeOpacity={0.82}
              >
                <Text style={[styles.segmentItemText, form.style === key && styles.segmentItemTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>Qiziqishlar</Text>
          <View style={styles.interestGrid}>
            {INTEREST_OPTIONS.map((item) => {
              const active = form.interests.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.interestChip, active && styles.interestChipActive]}
                  onPress={() => toggleInterest(item.key)}
                  activeOpacity={0.82}
                >
                  <Ionicons name={active ? 'checkmark' : 'add'} size={13} color={active ? colors.textInverse : colors.success} />
                  <Text style={[styles.interestText, active && styles.interestTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.primaryWide} onPress={generate} disabled={loading} activeOpacity={0.86}>
            {loading ? <ActivityIndicator color={colors.textInverse} /> : <Ionicons name="sparkles-outline" size={16} color={colors.textInverse} />}
            <Text style={styles.primaryWideText}>{loading ? 'AI reja tuzmoqda...' : 'Rejani avtomatik yaratish'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Input({
  label,
  icon,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; icon: keyof typeof Ionicons.glyphMap }) {
  const { colors, styles } = usePlannerStyles();
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={[styles.inputShell, multiline && styles.inputShellMultiline]}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
    </View>
  );
}

export function MultiDayPlannerScreen() {
  const { colors, insets, styles } = usePlannerStyles();
  const safeBottom = Math.max(insets.bottom, 22);
  const params = useLocalSearchParams<{ tripId?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const { trips, loading, loadTrips, updateTrip } = useTrips(userId);

  useFocusEffect(useCallback(() => loadUserId(setUserId), []));
  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  const trip = useMemo(() => {
    const id = typeof params.tripId === 'string' ? params.tripId : '';
    return trips.find((item) => item.id === id) || trips[0] || null;
  }, [params.tripId, trips]);

  const toggleActivity = async (day: DayPlan, activity: Activity, index: number) => {
    if (!trip) return;
    const key = getActivityKey(trip.id, day, activity, index);
    const visited = new Set(trip.progress?.visitedStopIds || []);
    if (visited.has(key)) visited.delete(key);
    else visited.add(key);
    const nextTrip: TripPlan = {
      ...trip,
      progress: {
        visitedStopIds: Array.from(visited),
        notes: trip.progress?.notes || {},
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    await updateTrip(nextTrip);
    await loadTrips();
  };

  if (loading && !trip) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.success} />
        <Text style={styles.mutedText}>Trip yuklanmoqda...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="map-outline" size={30} color={colors.success} />
        </View>
        <Text style={styles.emptyTitle}>Reja topilmadi</Text>
        <Text style={styles.emptyText}>{"Avval AI orqali yoki qo'lda yangi sayohat yarating."}</Text>
        <TouchableOpacity style={styles.primaryWide} onPress={() => router.replace('/add-plan' as any)} activeOpacity={0.86}>
          <Text style={styles.primaryWideText}>Yangi reja yaratish</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = getTripProgress(trip);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={[styles.content, { paddingBottom: 132 + safeBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <CloseHeader
          title="Trip Creator"
          action={
            <View style={styles.savedPill}>
              <Ionicons name={trip.syncStatus === 'synced' ? 'cloud-done-outline' : 'sync-outline'} size={13} color={colors.success} />
              <Text style={styles.savedPillText}>{trip.syncStatus === 'synced' ? 'Saved' : 'Local'}</Text>
            </View>
          }
        />

        <ImageSurface imageUrl={getCover(trip)} style={styles.detailHero} imageStyle={styles.detailHeroImage}>
          <View style={styles.coverScrim} />
          <Text style={styles.detailTitle}>{trip.title}</Text>
          <Text style={styles.detailSubtitle}>{trip.destinations?.join(', ') || 'Global'} · {formatTripDates(trip)}</Text>
          <View style={styles.detailMeta}>
            <MetaPill icon="calendar-outline" label={`${trip.duration || 1} kun`} />
            <MetaPill icon="people-outline" label={`${trip.travelers || 1} kishi`} />
            <MetaPill icon="wallet-outline" label={trip.totalCost ? formatSum(trip.totalCost) : 'Budjet yoq'} />
          </View>
        </ImageSurface>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>Reja progressi</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          {trip.status === 'draft' ? (
            <TouchableOpacity
              style={styles.aiFillButton}
              onPress={() => router.push({ pathname: '/ai-trip-setup', params: { destination: trip.destinations?.[0] || '' } } as any)}
              activeOpacity={0.86}
            >
              <Ionicons name="sparkles-outline" size={15} color={colors.textInverse} />
              <Text style={styles.aiFillText}>{"AI bilan to'ldirish"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Kunlik itinerary</Text>
        <View style={styles.daysList}>
          {(trip.days || []).map((day) => (
            <View key={`${trip.id}-day-${day.day}`} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={styles.dayIndex}>
                  <Text style={styles.dayIndexText}>{day.day}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle}>Day {day.day}: {day.destination || trip.destinations?.[0] || 'Trip'}</Text>
                  <Text style={styles.mutedText}>{day.activities?.length || 0} activity · Hotel: {day.hotel || 'keyin tanlanadi'}</Text>
                </View>
              </View>
              <View style={styles.activityList}>
                {(day.activities || []).length === 0 ? (
                  <TouchableOpacity
                    style={styles.emptyActivity}
                    onPress={() => router.push({ pathname: '/add-activity', params: { tripId: trip.id, day: String(day.day) } } as any)}
                    activeOpacity={0.84}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={colors.textMuted} />
                    <Text style={styles.emptyActivityText}>{"Activity qo'shish"}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    {day.activities.map((activity, index) => {
                      const key = getActivityKey(trip.id, day, activity, index);
                      const done = trip.progress?.visitedStopIds?.includes(key);
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.activityRow, done && styles.activityRowDone]}
                          onPress={() => toggleActivity(day, activity, index)}
                          activeOpacity={0.82}
                        >
                          <View style={[styles.checkDot, done && styles.checkDotDone]}>
                            <Ionicons name={done ? 'checkmark' : 'ellipse-outline'} size={13} color={done ? colors.textInverse : colors.textMuted} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.activityTitle}>{activity.name}</Text>
                            <Text style={styles.mutedText}>{activity.time || 'vaqt yoq'} · {activity.type || 'activity'} · {activity.cost ? formatSum(activity.cost) : 'free'}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={styles.addActivityInline}
                      onPress={() => router.push({ pathname: '/add-activity', params: { tripId: trip.id, day: String(day.day) } } as any)}
                      activeOpacity={0.84}
                    >
                      <Ionicons name="add" size={15} color={colors.success} />
                      <Text style={styles.addActivityInlineText}>{"Activity qo'shish"}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function AddActivityScreen() {
  const { colors, insets, styles } = usePlannerStyles();
  const params = useLocalSearchParams<{ tripId?: string; day?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const { trips, loadTrips, updateTrip } = useTrips(userId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: 'activity',
    title: '',
    location: '',
    startTime: '10:00',
    endTime: '12:00',
    cost: '0',
    notes: '',
  });

  useFocusEffect(useCallback(() => loadUserId(setUserId), []));
  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  const trip = useMemo(() => {
    const id = typeof params.tripId === 'string' ? params.tripId : '';
    return trips.find((item) => item.id === id) || trips[0] || null;
  }, [params.tripId, trips]);
  const dayNumber = Math.max(1, Number(params.day || 1) || 1);

  const saveActivity = async () => {
    if (!trip) return Alert.alert('Trip topilmadi', "Avval trip yarating yoki ro'yxatdan tanlang.");
    if (!form.title.trim()) return Alert.alert('Activity nomi kerak', 'Activity nomini kiriting.');

    setSaving(true);
    try {
      const activity: Activity = {
        time: form.startTime.trim() || '10:00',
        type: form.category,
        name: form.title.trim(),
        cost: toNumber(form.cost, 0),
        icon: form.category === 'food' ? 'restaurant' : form.category === 'hotel' ? 'bed' : form.category === 'transport' ? 'car' : 'compass',
        note: form.notes.trim() || form.location.trim(),
        source: 'manual',
        confidenceScore: 0.72,
      };

      const days = [...(trip.days || [])];
      const existingIndex = days.findIndex((item) => Number(item.day) === dayNumber);
      if (existingIndex >= 0) {
        const existingDay = days[existingIndex];
        days[existingIndex] = {
          ...existingDay,
          activities: [...(existingDay.activities || []), activity],
        };
      } else {
        days.push({
          day: dayNumber,
          destination: trip.destinations?.[0] || form.location.trim() || 'Trip',
          activities: [activity],
          hotel: '',
          hotelCost: 0,
        });
      }

      const nextTrip: TripPlan = {
        ...trip,
        days: days.sort((left, right) => Number(left.day) - Number(right.day)),
        status: trip.status === 'draft' ? 'draft' : trip.status,
        updatedAt: new Date().toISOString(),
      };
      const result = await updateTrip(nextTrip);
      router.replace({ pathname: '/multi-day-planner', params: { tripId: result.trip.id } } as any);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <CloseHeader title="Activity qo'shish" />
        <View style={styles.optionHero}>
          <Text style={styles.heroKicker}>Day {dayNumber}</Text>
          <Text style={styles.optionTitle}>{trip?.title || 'Yangi activity'}</Text>
          <Text style={styles.heroText}>{"Activity qo'shilgach trip ichida progress bilan birga ko'rinadi."}</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Kategoriya</Text>
          <View style={styles.categoryRow}>
            {[
              ['activity', 'compass-outline', 'Activity'],
              ['food', 'restaurant-outline', 'Food'],
              ['hotel', 'bed-outline', 'Hotel'],
              ['transport', 'car-outline', 'Transport'],
            ].map(([key, icon, label]) => {
              const active = form.category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, category: key }))}
                  activeOpacity={0.82}
                >
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={active ? colors.textInverse : colors.textMuted} />
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Input label="Activity nomi" value={form.title} onChangeText={(v) => setForm((prev) => ({ ...prev, title: v }))} placeholder="Joy yoki activity nomi" icon="text-outline" />
          <Input label="Joy / manzil" value={form.location} onChangeText={(v) => setForm((prev) => ({ ...prev, location: v }))} placeholder="Joy nomi yoki address" icon="location-outline" />
          <View style={styles.twoCol}>
            <Input label="Boshlanish" value={form.startTime} onChangeText={(v) => setForm((prev) => ({ ...prev, startTime: v }))} placeholder="10:00" icon="time-outline" />
            <Input label="Tugash" value={form.endTime} onChangeText={(v) => setForm((prev) => ({ ...prev, endTime: v }))} placeholder="12:00" icon="time-outline" />
          </View>
          <Input label="Xarajat UZS" value={form.cost} onChangeText={(v) => setForm((prev) => ({ ...prev, cost: v.replace(/\D/g, '').slice(0, 10) }))} placeholder="0" icon="wallet-outline" keyboardType="numeric" />
          <Input label="Izoh" value={form.notes} onChangeText={(v) => setForm((prev) => ({ ...prev, notes: v }))} placeholder="Bron kodi, eslatma yoki link" icon="document-text-outline" multiline />
          <TouchableOpacity style={styles.primaryWide} onPress={saveActivity} disabled={saving} activeOpacity={0.86}>
            {saving ? <ActivityIndicator color={colors.textInverse} /> : <Ionicons name="save-outline" size={16} color={colors.textInverse} />}
            <Text style={styles.primaryWideText}>{saving ? 'Saqlanmoqda...' : "Itineraryga qo'shish"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },
    centerScreen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xl,
      gap: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
    },
    headerCopy: { alignItems: 'center', flex: 1 },
    headerTitle: { fontFamily: FONTS.display, fontSize: 16, color: colors.text },
    headerSubtitle: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
    iconButtonGhost: { width: 40, height: 40 },
    heroCard: {
      borderRadius: 30,
      backgroundColor: '#050814',
      padding: SPACING.xl,
      gap: SPACING.lg,
      overflow: 'hidden',
    },
    heroKicker: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.success,
      marginBottom: 6,
    },
    heroTitle: { fontFamily: FONTS.display, fontSize: 28, lineHeight: 34, color: colors.textInverse },
    heroText: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.72)', marginTop: 8 },
    heroActions: { flexDirection: 'row', gap: SPACING.sm },
    heroPrimary: {
      flex: 1,
      height: 48,
      borderRadius: RADIUS.full,
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    heroPrimaryText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textInverse },
    heroGhost: {
      height: 48,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.lg,
      backgroundColor: colors.glassStrong,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    heroGhostText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.text },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    statTile: {
      flexBasis: '48%',
      flexGrow: 1,
      borderRadius: 20,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      gap: 5,
    },
    statValue: { fontFamily: FONTS.display, fontSize: 22, color: colors.text },
    statLabel: { fontFamily: FONTS.regular, fontSize: 11, color: colors.textMuted },
    filterRow: { gap: SPACING.sm, paddingRight: SPACING.lg },
    filterChip: {
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: 9,
    },
    filterChipActive: { backgroundColor: colors.primary },
    filterText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted },
    filterTextActive: { color: colors.textInverse },
    loadingBox: {
      borderRadius: 20,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    emptyCard: {
      borderRadius: 26,
      backgroundColor: colors.surface,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.successPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontFamily: FONTS.display, fontSize: 20, color: colors.text, textAlign: 'center' },
    emptyText: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
    tripList: { gap: SPACING.lg },
    tripCard: {
      borderRadius: 26,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.11,
      shadowRadius: 22,
      elevation: 5,
    },
    tripCover: { height: 176, justifyContent: 'space-between', padding: SPACING.md },
    tripCoverImage: { borderTopLeftRadius: 26, borderTopRightRadius: 26 },
    generatedCover: {
      overflow: 'hidden',
      backgroundColor: '#07120f',
    },
    coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,7,18,0.42)' },
    tripCoverTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    coverActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    statusPill: {
      borderRadius: RADIUS.full,
      backgroundColor: colors.glassStrong,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    statusText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.success },
    coverIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.34)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripCoverBottom: { gap: 4 },
    tripTitle: { fontFamily: FONTS.display, fontSize: 23, lineHeight: 28, color: colors.textInverse },
    tripSubtitle: { fontFamily: FONTS.regular, fontSize: 12, color: 'rgba(255,255,255,0.82)' },
    tripBody: { padding: SPACING.md, gap: SPACING.md },
    tripMetaRow: { flexDirection: 'row', gap: SPACING.sm },
    metaPill: {
      flex: 1,
      minHeight: 34,
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 8,
    },
    metaPillText: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.textSecondary, maxWidth: 82 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textSecondary },
    progressValue: { fontFamily: FONTS.display, fontSize: 14, color: colors.success },
    progressTrack: { height: 8, borderRadius: RADIUS.full, backgroundColor: colors.borderLight, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: RADIUS.full, backgroundColor: colors.success },
    fab: {
      position: 'absolute',
      right: SPACING.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#050814',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 10,
    },
    optionHero: {
      margin: SPACING.lg,
      borderRadius: 28,
      backgroundColor: '#050814',
      padding: SPACING.xl,
    },
    optionTitle: { fontFamily: FONTS.display, fontSize: 27, lineHeight: 33, color: colors.textInverse },
    optionSheet: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
    optionRow: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    optionRowDark: { backgroundColor: '#050814', borderColor: '#050814' },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: colors.successPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionRowTitle: { fontFamily: FONTS.display, fontSize: 15, color: colors.text },
    optionRowSub: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 3 },
    manualCover: { height: 190, borderRadius: 28, padding: SPACING.lg, justifyContent: 'flex-end' },
    manualCoverImage: { borderRadius: 28 },
    manualCoverTitle: { fontFamily: FONTS.display, fontSize: 28, color: colors.textInverse },
    manualCoverSub: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.78)', marginTop: 5 },
    formCard: {
      borderRadius: 26,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    inputGroup: { gap: 7, flex: 1 },
    formLabel: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textSecondary },
    inputShell: {
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: colors.cardMuted,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    inputShellMultiline: { minHeight: 94, alignItems: 'flex-start', paddingTop: SPACING.md },
    input: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: colors.text, paddingVertical: 0 },
    inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
    twoCol: { flexDirection: 'row', gap: SPACING.sm },
    smallSaveBtn: {
      height: 36,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    smallSaveText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textInverse },
    primaryWide: {
      minHeight: 52,
      borderRadius: RADIUS.full,
      backgroundColor: colors.success,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: SPACING.lg,
    },
    primaryWideText: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.textInverse },
    secondaryWide: {
      minHeight: 50,
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
    },
    secondaryWideText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textSecondary },
    aiHero: { height: 220, borderRadius: 30, padding: SPACING.lg, justifyContent: 'flex-end' },
    aiHeroImage: { borderRadius: 30 },
    aiBadge: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.14)',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: SPACING.sm,
    },
    aiBadgeText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textInverse },
    aiHeroTitle: { fontFamily: FONTS.display, fontSize: 29, lineHeight: 35, color: colors.textInverse },
    aiHeroSub: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, color: 'rgba(255,255,255,0.78)', marginTop: 6 },
    segmented: { flexDirection: 'row', borderRadius: RADIUS.full, backgroundColor: colors.cardMuted, padding: 4 },
    segmentItem: { flex: 1, borderRadius: RADIUS.full, paddingVertical: 10, alignItems: 'center' },
    segmentItemActive: { backgroundColor: colors.primary },
    segmentItemText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textMuted },
    segmentItemTextActive: { color: colors.textInverse },
    interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    interestChip: {
      borderRadius: RADIUS.full,
      backgroundColor: colors.cardMuted,
      paddingHorizontal: SPACING.md,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    interestChipActive: { backgroundColor: colors.success },
    interestText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.success },
    interestTextActive: { color: colors.textInverse },
    detailHero: { minHeight: 236, borderRadius: 30, padding: SPACING.lg, justifyContent: 'flex-end', gap: SPACING.sm },
    detailHeroImage: { borderRadius: 30 },
    detailTitle: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 36, color: colors.textInverse },
    detailSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: 'rgba(255,255,255,0.82)' },
    detailMeta: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    progressCard: {
      borderRadius: 22,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    sectionTitle: { fontFamily: FONTS.display, fontSize: 21, color: colors.text },
    aiFillButton: {
      height: 46,
      borderRadius: RADIUS.full,
      backgroundColor: '#050814',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    aiFillText: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textInverse },
    savedPill: {
      height: 34,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      backgroundColor: colors.successPale,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    savedPillText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.success },
    daysList: { gap: SPACING.md },
    dayCard: {
      borderRadius: 24,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    dayHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    dayIndex: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    dayIndexText: { fontFamily: FONTS.display, fontSize: 13, color: colors.textInverse },
    dayTitle: { fontFamily: FONTS.display, fontSize: 16, color: colors.text },
    mutedText: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    activityList: { gap: SPACING.sm },
    activityRow: {
      borderRadius: 18,
      backgroundColor: colors.cardMuted,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    activityRowDone: { backgroundColor: colors.successPale },
    checkDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkDotDone: { backgroundColor: colors.success },
    activityTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.text },
    emptyActivity: {
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      minHeight: 96,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    emptyActivityText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.textSecondary },
    addActivityInline: {
      height: 42,
      borderRadius: RADIUS.full,
      backgroundColor: colors.successPale,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    addActivityInlineText: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.success },
    categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    categoryChip: {
      flexBasis: '47%',
      flexGrow: 1,
      minHeight: 58,
      borderRadius: 16,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    categoryChipActive: { backgroundColor: colors.success, borderColor: colors.success },
    categoryChipText: { fontFamily: FONTS.semibold, fontSize: 11, color: colors.textMuted },
    categoryChipTextActive: { color: colors.textInverse },
  });
}
