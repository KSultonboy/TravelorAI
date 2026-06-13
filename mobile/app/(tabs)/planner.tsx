import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LottieAnim from '../../src/components/LottieAnim';
import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { primaryGlow } from '../../src/constants/effects';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { citiesAPI, destinationsAPI, plannerAPI, poiAPI, type PoiPayload } from '../../src/utils/api';
import { extractApiData } from '../../src/utils/auth';
import { formatSum } from '../../src/utils/formatter';
import {
  INTEREST_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  type TravelStyle,
} from '../../src/utils/preferences';
import { KEYS, getItem, getJSON, saveJSON } from '../../src/utils/storage';

type Companions = 'solo' | 'friends' | 'family' | 'couple';
type FoodPref = 'halal' | 'vegetarian' | 'vegan' | 'none';
type TransportPref = 'cheap' | 'fast' | 'comfort';
type Flexibility = 'fixed' | 'flexible';
type Currency = 'UZS' | 'USD';

interface FormState {
  city: string;
  startDate: string;
  endDate: string;
  companions: Companions;
  travelers: number;
  budget: string;
  currency: Currency;
  style: TravelStyle;
  interests: string[];
  food: FoodPref;
  transport: TransportPref;
  flexibility: Flexibility;
}

const MIN_BUDGET_UZS = 200000;
const USD_TO_UZS = Number.parseInt(process.env.EXPO_PUBLIC_USD_TO_UZS || '', 10) || 13000;
const MAX_DAYS = 14;
const POI_PAGE_LIMIT = 200;
const POI_MAX_PAGES = 4;
const POI_REQUEST_TIMEOUT_MS = 12000;
const POI_CONTEXT_SOFT_TIMEOUT_MS = 8000;
const CITIES_FALLBACK: string[] = [];
const ACTIVITY_ICONS: Record<string, string> = { transport: 'TR', landmark: 'LM', food: 'FD', attraction: 'AT', hotel: 'HT' };

type PlanMeta = {
  status: 'draft' | 'final' | 'failed';
  source: 'local' | 'backend';
};

interface PlannerPoiInsight {
  city: string;
  totalPoi: number;
  typeCounts: Record<string, number>;
  avgPriceByType: Record<string, number>;
  recommendedNames: string[];
  estimatedDayCost: number;
  estimatedTripCost: number;
}

interface PlannerPoiContextItem {
  id?: string;
  name: string;
  city: string;
  type?: string;
  subtype?: string | null;
  info?: string;
  description?: string | null;
  lat?: number;
  lng?: number;
  price?: number;
  rating?: number;
  icon?: string;
}

interface NormalizePlanLabels {
  tripTitle: string;
  highlightDates: string;
  highlightCompanions: string;
}

const INTEREST_KEYWORDS: Record<string, string[]> = {
  tarixiy: ['history', 'historical', 'museum', 'fortress', 'ark', 'qala', 'madrasah', 'maqbara'],
  madaniy: ['culture', 'art', 'heritage', 'theatre', 'center', 'gallery'],
  tabiat: ['nature', 'park', 'garden', 'lake', 'river', 'eco', 'forest'],
  gastronomiya: ['food', 'restaurant', 'cafe', 'tea', 'local dish'],
  gastronomy: ['food', 'restaurant', 'cafe', 'tea', 'local dish'],
  arxitektura: ['architecture', 'building', 'tower', 'mosque', 'minaret'],
  din: ['mosque', 'ziyorat', 'shrine', 'religious'],
  zamonaviy: ['mall', 'modern', 'shopping', 'entertainment'],
  hunarmandchilik: ['craft', 'workshop', 'artisan', 'bazaar'],
};

function normalizeCityName(value: unknown): string {
  return String(value || '').trim();
}

function uniqueCities(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeCityName(value))
        .filter(Boolean)
    )
  );
}

function getDestinationNamesFromItems(items: any[]): string[] {
  return uniqueCities(items.map((item) => item?.name));
}

function mergeCityLists(...lists: (string[] | undefined)[]): string[] {
  const merged: string[] = [];
  for (const list of lists) {
    if (!Array.isArray(list) || list.length === 0) continue;
    for (const city of list) {
      const normalized = normalizeCityName(city);
      if (!normalized) continue;
      if (!merged.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        merged.push(normalized);
      }
    }
  }
  return merged;
}

function normalizeSearchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackTypePrice(type: string, style: TravelStyle): number {
  if (type === 'restaurant') return style === 'budget' ? 55_000 : style === 'mid' ? 95_000 : 165_000;
  if (type === 'hotel') return style === 'budget' ? 180_000 : style === 'mid' ? 310_000 : 520_000;
  if (type === 'transport') return style === 'budget' ? 28_000 : style === 'mid' ? 42_000 : 70_000;
  return style === 'budget' ? 35_000 : style === 'mid' ? 60_000 : 105_000;
}

function estimatePoiPrice(poi: PoiPayload, style: TravelStyle): number {
  if (Number(poi.price || 0) > 0) return Number(poi.price);
  const type = String(poi.type || '');
  return fallbackTypePrice(type, style);
}

function buildPoiInsight(city: string, points: PoiPayload[], form: FormState, duration: number): PlannerPoiInsight {
  const typeCounts: Record<string, number> = { landmark: 0, restaurant: 0, hotel: 0, transport: 0 };
  const avgPriceByType: Record<string, number> = { landmark: 0, restaurant: 0, hotel: 0, transport: 0 };
  const grouped: Record<string, number[]> = { landmark: [], restaurant: [], hotel: [], transport: [] };

  points.forEach((poi) => {
    const type = String(poi.type || '');
    if (!grouped[type]) return;
    typeCounts[type] += 1;
    grouped[type].push(estimatePoiPrice(poi, form.style));
  });

  Object.keys(grouped).forEach((type) => {
    const list = grouped[type];
    if (!list.length) return;
    avgPriceByType[type] = Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
  });

  const keywords = form.interests.flatMap((interest) => INTEREST_KEYWORDS[interest] || [interest]);
  const recommended = points
    .map((poi) => {
      const haystack = normalizeSearchText(`${poi.name} ${poi.info} ${poi.subtype || ''}`);
      const score =
        keywords.reduce((sum, word) => (haystack.includes(normalizeSearchText(word)) ? sum + 2 : sum), 0) +
        (poi.type === 'landmark' ? 1 : 0);
      return { poi, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((item) => item.poi.name);

  const dayCostBase =
    (avgPriceByType.transport || fallbackTypePrice('transport', form.style)) +
    (avgPriceByType.landmark || fallbackTypePrice('landmark', form.style)) * 2 +
    (avgPriceByType.restaurant || fallbackTypePrice('restaurant', form.style)) * 2 +
    (avgPriceByType.hotel || fallbackTypePrice('hotel', form.style));
  const travelers = Math.max(1, form.travelers);
  const estimatedDayCost = Math.round(dayCostBase * travelers);
  const estimatedTripCost = Math.round(estimatedDayCost * Math.max(1, duration));

  return {
    city,
    totalPoi: points.length,
    typeCounts,
    avgPriceByType,
    recommendedNames: recommended,
    estimatedDayCost,
    estimatedTripCost,
  };
}

function mapPoiToContextItem(poi: PoiPayload, fallbackCity: string): PlannerPoiContextItem | null {
  const name = String(poi?.name || '').trim();
  if (!name) return null;

  const city = String(poi?.city || fallbackCity || '').trim() || fallbackCity;
  const type = String(poi?.type || '').trim();
  const lat = Number(poi?.lat);
  const lng = Number(poi?.lng);
  const price = Number(poi?.price);
  const rating = Number(poi?.rating);

  const item: PlannerPoiContextItem = {
    id: poi?.id || undefined,
    name,
    city,
    type: type || undefined,
    subtype: poi?.subtype ?? undefined,
    info: String(poi?.info || '').trim() || undefined,
    description: poi?.description ?? undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    price: Number.isFinite(price) ? price : undefined,
    rating: Number.isFinite(rating) ? rating : undefined,
    icon: poi?.icon || undefined,
  };

  return item;
}

function buildPoiContextItems(cityName: string, points: PoiPayload[]): PlannerPoiContextItem[] {
  const seen = new Set<string>();
  const contextItems: PlannerPoiContextItem[] = [];

  points.forEach((poi) => {
    const item = mapPoiToContextItem(poi, cityName);
    if (!item) return;

    const dedupeKey = `${normalizeSearchText(item.city)}|${normalizeSearchText(item.name)}|${normalizeSearchText(item.type || '')}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    contextItems.push(item);
  });

  return contextItems;
}

async function loadCityPoiPoints(cityName: string): Promise<PoiPayload[]> {
  const points: PoiPayload[] = [];
  let expectedTotal = Number.POSITIVE_INFINITY;

  for (let page = 1; page <= POI_MAX_PAGES; page += 1) {
    const poiResponse = extractApiData<any>(
      await poiAPI.getAll({ city: cityName, page, limit: POI_PAGE_LIMIT }, POI_REQUEST_TIMEOUT_MS)
    );
    const poiItems = Array.isArray(poiResponse?.items)
      ? poiResponse.items
      : Array.isArray(poiResponse)
        ? poiResponse
        : [];
    const typedPoints = poiItems as PoiPayload[];

    if (!typedPoints.length) break;
    points.push(...typedPoints);

    const total = Number(poiResponse?.total);
    if (Number.isFinite(total) && total >= 0) {
      expectedTotal = total;
    }

    if (points.length >= expectedTotal || typedPoints.length < POI_PAGE_LIMIT) {
      break;
    }
  }

  return points;
}

function getErrorMessage(err: unknown): string {
  const e = err as any;
  return String(e?.data?.message || e?.message || '').trim();
}

function buildPlannerPayload(
  form: FormState,
  cityName: string,
  departureCity: string,
  duration: number,
  budgetUzs: number,
  poiInsight: PlannerPoiInsight | null,
  poiContext: PlannerPoiContextItem[]
) {
  return {
    country: 'Global',
    city: cityName,
    startDate: form.startDate,
    endDate: form.endDate,
    companions: form.companions,
    budget: budgetUzs,
    comfortLevel: form.style,
    interests: form.interests,
    foodPreferences: form.food,
    transportType: form.transport,
    flexibility: form.flexibility,
    duration,
    travelers: form.travelers,
    style: form.style,
    departureCity,
    analysisContext: poiInsight
      ? {
          city: poiInsight.city,
          totalPoi: poiInsight.totalPoi,
          typeCounts: poiInsight.typeCounts,
          avgPriceByType: poiInsight.avgPriceByType,
          estimatedDayCost: poiInsight.estimatedDayCost,
          estimatedTripCost: poiInsight.estimatedTripCost,
        }
      : undefined,
    recommendedPoiNames: poiInsight?.recommendedNames.slice(0, 12) || [],
    poiContext,
  };
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseISO(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  if (!date) return iso;
  date.setDate(date.getDate() + days);
  return toISO(date);
}

function getDuration(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  if (!s || !e) return 0;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBreakdown(raw: any) {
  return {
    transport: toSafeNumber(raw?.transport),
    accommodation: toSafeNumber(raw?.accommodation),
    food: toSafeNumber(raw?.food),
    attractions: toSafeNumber(raw?.attractions),
    misc: toSafeNumber(raw?.misc),
  };
}

function normalizePlan(raw: any, form: FormState, duration: number, extraTips: string[], labels: NormalizePlanLabels, meta: PlanMeta) {
  const rawDays = Array.isArray(raw?.days) ? raw.days : [];
  const breakdown = normalizeBreakdown(raw?.breakdown);
  const breakdownTotal = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const totalCost = Math.max(toSafeNumber(raw?.totalCost), breakdownTotal);

  const mappedDays =
    rawDays.length > 0
      ? rawDays.map((d: any, i: number) => {
          const activities = Array.isArray(d?.activities) ? d.activities : [];
          const destination = String(d?.destination ?? d?.city ?? form.city ?? '').trim() || form.city;
          return {
          day: d.day ?? d.dayNumber ?? i + 1,
          destination,
          activities: activities.map((a: any) => ({
            time: a.time ?? '09:00',
            type: a.type ?? 'attraction',
            name: String(a.name ?? '').trim(),
            cost: toSafeNumber(a.cost),
            icon: a.icon ?? ACTIVITY_ICONS[a.type] ?? 'AT',
            lat: Number.isFinite(Number(a.lat)) ? Number(a.lat) : undefined,
            lng: Number.isFinite(Number(a.lng)) ? Number(a.lng) : undefined,
            source: a.source,
            confidenceScore: Number.isFinite(Number(a.confidenceScore)) ? Number(a.confidenceScore) : undefined,
            bookingUrl: a.bookingUrl,
            durationMinutes: Number.isFinite(Number(a.durationMinutes)) ? Number(a.durationMinutes) : undefined,
            distanceKm: Number.isFinite(Number(a.distanceKm)) ? Number(a.distanceKm) : undefined,
            note: a.note,
          })),
          hotel: d.hotel ?? d.accommodation?.name ?? 'Hotel',
          hotelCost: toSafeNumber(d.hotelCost ?? d.accommodation?.cost ?? 0),
        };
      })
      : Array.from({ length: duration }, (_, i) => ({
          day: i + 1,
          destination: form.city,
          activities: [],
          hotel: '',
          hotelCost: 0,
        }));

  const warnings = Array.isArray(raw?.warnings) ? raw.warnings.map((item: any) => String(item || '').trim()).filter(Boolean) : [];
  const highlightsRaw = Array.isArray(raw?.highlights) ? raw.highlights.map((item: any) => String(item || '').trim()).filter(Boolean) : [];
  const tipsRaw = Array.isArray(raw?.tips) ? raw.tips.map((item: any) => String(item || '').trim()).filter(Boolean) : [];
  const status = raw?.status === 'draft' || raw?.status === 'final' || raw?.status === 'failed' ? raw.status : meta.status;
  const source = raw?.source === 'local' || raw?.source === 'backend' ? raw.source : meta.source;

  return {
    id: raw?.id ?? String(Date.now()),
    title: raw?.title ?? labels.tripTitle.replace('{{city}}', form.city),
    totalCost,
    duration: Math.max(1, toSafeNumber(raw?.duration ?? duration)),
    travelers: Math.max(1, toSafeNumber(raw?.travelers ?? form.travelers)),
    style: raw?.style ?? form.style,
    destinations: Array.isArray(raw?.destinations) && raw.destinations.length ? raw.destinations : [form.city],
    transportLegs: Array.isArray(raw?.transportLegs) ? raw.transportLegs : [],
    breakdown,
    days: mappedDays,
    warnings,
    highlights: Array.from(
      new Set([
        ...highlightsRaw,
        labels.highlightDates.replace('{{city}}', form.city).replace('{{start}}', form.startDate).replace('{{end}}', form.endDate),
        labels.highlightCompanions.replace('{{companions}}', form.companions),
      ])
    ).slice(0, 6),
    tips: Array.from(new Set([...tipsRaw, ...extraTips.map((item) => String(item || '').trim()).filter(Boolean)])).slice(0, 8),
    dataConfidence: raw?.dataConfidence,
    sourceSummary: raw?.sourceSummary,
    alternatives: raw?.alternatives,
    verificationWarnings: Array.isArray(raw?.verificationWarnings) ? raw.verificationWarnings : [],
    status,
    source,
    syncStatus: raw?.syncStatus,
    updatedAt: new Date().toISOString(),
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 22);
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tt = useCallback((k: string, def: string) => t(k as any, { defaultValue: def }), [t]);

  const today = useMemo(() => toISO(new Date()), []);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authBootstrapDone, setAuthBootstrapDone] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>(CITIES_FALLBACK);
  const [form, setForm] = useState<FormState>({
    city: '',
    startDate: today,
    endDate: addDays(today, 2),
    companions: 'solo',
    travelers: 1,
    budget: '',
    currency: 'UZS',
    style: 'mid',
    interests: ['tarixiy', 'madaniy'],
    food: 'halal',
    transport: 'cheap',
    flexibility: 'fixed',
  });

  const openMyPlans = useCallback(() => {
    router.push('/my-plans' as any);
  }, []);

  const steps = useMemo(
    () => [
      tt('planner.flowBasics', 'Shahar va sanalar'),
      tt('planner.flowCompanions', 'Hamrohlar'),
      tt('planner.flowBudget', 'Budjet va comfort'),
      tt('planner.flowInterests', 'Qiziqishlar'),
      tt('planner.flowMobility', 'Ovqat va transport'),
      tt('planner.flowFinal', 'Moslashuvchanlik'),
    ],
    [tt]
  );
  const analysisStages = useMemo(
    () => [
      tt('planner.loadingStagePlaces', 'Analyzing city places...'),
      tt('planner.loadingStageBudget', 'Checking budget and price fit...'),
      tt('planner.loadingStageRoute', 'Optimizing daily route...'),
      tt('planner.loadingStageFinal', 'Preparing final AI plan...'),
    ],
    [tt]
  );
  const companionLabels: Record<Companions, string> = useMemo(
    () => ({
      solo: tt('planner.companionSolo', 'Solo'),
      friends: tt('planner.companionFriends', 'Friends'),
      family: tt('planner.companionFamily', 'Family'),
      couple: tt('planner.companionCouple', 'Couple'),
    }),
    [tt]
  );
  const foodLabels: Record<FoodPref, string> = useMemo(
    () => ({
      halal: tt('planner.foodHalal', 'Halal'),
      vegetarian: tt('planner.foodVegetarian', 'Vegetarian'),
      vegan: tt('planner.foodVegan', 'Vegan'),
      none: tt('planner.foodNone', 'No preference'),
    }),
    [tt]
  );
  const transportLabels: Record<TransportPref, string> = useMemo(
    () => ({
      cheap: tt('planner.transportCheap', 'Cheap'),
      fast: tt('planner.transportFast', 'Fast'),
      comfort: tt('planner.transportComfort', 'Comfort'),
    }),
    [tt]
  );
  const flexibilityLabels: Record<Flexibility, string> = useMemo(
    () => ({
      fixed: tt('planner.flexFixed', 'Fixed schedule'),
      flexible: tt('planner.flexFlexible', 'Flexible'),
    }),
    [tt]
  );
  const datePresets = useMemo(
    () => [
      { days: 3, label: tt('planner.datePreset3', '3 kun') },
      { days: 5, label: tt('planner.datePreset5', '5 kun') },
      { days: 7, label: tt('planner.datePreset7', '7 kun') },
    ],
    [tt]
  );
  const normalizePlanLabels: NormalizePlanLabels = useMemo(
    () => ({
      tripTitle: tt('planner.localTripTitle', '{{city}} trip plan'),
      highlightDates: tt('planner.localHighlightDates', '{{city}}: {{start}} - {{end}}'),
      highlightCompanions: tt('planner.localHighlightCompanions', 'Companions: {{companions}}'),
    }),
    [tt]
  );
  const styleLabels: Record<TravelStyle, string> = useMemo(
    () => ({
      budget: t('travelPrefs.styleBudgetLabel'),
      mid: t('travelPrefs.styleMidLabel'),
      luxury: t('travelPrefs.stylePremiumLabel'),
    }),
    [t]
  );
  const interestLabels: Record<string, string> = useMemo(
    () => ({
      tarixiy: t('travelPrefs.intHistorical'),
      madaniy: t('travelPrefs.intCultural'),
      tabiat: t('travelPrefs.intNature'),
      gastronomy: t('travelPrefs.intGastronomy'),
      gastronomiya: t('travelPrefs.intGastronomy'),
      arxitektura: t('travelPrefs.intArchitecture'),
      din: t('travelPrefs.intReligious'),
      zamonaviy: t('travelPrefs.intModern'),
      hunarmandchilik: t('travelPrefs.intCrafts'),
    }),
    [t]
  );

  const anim = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(1 / steps.length)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: (step + 1) / steps.length, duration: 250, useNativeDriver: false }).start();
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();
  }, [anim, progress, step, steps.length]);

  useEffect(() => {
    if (!loading) {
      setLoadingStageIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setLoadingStageIndex((prev) => (prev + 1) % analysisStages.length);
    }, 1100);

    return () => clearInterval(timer);
  }, [analysisStages.length, loading]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cachedPlannerCities, cachedDestinations] = await Promise.all([
          getJSON<string[]>(KEYS.PLANNER_CITIES_CACHE_V1),
          getJSON<any[]>(KEYS.DESTINATIONS_CACHE_V1),
        ]);

        if (!active) return;

        const cachedDestinationNames = Array.isArray(cachedDestinations)
          ? getDestinationNamesFromItems(cachedDestinations)
          : [];
        const mergedCached = mergeCityLists(cachedPlannerCities || [], cachedDestinationNames);
        if (mergedCached.length > 0) {
          setCities(mergedCached);
        }
      } catch {}

      try {
        const [cityRes, destinationRes] = await Promise.all([
          citiesAPI.getAll().catch(() => null),
          destinationsAPI.getAll({ limit: 150 }).catch(() => null),
        ]);
        const cityPayload = cityRes ? extractApiData<any>(cityRes) : null;
        const destinationPayload = destinationRes ? extractApiData<any>(destinationRes) : null;
        const coverageItems = Array.isArray(cityPayload?.items) ? cityPayload.items : [];
        const items = Array.isArray(destinationPayload?.items) ? destinationPayload.items : [];
        const names = mergeCityLists(
          coverageItems.map((item: any) => String(item.city || '')),
          getDestinationNamesFromItems(items)
        );
        const mergedRemote = mergeCityLists(names);
        if (active && mergedRemote.length > 0) {
          setCities(mergedRemote);
        }
        if (names.length > 0) {
          await saveJSON(KEYS.PLANNER_CITIES_CACHE_V1, names);
        }
        if (items.length > 0) {
          await saveJSON(KEYS.DESTINATIONS_CACHE_V1, items);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const token = await getItem(KEYS.TOKEN);
          if (!active) return;
          const hasToken = Boolean(token);
          setIsAuthed(hasToken);
          setAuthBootstrapDone(true);
        } catch {
          if (!active) return;
          setIsAuthed(false);
          setAuthBootstrapDone(true);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const duration = useMemo(() => getDuration(form.startDate, form.endDate), [form.endDate, form.startDate]);
  const budgetRaw = useMemo(() => parseInt(form.budget.replace(/\D/g, ''), 10) || 0, [form.budget]);
  const budgetUzs = useMemo(() => (form.currency === 'USD' ? Math.round(budgetRaw * USD_TO_UZS) : budgetRaw), [budgetRaw, form.currency]);
  const budgetHelperText = useMemo(() => {
    if (budgetRaw <= 0) return '-';
    if (form.currency === 'USD') {
      return `~ ${formatSum(budgetUzs)}`;
    }
    const usd = Math.round(budgetUzs / USD_TO_UZS);
    return `~ $${usd} USD`;
  }, [budgetRaw, budgetUzs, form.currency]);
  const progressWidth = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    [progress]
  );
  const plannerMetrics = useMemo(
    () => [
      { label: tt('planner.metricCity', 'Shahar'), value: form.city || '-' },
      { label: tt('planner.metricDays', 'Kun'), value: duration > 0 ? String(duration) : '-' },
      { label: tt('planner.metricBudget', 'Byudjet'), value: budgetUzs > 0 ? formatSum(budgetUzs) : '-' },
    ],
    [budgetUzs, duration, form.city, tt]
  );

  const validate = useCallback(
    (i: number) => {
      if (i === 0) {
        if (!form.city.trim()) return Alert.alert(t('planner.errorTitle'), tt('planner.errorCityRequired', 'Enter city.')), false;
        if (!parseISO(form.startDate) || !parseISO(form.endDate)) return Alert.alert(t('planner.errorTitle'), tt('planner.errorDateFormat', 'Date format: YYYY-MM-DD')), false;
        if (duration <= 0) return Alert.alert(t('planner.errorTitle'), tt('planner.errorEndBeforeStart', 'End date must be after start date.')), false;
        if (duration > MAX_DAYS) {
          return Alert.alert(
            t('planner.errorTitle'),
            tt('planner.errorMaxDays', `Maximum ${MAX_DAYS} days.`).replace('{{max}}', String(MAX_DAYS))
          ), false;
        }
      }
      if (i === 2 && budgetUzs < MIN_BUDGET_UZS) return Alert.alert(t('planner.errorTitle'), t('planner.errorMinBudget')), false;
      if (i === 3 && form.interests.length === 0) return Alert.alert(t('planner.errorTitle'), t('planner.errorMinInterest')), false;
      return true;
    },
    [budgetUzs, duration, form.city, form.endDate, form.interests.length, form.startDate, t, tt]
  );

  const onNext = () => validate(step) && setStep((s) => Math.min(s + 1, steps.length - 1));
  const onBack = () => setStep((s) => Math.max(s - 1, 0));
  const applyDatePreset = useCallback(
    (days: number) => {
      const startDate = parseISO(form.startDate) ? form.startDate : today;
      setForm((p) => ({ ...p, startDate, endDate: addDays(startDate, days - 1) }));
    },
    [form.startDate, today]
  );

  const onGenerate = async () => {
    if (!validate(0) || !validate(2) || !validate(3)) return;
    setLoading(true);
    setAnalysisSummary(null);

    const tips = [
      form.companions === 'family'
        ? tt('planner.tipFamily', 'Family mode: safe and calm places prioritized.')
        : form.companions === 'couple'
          ? tt('planner.tipCouple', 'Couple mode: romantic evening options added.')
          : tt('planner.tipCompanion', 'Companion-based suggestions were added.'),
      form.transport === 'cheap'
        ? tt('planner.tipTransportCheap', 'Transport: budget options prioritized.')
        : form.transport === 'fast'
          ? tt('planner.tipTransportFast', 'Transport: fast options prioritized.')
          : tt('planner.tipTransportComfort', 'Transport: comfort prioritized.'),
      form.food === 'none'
        ? tt('planner.tipFoodGeneral', 'Food: general recommendations included.')
        : tt('planner.tipFoodPref', 'Food preference: {{food}}.').replace('{{food}}', foodLabels[form.food]),
      form.flexibility === 'flexible'
        ? tt('planner.tipFlexible', 'Flexible mode: optional activities added.')
        : tt('planner.tipFixed', 'Fixed mode: tighter schedule applied.'),
    ];

    const cityName = form.city.trim();
    const departureCity = cityName;

    try {
      const poiContextPromise = loadCityPoiPoints(cityName).catch(() => [] as PoiPayload[]);
      const cityPoints = await Promise.race([
        poiContextPromise,
        new Promise<PoiPayload[]>((resolve) => setTimeout(() => resolve([]), POI_CONTEXT_SOFT_TIMEOUT_MS)),
      ]);

      const poiContext = buildPoiContextItems(cityName, cityPoints);
      const poiInsight = cityPoints.length ? buildPoiInsight(cityName, cityPoints, form, duration) : null;

      if (poiInsight) {
        tips.push(
          tt('planner.tipPoiAnalysis', '{{city}} analysis: {{count}} places, estimated daily cost {{cost}}.')
            .replace('{{city}}', poiInsight.city)
            .replace('{{count}}', String(poiInsight.totalPoi))
            .replace('{{cost}}', formatSum(poiInsight.estimatedDayCost))
        );
        if (poiInsight.recommendedNames.length > 0) {
          tips.push(
            tt('planner.tipPoiBest', 'Best matching places: {{places}}.')
              .replace('{{places}}', poiInsight.recommendedNames.slice(0, 4).join(', '))
          );
        }
        if (budgetUzs > 0 && poiInsight.estimatedTripCost > budgetUzs) {
          tips.push(
            tt('planner.tipOverBudget', 'Warning: estimated cost is above budget ({{cost}}).')
              .replace('{{cost}}', formatSum(poiInsight.estimatedTripCost))
          );
        }
        setAnalysisSummary(
          tt('planner.analysisSummary', '{{city}}: {{count}} places analyzed, estimated total {{cost}}.')
            .replace('{{city}}', poiInsight.city)
            .replace('{{count}}', String(poiInsight.totalPoi))
            .replace('{{cost}}', formatSum(poiInsight.estimatedTripCost))
        );
      }

      const payload = buildPlannerPayload(
        form,
        cityName,
        departureCity,
        duration,
        budgetUzs,
        poiInsight,
        poiContext
      );
      const response = await plannerAPI.generate(payload);

      const plan = normalizePlan(
        response?.data ?? response,
        form,
        duration,
        Array.from(new Set(tips)).slice(0, 10),
        normalizePlanLabels,
        {
          status: 'final',
          source: 'backend',
        }
      );
      await saveJSON(KEYS.CURRENT_PLAN, plan);
      setStep(0);
      router.push('/planner-result' as any);
    } catch (err: any) {
      const errorDetail =
        getErrorMessage(err) ||
        tt('planner.generateErrorDefault', 'Serverdan javob kelmadi. Internet va backendni tekshirib qayta urinib ko`ring.');
      Alert.alert(
        t('planner.errorTitle'),
        tt('planner.generateErrorWithReason', 'Reja yaratilmadi: {{error}}').replace('{{error}}', errorDetail)
      );
    } finally {
      setLoading(false);
    }
  };

  if (!authBootstrapDone) {
    return (
      <View style={[styles.bootWrap, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.bootTxt}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!isAuthed) {
    return (
      <View style={[styles.authGate, { paddingTop: insets.top }]}>
        <View style={styles.authIconWrap}><Ionicons name="map-outline" size={36} color={colors.primary} /></View>
        <Text style={styles.authTitle}>{t('planner.authTitle')}</Text>
        <Text style={styles.authSub}>{t('planner.authSub')}</Text>
        <View style={styles.authActions}>
          <TouchableOpacity style={styles.authPrimaryBtn} onPress={() => router.push('/login' as any)}>
            <Text style={styles.authPrimaryBtnTxt}>{t('planner.login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.authOutlineBtn} onPress={() => router.push('/register' as any)}>
            <Text style={styles.authOutlineBtnTxt}>{t('planner.register')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/side-menu' as any)} activeOpacity={0.82}>
          <Ionicons name="menu" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.brand}>TravelorAI</Text>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.82}>
          <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.pageIntroRow}>
        <View style={styles.flex}>
          <Text style={styles.pageTitle}>AI Reja</Text>
          <Text style={styles.pageSubtitle}>Sayohatingizni AI yordamida bosqichma-bosqich rejalashtiring.</Text>
        </View>
        <TouchableOpacity style={styles.plansBtn} onPress={openMyPlans} activeOpacity={0.84}>
          <Ionicons name="albums-outline" size={15} color={colors.primary} />
          <Text style={styles.plansBtnTxt}>Rejalarim</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
            <View style={styles.heroOrbOne} />
            <View style={styles.heroOrbTwo} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles-outline" size={14} color={colors.gold} />
                <Text style={styles.heroBadgeTxt}>AI Concierge</Text>
              </View>
              <Text style={styles.stepTxt}>{step + 1}/{steps.length}</Text>
            </View>
            <Text style={styles.title}>{t('planner.title')}</Text>
            <Text style={styles.subtitle}>{steps[step]}</Text>
            <View style={styles.heroMetrics}>
              {plannerMetrics.map((item) => (
                <View key={item.label} style={styles.heroMetric}>
                  <Text style={styles.heroMetricValue} numberOfLines={1}>{item.value}</Text>
                  <Text style={styles.heroMetricLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: progressWidth }]} /></View>
          </View>
          <View style={styles.stepRail}>
            {steps.map((item, index) => (
          <TouchableOpacity
            key={`${item}-${index}`}
            style={[styles.stepDot, index === step && styles.stepDotActive, index < step && styles.stepDotDone]}
            activeOpacity={0.82}
            onPress={() => {
              if (index <= step || validate(step)) setStep(index);
            }}
          >
            <Text style={[styles.stepDotText, (index === step || index < step) && styles.stepDotTextActive]}>{index + 1}</Text>
          </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {analysisSummary ? (
          <View style={styles.analysisSummaryBox}>
            <Ionicons name="analytics-outline" size={18} color={colors.info} />
            <Text style={styles.analysisSummaryTxt}>{analysisSummary}</Text>
          </View>
        ) : null}
        <Animated.View style={[styles.card, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Ionicons
                name={(step === 0 ? 'location-outline' : step === 1 ? 'people-outline' : step === 2 ? 'wallet-outline' : step === 3 ? 'star-outline' : step === 4 ? 'options-outline' : 'checkmark-done-outline') as any}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardKicker}>{tt('planner.stepKicker', 'Reja bosqichi')} {step + 1}</Text>
              <Text style={styles.cardTitle}>{steps[step]}</Text>
            </View>
          </View>
          {step === 0 ? (
            <>
              <Text style={styles.label}>{tt('planner.countryFixed', 'Global destinations')}</Text>
              <TextInput
                style={styles.input}
                value={form.city}
                onChangeText={(v) => setForm((p) => ({ ...p, city: v }))}
                placeholder={tt('planner.cityPlaceholder', 'City')}
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.rowWrap}>{cities.slice(0, 12).map((c) => <TouchableOpacity key={c} style={[styles.chip, form.city.toLowerCase() === c.toLowerCase() && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, city: c }))}><Text style={[styles.chipTxt, form.city.toLowerCase() === c.toLowerCase() && styles.chipTxtActive]}>{c}</Text></TouchableOpacity>)}</View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.flex]}
                  value={form.startDate}
                  onChangeText={(v) => setForm((p) => ({ ...p, startDate: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.flex]}
                  value={form.endDate}
                  onChangeText={(v) => setForm((p) => ({ ...p, endDate: v }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.rowWrap}>
                {datePresets.map((preset) => (
                  <TouchableOpacity key={preset.days} style={styles.quick} onPress={() => applyDatePreset(preset.days)}>
                    <Text style={styles.quickTxt}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.small}>
                {duration > 0
                  ? tt('planner.durationValue', '{{days}} days').replace('{{days}}', String(duration))
                  : tt('planner.invalidDateFormat', 'Check date format')}
              </Text>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <View style={styles.rowWrap}>
                {(['solo', 'friends', 'family', 'couple'] as Companions[]).map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, form.companions === c && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, companions: c, travelers: c === 'solo' ? 1 : c === 'couple' && p.travelers < 2 ? 2 : p.travelers }))}>
                    <Text style={[styles.chipTxt, form.companions === c && styles.chipTxtActive]}>{companionLabels[c]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.stepper}><TouchableOpacity style={styles.stepBtn} onPress={() => setForm((p) => ({ ...p, travelers: Math.max(form.companions === 'couple' ? 2 : 1, p.travelers - 1) }))}><Text style={styles.stepBtnTxt}>-</Text></TouchableOpacity><Text style={styles.stepVal}>{form.travelers}</Text><TouchableOpacity style={styles.stepBtn} onPress={() => setForm((p) => ({ ...p, travelers: Math.min(8, p.travelers + 1) }))}><Text style={styles.stepBtnTxt}>+</Text></TouchableOpacity></View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={styles.rowWrap}>{(['UZS', 'USD'] as Currency[]).map((c) => <TouchableOpacity key={c} style={[styles.chip, form.currency === c && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, currency: c }))}><Text style={[styles.chipTxt, form.currency === c && styles.chipTxtActive]}>{c}</Text></TouchableOpacity>)}</View>
              <View style={styles.row}><TextInput style={[styles.input, styles.flex]} value={form.budget} onChangeText={(v) => setForm((p) => ({ ...p, budget: v.replace(/\D/g, '').slice(0, 9) }))} keyboardType="numeric" placeholder={tt('planner.budgetPlaceholderShort', 'Budget')} placeholderTextColor={colors.textMuted} /><Text style={styles.currency}>{form.currency}</Text></View>
              <Text style={styles.small}>{budgetHelperText}</Text>
              <View style={styles.rowWrap}>{(form.currency === 'USD' ? [50, 100, 200] : [500000, 1000000, 2000000]).map((n) => <TouchableOpacity key={n} style={styles.quick} onPress={() => setForm((p) => ({ ...p, budget: String(n) }))}><Text style={styles.quickTxt}>{form.currency === 'USD' ? `$${n}` : formatSum(n)}</Text></TouchableOpacity>)}</View>
              <View style={styles.rowWrap}>{TRAVEL_STYLE_OPTIONS.map((s) => <TouchableOpacity key={s.key} style={[styles.chip, form.style === s.key && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, style: s.key }))}><Text style={[styles.chipTxt, form.style === s.key && styles.chipTxtActive]}>{styleLabels[s.key]}</Text></TouchableOpacity>)}</View>
            </>
          ) : null}

          {step === 3 ? (
            <View style={styles.rowWrap}>
              {INTEREST_OPTIONS.map((it) => {
                const active = form.interests.includes(it.key);
                return <TouchableOpacity key={it.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, interests: active ? p.interests.filter((x) => x !== it.key) : [...p.interests, it.key] }))}><Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{interestLabels[it.key] || it.key}</Text></TouchableOpacity>;
              })}
            </View>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={styles.label}>{tt('planner.foodLabelShort', 'Food')}</Text>
              <View style={styles.rowWrap}>{(['halal', 'vegetarian', 'vegan', 'none'] as FoodPref[]).map((x) => <TouchableOpacity key={x} style={[styles.chip, form.food === x && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, food: x }))}><Text style={[styles.chipTxt, form.food === x && styles.chipTxtActive]}>{foodLabels[x]}</Text></TouchableOpacity>)}</View>
              <Text style={styles.label}>{tt('planner.transportLabelShort', 'Transport')}</Text>
              <View style={styles.rowWrap}>{(['cheap', 'fast', 'comfort'] as TransportPref[]).map((x) => <TouchableOpacity key={x} style={[styles.chip, form.transport === x && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, transport: x }))}><Text style={[styles.chipTxt, form.transport === x && styles.chipTxtActive]}>{transportLabels[x]}</Text></TouchableOpacity>)}</View>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <View style={styles.rowWrap}>{(['fixed', 'flexible'] as Flexibility[]).map((x) => <TouchableOpacity key={x} style={[styles.chip, form.flexibility === x && styles.chipActive]} onPress={() => setForm((p) => ({ ...p, flexibility: x }))}><Text style={[styles.chipTxt, form.flexibility === x && styles.chipTxtActive]}>{flexibilityLabels[x]}</Text></TouchableOpacity>)}</View>
              <Text style={styles.small}>{`${tt('planner.summaryCity', 'City')}: ${form.city}\n${tt('planner.summaryDates', 'Dates')}: ${form.startDate} - ${form.endDate}\n${tt('planner.summaryCompanions', 'Companions')}: ${companionLabels[form.companions]}\n${tt('planner.summaryBudget', 'Budget')}: ${form.budget || 0} ${form.currency}\n${tt('planner.summaryStyle', 'Style')}: ${styleLabels[form.style]}\n${tt('planner.summaryInterests', 'Interests')}: ${form.interests.map((item) => interestLabels[item] || item).join(', ')}`}</Text>
            </>
          ) : null}
        </Animated.View>
        <View style={{ height: 206 + safeBottom }} />
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: safeBottom + 104 }]}>
            {step > 0 ? <TouchableOpacity style={styles.outlineBtn} onPress={onBack}><Text style={styles.outlineBtnTxt}>{t('planner.back')}</Text></TouchableOpacity> : null}
            <TouchableOpacity style={[styles.primaryBtn, step === 0 && styles.full]} onPress={step < steps.length - 1 ? onNext : onGenerate} disabled={loading} activeOpacity={0.9}>
              <LinearGradient colors={colors.gradientPrimary as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnFill}>
                <Text style={styles.primaryBtnTxt}>{step < steps.length - 1 ? t('planner.next') : loading ? t('planner.generating') : tt('planner.generateBtn', 'AI Reja yaratish')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <LottieAnim name="ai-loading" size={96} />
            <Text style={styles.loadingTitle}>{tt('planner.loadingTitle', 'Creating AI trip plan')}</Text>
            <Text style={styles.loadingStage}>{analysisStages[loadingStageIndex] || analysisStages[0]}</Text>
            <Text style={styles.loadingSub}>
              {tt('planner.loadingSub', 'Places, prices, transport and food suggestions are being analyzed together...')}
            </Text>
          </View>
        </View>
      )}

    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    bootWrap: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    bootTxt: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textSecondary },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.md,
    },
    iconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 2,
    },
    brand: {
      fontFamily: FONTS.display,
      fontSize: 13,
      color: colors.text,
    },
    pageIntro: {
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    pageIntroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    plansBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 38,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primaryPale,
    },
    plansBtnTxt: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.primary,
    },
    pageTitle: {
      fontFamily: FONTS.display,
      fontSize: 24,
      color: colors.text,
      marginBottom: 4,
    },
    pageSubtitle: {
      maxWidth: 300,
      fontFamily: FONTS.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    segmentWrap: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    segmentBtn: {
      flex: 1,
      minHeight: 118,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      elevation: 2,
    },
    segmentBtnActive: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 3,
    },
    segmentIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentIconCircleActive: {
      backgroundColor: 'rgba(33, 220, 143, 0.34)',
    },
    segmentIconCircleMuted: {
      backgroundColor: 'rgba(99, 132, 255, 0.16)',
    },
    segmentTxt: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.text,
      textAlign: 'center',
    },
    segmentTxtActive: {
      color: colors.text,
    },
    toursScroll: { flex: 1 },
    toursHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    toursTitle: {
      fontFamily: FONTS.display,
      fontSize: 18,
      color: colors.text,
    },
    seeAll: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.success,
    },
    tourCard: {
      height: 312,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.primary,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 7,
    },
    tourImage: { flex: 1, justifyContent: 'space-between' },
    tourImageRadius: { borderRadius: 24 },
    tourImagePlaceholder: { borderRadius: 24, backgroundColor: colors.primary },
    tourScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(4,10,18,0.34)',
    },
    toursStateCard: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.lg,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: SPACING.lg,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    toursStateTitle: {
      fontFamily: FONTS.display,
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
    },
    toursStateText: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      textAlign: 'center',
    },
    tourTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.md,
    },
    tourBadge: {
      borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.24)',
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    tourBadgeTxt: {
      fontFamily: FONTS.semibold,
      fontSize: 9,
      letterSpacing: 0.7,
      color: colors.textInverse,
    },
    tourRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    tourRatingTxt: {
      fontFamily: FONTS.semibold,
      fontSize: 10,
      color: colors.text,
    },
    tourContent: { padding: SPACING.md },
    tourDays: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    tourDaysTxt: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      color: 'rgba(255,255,255,0.82)',
    },
    tourTitle: {
      fontFamily: FONTS.display,
      fontSize: 30,
      lineHeight: 34,
      color: colors.textInverse,
    },
    tourSub: {
      marginTop: 2,
      maxWidth: 290,
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 17,
      color: 'rgba(255,255,255,0.86)',
    },
    tourFooter: {
      marginTop: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fromTxt: {
      fontFamily: FONTS.regular,
      fontSize: 10,
      color: 'rgba(255,255,255,0.72)',
    },
    tourPrice: {
      fontFamily: FONTS.display,
      fontSize: 20,
      color: colors.textInverse,
    },
    detailsBtn: {
      minWidth: 118,
      height: 36,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
    },
    detailsBtnTxt: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textInverse,
    },
    fab: {
      position: 'absolute',
      right: SPACING.lg,
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
      elevation: 10,
    },
    quickOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 60,
    },
    quickDismiss: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.68)',
    },
    quickActions: {
      position: 'absolute',
      right: SPACING.lg,
      gap: SPACING.lg,
      alignItems: 'flex-end',
    },
    quickActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: SPACING.md,
    },
    quickActionText: {
      fontFamily: FONTS.display,
      fontSize: 22,
      color: '#fff',
      textAlign: 'right',
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    quickActionIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.24,
      shadowRadius: 28,
      elevation: 14,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    hero: {
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.sm,
      marginBottom: SPACING.md,
      padding: SPACING.xl,
      borderRadius: RADIUS.xxl,
      backgroundColor: colors.primary,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.22,
      shadowRadius: 32,
      elevation: 10,
    },
    heroOrbOne: {
      position: 'absolute',
      width: 170,
      height: 170,
      borderRadius: 85,
      right: -60,
      top: -54,
      backgroundColor: 'rgba(104,219,169,0.18)',
    },
    heroOrbTwo: {
      position: 'absolute',
      width: 118,
      height: 118,
      borderRadius: 59,
      left: -34,
      bottom: -50,
      backgroundColor: 'rgba(222,194,154,0.16)',
    },
    heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.10)',
    },
    heroBadgeTxt: { fontFamily: FONTS.medium, fontSize: 11, color: 'rgba(255,255,255,0.84)' },
    title: { fontFamily: FONTS.display, fontSize: 31, lineHeight: 38, color: colors.textInverse },
    stepTxt: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textInverse,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.12)',
      overflow: 'hidden',
    },
    subtitle: { fontFamily: FONTS.regular, fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: SPACING.sm, lineHeight: 21 },
    heroMetrics: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.md },
    heroMetric: {
      flex: 1,
      borderRadius: RADIUS.lg,
      backgroundColor: 'rgba(255,255,255,0.10)',
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    heroMetricValue: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.textInverse },
    heroMetricLabel: { marginTop: 3, fontFamily: FONTS.regular, fontSize: 10, color: 'rgba(255,255,255,0.62)' },
    progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.full, overflow: 'hidden' },
    progressFill: { height: 6, backgroundColor: colors.aiAccent, borderRadius: RADIUS.full },
    stepRail: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
    stepDot: {
      flex: 1,
      height: 34,
      borderRadius: RADIUS.md,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    stepDotActive: { backgroundColor: colors.primary },
    stepDotDone: { backgroundColor: colors.success },
    stepDotText: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted },
    stepDotTextActive: { color: colors.textInverse },
    prefill: { marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, marginTop: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surface, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    prefillTxt: { flex: 1, fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary },
    analysisSummaryBox: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.infoPale,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    analysisSummaryTxt: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.info,
      lineHeight: 18,
    },
    link: { fontFamily: FONTS.semibold, color: colors.primary, fontSize: 12 },
    scroll: { flex: 1 },
    card: {
      marginHorizontal: SPACING.lg,
      padding: SPACING.lg,
      borderRadius: RADIUS.xxl,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
    cardIcon: {
      width: 50,
      height: 50,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
    },
    cardHeaderCopy: { flex: 1 },
    cardKicker: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 3,
    },
    cardTitle: { fontFamily: FONTS.display, fontSize: 20, color: colors.text },
    input: { height: 50, borderRadius: RADIUS.lg, backgroundColor: colors.cardMuted, paddingHorizontal: SPACING.md, color: colors.text, fontFamily: FONTS.medium, marginBottom: SPACING.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    flex: { flex: 1 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    label: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
    small: { fontFamily: FONTS.regular, fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: SPACING.xs },
    chip: { borderRadius: RADIUS.md, backgroundColor: colors.cardMuted, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    chipActive: { backgroundColor: colors.primary },
    chipTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.textSecondary },
    chipTxtActive: { color: colors.textInverse },
    quick: { borderRadius: RADIUS.md, backgroundColor: colors.primaryPale, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    quickTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.primary },
    currency: { fontFamily: FONTS.semibold, color: colors.textSecondary, marginBottom: SPACING.sm },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.md, marginTop: SPACING.md },
    stepBtn: { width: 38, height: 38, borderRadius: RADIUS.full, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center' },
    stepBtnTxt: { fontFamily: FONTS.semibold, fontSize: 20, color: colors.primary },
    stepVal: { minWidth: 36, textAlign: 'center', fontFamily: FONTS.semibold, fontSize: 22, color: colors.text },
    footer: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      backgroundColor: colors.glassStrong,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
      elevation: 12,
    },
    primaryBtn: { flex: 2, height: 52, borderRadius: RADIUS.button, overflow: 'hidden', ...primaryGlow(colors) },
    primaryBtnFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    primaryBtnTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: colors.onGradient },
    outlineBtn: { flex: 1, height: 52, borderRadius: RADIUS.md, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center' },
    outlineBtnTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.primary },
    full: { flex: 1 },
    authGate: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
    authIconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
    authTitle: { fontFamily: FONTS.display, fontSize: 24, color: colors.text, textAlign: 'center', marginBottom: SPACING.sm },
    authSub: { fontFamily: FONTS.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
    authActions: { width: '100%', maxWidth: 360, gap: SPACING.md },
    authPrimaryBtn: {
      width: '100%',
      height: 54,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authPrimaryBtnTxt: { fontFamily: FONTS.semibold, fontSize: 17, color: '#fff' },
    authOutlineBtn: {
      width: '100%',
      height: 54,
      borderRadius: RADIUS.full,
      borderWidth: 1.5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    authOutlineBtnTxt: { fontFamily: FONTS.semibold, fontSize: 17, color: colors.primary },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.38)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      zIndex: 99,
    },
    loadingCard: {
      width: '100%',
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xl,
      gap: SPACING.sm,
    },
    loadingTitle: {
      marginTop: SPACING.sm,
      fontFamily: FONTS.semibold,
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
    },
    loadingStage: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.primary,
      textAlign: 'center',
    },
    loadingSub: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });
}
