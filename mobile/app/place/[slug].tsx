import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ImageBackground, ActivityIndicator, FlatList, Linking, Dimensions, Alert, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { extractApiData } from '../../src/utils/auth';
import { poiAPI, type PoiPayload } from '../../src/utils/api';
import { KEYS, getJSON } from '../../src/utils/storage';
import { useWishlist } from '../../src/hooks/useWishlist';

const { width: SCREEN_W } = Dimensions.get('window');
const YANDEX_STATIC_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_YANDEX_STATIC_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY ||
  '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeLabel(type: string): string {
  const k = String(type || '').toLowerCase();
  if (k === 'landmark') return 'Landmark';
  if (k === 'restaurant') return 'Restoran';
  if (k === 'hotel') return 'Mehmonxona';
  if (k === 'transport') return 'Transport';
  return 'Joy';
}

function formatSubtype(value?: string | null): string {
  const k = String(value || '').toLowerCase();
  if (!k) return '';
  if (k === 'historical') return 'Tarixiy';
  if (k === 'mosque') return 'Masjid';
  if (k === 'train') return 'Temir yo\'l';
  if (k === 'airport') return 'Aeroport';
  if (k === 'bus') return 'Avtobus';
  if (k === 'taxi') return 'Taksi';
  if (k === 'cafe') return 'Kafe';
  if (k === 'traditional') return 'Milliy';
  if (k === 'budget') return 'Tejamkor';
  if (k === 'mid') return 'O\'rtacha';
  if (k === 'luxury') return 'Yuqori darajali';
  if (k === 'park') return 'Park';
  if (k === 'shopping') return 'Savdo';
  return k;
}

function getPriceLevelLabel(level: number): string {
  if (level === 0) return 'Bepul';
  if (level === 1) return 'Arzon';
  if (level === 2) return 'O\'rtacha';
  if (level === 3) return 'Qimmat';
  if (level === 4) return 'Juda qimmat';
  return '';
}

function getTodayHours(hours?: string[] | null): string | null {
  if (!hours || hours.length === 0) return null;
  const todayIdx = new Date().getDay(); // 0=Sunday
  const todayLine = hours[todayIdx === 0 ? 6 : todayIdx - 1];
  return todayLine || hours[0] || null;
}

function extractAddress(info?: string): string {
  if (!info) return '';
  return info.split(' | ')[0] || info;
}

function formatSourceLabel(source?: string | null): string {
  const normalized = String(source || '').toLowerCase();
  if (normalized.includes('yandex')) return 'Yandex';
  if (normalized.includes('osm') || normalized.includes('openstreetmap')) return 'OpenStreetMap';
  if (normalized.includes('travelorai')) return 'TravelorAI verified';
  return source || 'TravelorAI database';
}

function formatConfidenceScore(score?: number | null): string {
  if (score == null || !Number.isFinite(Number(score))) return 'Noma\'lum';
  const value = Number(score) <= 1 ? Number(score) * 100 : Number(score);
  return `${Math.round(Math.max(0, Math.min(value, 100)))}%`;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('uz-UZ');
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function parseOptionalNumber(value: string | string[] | undefined): number | null {
  const parsed = Number(firstParam(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStringArray(value: string | string[] | undefined): string[] {
  const raw = firstParam(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  return (
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Number(lat) >= -90 &&
    Number(lat) <= 90 &&
    Number(lng) >= -180 &&
    Number(lng) <= 180
  );
}

function getYandexStaticMapPreviewUrl(lat?: number | null, lng?: number | null, width = 720, height = 420): string | null {
  if (!YANDEX_STATIC_MAPS_API_KEY || !isValidCoordinate(lat, lng)) return null;
  const params = new URLSearchParams({
    apikey: YANDEX_STATIC_MAPS_API_KEY,
    lang: 'ru_RU',
    ll: `${lng},${lat}`,
    z: '16',
    size: `${width},${height}`,
    pt: `${lng},${lat},pm2rdm`,
  });
  return `https://static-maps.yandex.ru/v1?${params.toString()}`;
}

function getPoiPreviewImageUrl(item: Pick<PoiPayload, 'imageUrl' | 'lat' | 'lng'>, width = 720, height = 420): string | null {
  return item.imageUrl || getYandexStaticMapPreviewUrl(item.lat, item.lng, width, height);
}

// ─── Small sub-components ─────────────────────────────────────────────────────

async function openExternalUrl(appUrl: string, webUrl: string) {
  if (Platform.OS !== 'web') {
    try {
      await Linking.openURL(appUrl);
      return;
    } catch {
      // Fall back to web below when the Yandex app is not installed.
    }
  }
  await Linking.openURL(webUrl);
}

function StarRating({ rating, count, colors }: { rating: number; count?: number | null; colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={15} color={colors.gold} />
      <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: colors.text }}>{rating.toFixed(1)}</Text>
      {!!count && (
        <Text style={{ fontFamily: FONTS.regular, fontSize: 12, color: colors.textMuted }}>
          ({count.toLocaleString()} sharh)
        </Text>
      )}
    </View>
  );
}

function PriceDots({ level, colors }: { level: number; colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: i < level ? colors.gold : colors.borderLight,
          }}
        />
      ))}
      <Text style={{ fontFamily: FONTS.medium, fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}>
        {getPriceLevelLabel(level)}
      </Text>
    </View>
  );
}

function SectionCard({ title, children, colors }: { title: string; children: React.ReactNode; colors: AppColors }) {
  return (
    <View style={{
      backgroundColor: colors.surface, borderRadius: RADIUS.lg,
      borderWidth: 1, borderColor: colors.borderLight,
      marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
      overflow: 'hidden',
    }}>
      <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm }}>
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {title}
        </Text>
      </View>
      <View style={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.md }}>
        {children}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function QualityRow({
  icon,
  label,
  value,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: AppColors;
  onPress?: () => void;
}) {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8 }}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primaryPale,
      }}>
        <Ionicons name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.textMuted }}>{label}</Text>
        <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.text }}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="open-outline" size={15} color={colors.textMuted} /> : null}
    </Container>
  );
}

function RelatedPreviewImage({ item, colors, styles }: { item: PoiPayload; colors: AppColors; styles: ReturnType<typeof createStyles> }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : getPoiPreviewImageUrl(item, 320, 220);

  if (imageUrl) {
    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.relatedImg}
        imageStyle={styles.relatedImgRadius}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.relatedImg, { backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="location-outline" size={28} color={colors.primary} />
    </View>
  );
}

export default function PlaceDetailScreen() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const slug = firstParam(params.slug);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<PoiPayload | null>(null);
  const [related, setRelated] = useState<PoiPayload[]>([]);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [staticHeroFailed, setStaticHeroFailed] = useState(false);
  const galleryRef = useRef<FlatList>(null);
  const { isWishlisted, toggle: toggleWishlist } = useWishlist(userId);

  const fallbackPlace: PoiPayload | null = useMemo(() => {
    const name = firstParam(params.name);
    const lat = parseOptionalNumber(params.lat);
    const lng = parseOptionalNumber(params.lng);
    if (!slug || !name || lat == null || lng == null) return null;

    return {
      id: firstParam(params.id) || slug,
      name,
      city: firstParam(params.city) || 'Yandex Maps',
      slug,
      type: firstParam(params.type) || 'landmark',
      subtype: firstParam(params.subtype) || null,
      lat,
      lng,
      info: firstParam(params.info),
      description: firstParam(params.description) || firstParam(params.info) || null,
      imageUrl: firstParam(params.imageUrl) || null,
      gallery: parseStringArray(params.gallery),
      priceLevel: parseOptionalNumber(params.priceLevel),
      price: parseOptionalNumber(params.price),
      rating: parseOptionalNumber(params.rating),
      ratingCount: parseOptionalNumber(params.ratingCount),
      phone: firstParam(params.phone) || null,
      website: firstParam(params.website) || null,
      openingHours: parseStringArray(params.openingHours),
      icon: firstParam(params.icon) || 'pin',
      source: firstParam(params.source) || null,
      sourceUrl: firstParam(params.sourceUrl) || null,
      lastVerifiedAt: firstParam(params.lastVerifiedAt) || null,
      confidenceScore: parseOptionalNumber(params.confidenceScore),
      verifiedBy: firstParam(params.verifiedBy) || null,
      priceUpdatedAt: firstParam(params.priceUpdatedAt) || null,
    };
  }, [
    slug,
    params.city,
    params.confidenceScore,
    params.description,
    params.gallery,
    params.icon,
    params.id,
    params.imageUrl,
    params.info,
    params.lastVerifiedAt,
    params.lat,
    params.lng,
    params.name,
    params.openingHours,
    params.phone,
    params.price,
    params.priceLevel,
    params.priceUpdatedAt,
    params.rating,
    params.ratingCount,
    params.source,
    params.sourceUrl,
    params.subtype,
    params.type,
    params.verifiedBy,
    params.website,
  ]);

  useEffect(() => {
    let active = true;
    getJSON<{ id?: string | null }>(KEYS.USER)
      .then((user) => {
        if (active) setUserId(user?.id ?? null);
      })
      .catch(() => {
        if (active) setUserId(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setStaticHeroFailed(false);
  }, [place?.id, place?.lat, place?.lng]);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    (async () => {
      if (active && fallbackPlace) {
        setPlace(fallbackPlace);
        setLoading(false);
      }

      // Try cache first
      const [cachedPlaces, cachedHome] = await Promise.all([
        getJSON<any[]>(KEYS.HOME_PLACES_CACHE_V2),
        getJSON<{ places?: any[] }>(KEYS.HOME_CACHE_V2),
      ]);
      const cachePool = [
        ...(Array.isArray(cachedPlaces) ? cachedPlaces : []),
        ...(Array.isArray(cachedHome?.places) ? cachedHome.places : []),
      ];
      const cachedPlace = cachePool.find((item) => String(item.slug || '').toLowerCase() === String(slug).toLowerCase()) || null;
      if (active && cachedPlace) {
        setPlace((prev) => ({ ...(prev || {}), ...cachedPlace } as PoiPayload));
        setLoading(false);
      }

      // Always fetch fresh from API (has rich fields)
      try {
        const response = await poiAPI.getById(String(slug));
        const payload = extractApiData<PoiPayload>(response);
        if (active && payload) {
          setPlace(payload);
          setLoading(false);
          // Fetch related
          const relRes = await poiAPI.getAll({ city: payload.city, type: payload.type, limit: 8 });
          const relData = extractApiData<any>(relRes);
          const items: PoiPayload[] = Array.isArray(relData)
            ? relData
            : Array.isArray(relData?.items)
            ? relData.items
            : [];
          if (active) setRelated(items.filter((r) => r.slug !== payload.slug).slice(0, 6));
        }
      } catch {
        if (active && !cachedPlace && !fallbackPlace) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [fallbackPlace, slug]);

  const openYandexPlace = useCallback(() => {
    if (!place) return;
    const text = encodeURIComponent(place.name || 'TravelorAI place');
    const webUrl = `https://yandex.com/maps/?ll=${place.lng},${place.lat}&z=16&pt=${place.lng},${place.lat}&text=${text}`;
    const appUrl = `yandexmaps://maps.yandex.com/?ll=${place.lng},${place.lat}&z=16&pt=${place.lng},${place.lat}&text=${text}`;
    openExternalUrl(appUrl, webUrl).catch(() => {
      Alert.alert('Xarita ochilmadi', 'Yandex Maps havolasini ochib bo‘lmadi.');
    });
  }, [place]);

  const openYandexDirections = useCallback(async () => {
    if (!place) return;

    let origin: { latitude: number; longitude: number } | null = null;
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (permission.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        origin = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      }
    } catch {
      origin = null;
    }

    const routeMode = place.type === 'transport' ? 'mt' : 'auto';
    const text = encodeURIComponent(place.name || 'TravelorAI place');
    const pointWebUrl = `https://yandex.com/maps/?ll=${place.lng},${place.lat}&z=16&pt=${place.lng},${place.lat}&text=${text}`;
    const pointAppUrl = `yandexmaps://maps.yandex.com/?ll=${place.lng},${place.lat}&z=16&pt=${place.lng},${place.lat}&text=${text}`;
    const routeWebUrl = origin
      ? `https://yandex.com/maps/?rtext=${origin.latitude},${origin.longitude}~${place.lat},${place.lng}&rtt=${routeMode}`
      : pointWebUrl;
    const routeAppUrl = origin
      ? `yandexmaps://maps.yandex.com/?rtext=${origin.latitude},${origin.longitude}~${place.lat},${place.lng}&rtt=${routeMode}`
      : pointAppUrl;

    openExternalUrl(routeAppUrl, routeWebUrl).catch(() => {
      Alert.alert('Yo‘nalish ochilmadi', 'Yandex Maps yo‘nalishini ochib bo‘lmadi.');
    });
  }, [place]);

  const openPhone = useCallback(() => {
    if (!place?.phone) return;
    Linking.openURL(`tel:${place.phone}`).catch(() => {});
  }, [place]);

  const openWebsite = useCallback(() => {
    if (!place?.website) return;
    Linking.openURL(place.website).catch(() => {});
  }, [place]);

  const handleToggleSaved = useCallback(async () => {
    if (!place) return;
    const source = String(place.source || '').toLowerCase();
    await toggleWishlist({
      id: place.id,
      poiId: source.includes('yandex') ? null : place.id,
      name: place.name,
      city: place.city,
      slug: place.slug || place.id,
      type: place.type || 'landmark',
      icon: place.icon || 'pin',
    });
  }, [place, toggleWishlist]);

  // ── Loading & error states ──────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!place) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>{t('place.notFound', { defaultValue: 'Joy topilmadi' })}</Text>
        <TouchableOpacity style={styles.backFallback} onPress={() => router.back()}>
          <Text style={styles.backFallbackTxt}>{t('common.back', { defaultValue: 'Orqaga' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived data ────────────────────────────────────────────────────────
  const realPhotos: string[] = [
    ...(place.imageUrl ? [place.imageUrl] : []),
    ...(place.gallery || []).filter((u) => u !== place.imageUrl),
  ].slice(0, 6);
  const staticMapPreview = getYandexStaticMapPreviewUrl(place.lat, place.lng);
  const allPhotos: string[] = realPhotos.length > 0
    ? realPhotos
    : staticMapPreview && !staticHeroFailed
    ? [staticMapPreview]
    : [];

  const todayHours = getTodayHours(place.openingHours);
  const address = extractAddress(place.info);
  const subtypeLabel = formatSubtype(place.subtype);
  const hasConfidence = place.confidenceScore != null && Number.isFinite(Number(place.confidenceScore));
  const confidence = hasConfidence ? Number(place.confidenceScore) : null;
  const confidencePercent = formatConfidenceScore(place.confidenceScore);
  const confidenceLabel =
    confidence == null ? 'Tekshirilmagan' : confidence >= 0.75 ? 'Tekshirilgan' : confidence >= 0.55 ? 'O\'rtacha ishonch' : 'Taxminiy';
  const verifiedDate = formatDate(place.lastVerifiedAt);
  const priceUpdatedDate = formatDate(place.priceUpdatedAt);
  const sourceLabel = formatSourceLabel(place.source);
  const isSaved = isWishlisted(place.id) || isWishlisted(place.slug || place.id);

  return (
    <View style={[styles.root]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>

        {/* ── Hero gallery ──────────────────────────────────────────── */}
        <View style={styles.heroWrap}>
          {allPhotos.length > 0 ? (
            <>
              <FlatList
                ref={galleryRef}
                data={allPhotos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => String(i)}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                  setGalleryIndex(idx);
                }}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={{ width: SCREEN_W, height: 300 }}
                    resizeMode="cover"
                    onError={() => {
                      if (item === staticMapPreview) setStaticHeroFailed(true);
                    }}
                  />
                )}
              />
              {allPhotos.length > 1 && (
                <View style={styles.photoPill}>
                  <Text style={styles.photoPillTxt}>{galleryIndex + 1}/{allPhotos.length}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons name="location-outline" size={64} color={colors.primary} />
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity style={[styles.backBtn, { top: SPACING.md + insets.top }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { top: SPACING.md + insets.top }]} onPress={handleToggleSaved} activeOpacity={0.82}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={18} color={isSaved ? '#EF4444' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.name}>{place.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm }}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.city}>{place.city}</Text>
          </View>

          {/* Rating */}
          {!!place.rating && (
            <View style={{ marginBottom: SPACING.sm }}>
              <StarRating rating={place.rating} count={place.ratingCount} colors={colors} />
            </View>
          )}

          {/* Type chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
            <View style={styles.chip}>
              <Text style={styles.chipTxt}>{getTypeLabel(place.type)}</Text>
            </View>
            {!!subtypeLabel && (
              <View style={styles.chip}>
                <Text style={styles.chipTxt}>{subtypeLabel}</Text>
              </View>
            )}
            <View style={styles.verifiedChip}>
              <Text style={styles.verifiedChipTxt}>
                {confidenceLabel}{hasConfidence ? ` • ${confidencePercent}` : ''}{verifiedDate ? ` • ${verifiedDate}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick actions ─────────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          {!!place.phone && (
            <TouchableOpacity style={styles.actionBtn} onPress={openPhone} activeOpacity={0.75}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primaryPale }]}>
                <Ionicons name="call-outline" size={20} color={colors.primary} />
              </View>
              <Text style={styles.actionLbl}>{"Qo'ng'iroq"}</Text>
            </TouchableOpacity>
          )}
          {!!place.website && (
            <TouchableOpacity style={styles.actionBtn} onPress={openWebsite} activeOpacity={0.75}>
              <View style={[styles.actionIcon, { backgroundColor: '#e8f4fd' }]}>
                <Ionicons name="globe-outline" size={20} color="#2563eb" />
              </View>
              <Text style={styles.actionLbl}>Veb-sayt</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={openYandexPlace} activeOpacity={0.75}>
            <View style={[styles.actionIcon, { backgroundColor: '#fef3e2' }]}>
              <Ionicons name="map-outline" size={20} color={colors.gold} />
            </View>
            <Text style={styles.actionLbl}>Xarita</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleToggleSaved} activeOpacity={0.75}>
            <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={colors.primary} />
            </View>
            <Text style={styles.actionLbl}>{isSaved ? 'Saqlangan' : 'Saqlash'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── About ─────────────────────────────────────────────────── */}
        {!!(place.description || place.info) && (
          <SectionCard title="Joy haqida" colors={colors}>
            <Text style={styles.bodyText}>{place.description || place.info}</Text>
          </SectionCard>
        )}

        {/* ── Opening hours ─────────────────────────────────────────── */}
        <SectionCard title="Ma'lumot sifati" colors={colors}>
          <QualityRow icon="shield-checkmark-outline" label="Holat" value={confidenceLabel} colors={colors} />
          <QualityRow icon="analytics-outline" label="Ishonchlilik" value={confidencePercent} colors={colors} />
          <QualityRow
            icon="library-outline"
            label="Manba"
            value={sourceLabel}
            colors={colors}
            onPress={place.sourceUrl ? () => Linking.openURL(place.sourceUrl as string).catch(() => {}) : undefined}
          />
          <QualityRow icon="time-outline" label="Oxirgi tekshiruv" value={verifiedDate || 'Hali tekshirilmagan'} colors={colors} />
          {place.verifiedBy ? (
            <QualityRow icon="person-circle-outline" label="Tekshirgan" value={place.verifiedBy} colors={colors} />
          ) : null}
          {priceUpdatedDate ? (
            <QualityRow icon="pricetag-outline" label="Narx yangilangan" value={priceUpdatedDate} colors={colors} />
          ) : null}
        </SectionCard>

        {!!(place.openingHours && place.openingHours.length > 0) && (
          <SectionCard title="Ish vaqti" colors={colors}>
            {todayHours && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: hoursExpanded ? SPACING.sm : 0 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                <Text style={{ fontFamily: FONTS.semibold, fontSize: 13, color: colors.text, flex: 1 }}>{todayHours}</Text>
                <TouchableOpacity onPress={() => setHoursExpanded((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={hoursExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            {hoursExpanded && place.openingHours.map((line, i) => (
              <Text key={i} style={[styles.bodyText, { marginBottom: 2 }]}>{line}</Text>
            ))}
          </SectionCard>
        )}

        {/* ── Price level ───────────────────────────────────────────── */}
        {place.priceLevel != null && place.priceLevel > 0 && (
          <SectionCard title="Narx darajasi" colors={colors}>
            <PriceDots level={place.priceLevel} colors={colors} />
          </SectionCard>
        )}

        {/* ── Location ──────────────────────────────────────────────── */}
        <SectionCard title="Manzil" colors={colors}>
          {!!address && (
            <Text style={[styles.bodyText, { marginBottom: SPACING.sm }]}>{address}</Text>
          )}
          <TouchableOpacity
            style={styles.mapsBtn}
            onPress={openYandexDirections}
            activeOpacity={0.82}
          >
            <Ionicons name="navigate-outline" size={15} color={colors.primary} />
            <Text style={styles.mapsBtnTxt}>{"Yo'l olish"}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── Extra gallery ─────────────────────────────────────────── */}
        {allPhotos.length > 1 && (
          <View style={{ marginBottom: SPACING.md }}>
            <Text style={[styles.sectionTitle, { marginHorizontal: SPACING.lg, marginBottom: SPACING.sm }]}>
              Rasmlar
            </Text>
            <FlatList
              data={allPhotos}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}
              keyExtractor={(_, i) => `g-${i}`}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    galleryRef.current?.scrollToIndex({ index, animated: true });
                    setGalleryIndex(index);
                  }}
                >
                  <Image
                    source={{ uri: item }}
                    style={{
                      width: 110, height: 80, borderRadius: RADIUS.md,
                      borderWidth: galleryIndex === index ? 2 : 0,
                      borderColor: colors.primary,
                    }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Related places ────────────────────────────────────────── */}
        {related.length > 0 && (
          <View style={{ marginBottom: SPACING.md }}>
            <Text style={[styles.sectionTitle, { marginHorizontal: SPACING.lg, marginBottom: SPACING.sm }]}>
              {`${place.city} dagi o'xshash joylar`}
            </Text>
            <FlatList
              data={related}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SPACING.lg, gap: SPACING.sm }}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.relatedCard}
                  activeOpacity={0.82}
                  onPress={() => router.push(`/place/${item.slug}` as any)}
                >
                  <RelatedPreviewImage item={item} colors={colors} styles={styles} />
                  <View style={{ padding: SPACING.sm }}>
                    <Text style={styles.relatedName} numberOfLines={2}>{item.name}</Text>
                    {!!item.rating && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                        <Ionicons name="star" size={11} color={colors.gold} />
                        <Text style={{ fontFamily: FONTS.medium, fontSize: 11, color: colors.textSecondary }}>
                          {item.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.relatedQualityPill}>
                      <Ionicons name="shield-checkmark-outline" size={10} color={colors.success} />
                      <Text style={styles.relatedQualityText}>
                        {formatConfidenceScore(item.confidenceScore)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Fixed bottom CTA ──────────────────────────────────────────── */}
      <View style={[styles.bottomCta, { paddingBottom: SPACING.md + insets.bottom }]}>
        <View style={styles.bottomCtaRow}>
          <TouchableOpacity style={styles.ctaSecondaryBtn} onPress={handleToggleSaved} activeOpacity={0.85}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={18} color={colors.primary} />
            <Text style={styles.ctaSecondaryTxt}>{isSaved ? 'Saqlangan' : 'Saqlash'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaBtn} onPress={openYandexDirections} activeOpacity={0.85}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.ctaBtnTxt}>{"Yo'l olish"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingHorizontal: SPACING.lg },
    emptyText: { fontFamily: FONTS.medium, fontSize: 15, color: colors.textMuted, marginBottom: SPACING.md },
    backFallback: { borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
    backFallbackTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.primary },

    // Hero
    heroWrap: { height: 300, position: 'relative', backgroundColor: colors.primaryPale },
    heroFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    photoPill: { position: 'absolute', bottom: SPACING.sm, right: SPACING.sm, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
    photoPillTxt: { fontFamily: FONTS.semibold, fontSize: 12, color: '#fff' },
    backBtn: { position: 'absolute', left: SPACING.md, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    saveBtn: { position: 'absolute', right: SPACING.md, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

    // Header
    header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.md },
    name: { fontFamily: FONTS.display, fontSize: 26, color: colors.text, marginBottom: 4 },
    city: { fontFamily: FONTS.medium, fontSize: 13, color: colors.textMuted },
    chip: { borderRadius: RADIUS.full, backgroundColor: colors.primaryPale, borderWidth: 1, borderColor: colors.borderLight, paddingHorizontal: SPACING.md, paddingVertical: 5 },
    chipTxt: { fontFamily: FONTS.medium, fontSize: 12, color: colors.primary },
    verifiedChip: { borderRadius: RADIUS.full, backgroundColor: colors.successPale, borderWidth: 1, borderColor: colors.success, paddingHorizontal: SPACING.md, paddingVertical: 5 },
    verifiedChipTxt: { fontFamily: FONTS.semibold, fontSize: 12, color: colors.success },

    // Actions
    actionsRow: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: SPACING.lg, marginBottom: SPACING.lg, backgroundColor: colors.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderLight, padding: SPACING.md },
    actionBtn: { alignItems: 'center', gap: 6 },
    actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    actionLbl: { fontFamily: FONTS.medium, fontSize: 11, color: colors.textSecondary },

    // Body text
    bodyText: { fontFamily: FONTS.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

    // Maps button
    mapsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 7, alignSelf: 'flex-start' },
    mapsBtnTxt: { fontFamily: FONTS.semibold, fontSize: 13, color: colors.primary },

    // Section title
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: colors.text },

    // Related
    relatedCard: { width: 150, backgroundColor: colors.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
    relatedImg: { width: '100%', height: 100 },
    relatedImgRadius: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
    relatedName: { fontFamily: FONTS.medium, fontSize: 12, color: colors.text },
    relatedQualityPill: { marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: RADIUS.full, backgroundColor: colors.successPale, paddingHorizontal: 7, paddingVertical: 3 },
    relatedQualityText: { fontFamily: FONTS.semibold, fontSize: 10, color: colors.success },

    // Bottom CTA
    bottomCta: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
    bottomCtaRow: { flexDirection: 'row', gap: SPACING.sm },
    ctaSecondaryBtn: { flex: 0.9, backgroundColor: colors.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.borderLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: 14 },
    ctaSecondaryTxt: { fontFamily: FONTS.semibold, fontSize: 14, color: colors.primary },
    ctaBtn: { flex: 1.25, backgroundColor: colors.primary, borderRadius: RADIUS.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: 14 },
    ctaBtnTxt: { fontFamily: FONTS.semibold, fontSize: 15, color: '#fff' },
  });
}
