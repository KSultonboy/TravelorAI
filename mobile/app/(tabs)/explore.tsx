import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  ImageBackground,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Search } from '@metamorph/react-native-yamap';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import ExploreMap from '../../src/components/explore/ExploreMap';
import type { ExploreCoordinate, ExploreMapMarker, ExploreMapViewport, ExploreRegion } from '../../src/components/explore/ExploreMap.types';
import { CATEGORY_META, type MapPoint, type POISubtype, type POIType, SUB_CATEGORIES } from '../../src/constants/mapData';
import { FONTS } from '../../src/constants/fonts';
import { RADIUS, SPACING } from '../../src/constants/spacing';
import { type AppColors, useAppTheme } from '../../src/theme/app-theme';
import { useWishlist } from '../../src/hooks/useWishlist';
import { extractApiData } from '../../src/utils/auth';
import { poiAPI, transportAPI, tripsAPI, yandexAPI, type PoiPayload, type YandexPlacePointPayload, type YandexTransportPointPayload } from '../../src/utils/api';
import { getItem, getJSON, getUserKey, KEYS, saveItem, saveJSON } from '../../src/utils/storage';
import type { TripPlan } from '../../src/utils/tripPlanner';

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryFilter = 'all' | POIType;
type SubtypeFilter = 'all' | POISubtype;
type LocationAccessState = 'checking' | 'granted' | 'denied' | 'error';
type ExploreLoadMode = 'radius' | 'viewport';

interface StoredUser {
  id?: string | null;
}

interface TripStop {
  id: string;
  dayNumber: number;
  time: string;
  title: string;
  city: string;
  point: MapPoint;
}

interface ExploreListItem {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  point: MapPoint;
  dayNumber?: number;
  time?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_REGION: ExploreRegion = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 120,
  longitudeDelta: 160,
};

const CITY_ALIAS_TO_CANONICAL: Record<string, string> = {
  xiva: 'khiva',
  khiva: 'khiva',
  hiva: 'khiva',
  urganch: 'urgench',
  urgench: 'urgench',
  toshkent: 'tashkent',
  tashkent: 'tashkent',
  buxoro: 'bukhara',
  bukhara: 'bukhara',
  samarqand: 'samarkand',
  samarkand: 'samarkand',
  fargona: 'fergana',
  fergana: 'fergana',
  andijon: 'andijan',
  andijan: 'andijan',
  qarshi: 'karshi',
  karshi: 'karshi',
  termiz: 'termez',
  termez: 'termez',
  navoiy: 'navoi',
  navoi: 'navoi',
  jizzax: 'jizzakh',
  jizzakh: 'jizzakh',
  xorazm: 'khorezm',
  khorezm: 'khorezm',
};

const RADIUS_OPTIONS = [5, 10, 20, 50, 100];
const MIN_VIEWPORT_ZOOM = 10.2;
const YANDEX_RUNTIME_DATA_ENABLED = process.env.EXPO_PUBLIC_YANDEX_MAPKIT_ENABLED !== 'false';
const YANDEX_STATIC_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_YANDEX_STATIC_MAPS_API_KEY ||
  process.env.EXPO_PUBLIC_YANDEX_MAPKIT_API_KEY ||
  '';
const NATIVE_YANDEX_QUERIES: Record<'landmark' | 'restaurant' | 'hotel' | 'transport', Record<string, string[]>> = {
  landmark: {
    all: ['достопримечательность', 'музей', 'историческое место', 'памятник', 'мечеть', 'attraction'],
    historical: ['историческое место', 'музей', 'памятник'],
    mosque: ['мечеть', 'masjid', 'mosque'],
    other: ['достопримечательность', 'туристическое место', 'attraction'],
  },
  restaurant: {
    all: ['ресторан', 'кафе', 'узбекская кухня', 'миллий таомлар', 'халяль ресторан'],
    traditional: ['узбекская кухня', 'миллий таомлар', 'национальная кухня'],
    cafe: ['кафе', 'кофейня', 'cafe'],
    budget: ['столовая', 'ошхона', 'фастфуд'],
    mid: ['ресторан', 'restaurant'],
    luxury: ['ресторан премиум', 'fine dining restaurant'],
  },
  hotel: {
    all: ['отель', 'гостиница', 'хостел', 'гостевой дом', 'hotel'],
    budget: ['хостел', 'гостевой дом'],
    mid: ['отель', 'гостиница', 'hotel'],
    luxury: ['люкс отель', 'премиум отель', 'luxury hotel'],
  },
  transport: {
    all: ['остановка', 'автобусная остановка', 'вокзал', 'аэропорт', 'такси'],
    bus: ['остановка', 'автобусная остановка'],
    train: ['вокзал', 'железнодорожная станция'],
    metro: ['метро'],
    airport: ['аэропорт', 'airport'],
    taxi: ['такси', 'taxi'],
  },
};
interface ExploreFetchRequest {
  key: string;
  origin: ExploreCoordinate;
  radiusKm: number;
  params: Record<string, unknown>;
}

// ─── Icon helpers (no emoji) ─────────────────────────────────────────────────

function getTypeColor(type: POIType, colors: AppColors): string {
  return CATEGORY_META[type]?.markerColor || colors.primary;
}

function getYandexPoiIconName(point: MapPoint): string {
  const sub = (point.subtype ?? '').toLowerCase();
  if (sub === 'mosque')     return 'moon-outline';
  if (sub === 'historical') return 'business-outline';
  if (sub === 'train')      return 'train-outline';
  if (sub === 'airport')    return 'airplane-outline';
  if (sub === 'bus')        return 'bus-outline';
  if (sub === 'metro')      return 'subway-outline';
  if (sub === 'taxi')       return 'car-outline';
  if (sub === 'cafe')       return 'cafe-outline';
  if (sub === 'luxury')     return 'star-outline';
  if (point.type === 'transport')  return 'bus-outline';
  if (point.type === 'restaurant') return 'restaurant-outline';
  if (point.type === 'hotel')      return 'bed-outline';
  return 'location-outline';
}

function getYandexCategoryIconName(type: POIType): string {
  if (type === 'transport')  return 'bus-outline';
  if (type === 'restaurant') return 'restaurant-outline';
  if (type === 'hotel')      return 'bed-outline';
  return 'location-outline';
}

function getYandexStaticMapPreviewUrl(lat: number, lng: number, width = 460, height = 260): string | null {
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

function getPointPreviewImageUrl(point: MapPoint, width = 460, height = 260): string | null {
  return (
    point.imageUrl ||
    (point as any).photoUrl ||
    getYandexStaticMapPreviewUrl(point.lat, point.lng, width, height)
  );
}

function getYandexSubtypeIconName(subtype: POISubtype): string {
  return getYandexPoiIconName({
    id: subtype,
    name: subtype,
    city: '',
    slug: subtype,
    type: 'landmark',
    subtype,
    lat: 0,
    lng: 0,
    info: '',
    icon: 'pin',
  });
}

// ─── Utility functions ───────────────────────────────────────────────────────

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9\u0400-\u04ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalCity(value: string): string {
  const normalized = normalizeText(value)
    .replace(/\b(shahri|city|region|viloyati|viloyat)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  return CITY_ALIAS_TO_CANONICAL[normalized] || normalized;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractActivityCoordinate(activity: any): ExploreCoordinate | null {
  if (!activity || typeof activity !== 'object') return null;

  const lat =
    toFiniteNumber(activity?.lat) ??
    toFiniteNumber(activity?.latitude) ??
    toFiniteNumber(activity?.location?.lat) ??
    toFiniteNumber(activity?.location?.latitude);

  const lng =
    toFiniteNumber(activity?.lng) ??
    toFiniteNumber(activity?.lon) ??
    toFiniteNumber(activity?.longitude) ??
    toFiniteNumber(activity?.location?.lng) ??
    toFiniteNumber(activity?.location?.lon) ??
    toFiniteNumber(activity?.location?.longitude);

  if (lat == null || lng == null) return null;
  if (!isValidCoordinate(lat, lng)) return null;

  return { latitude: lat, longitude: lng };
}

function cityEquals(a: string, b: string): boolean {
  const left = canonicalCity(a);
  const right = canonicalCity(b);
  if (!left || !right) return false;
  return left === right;
}

function sanitizePoints(points: MapPoint[]): MapPoint[] {
  return points.filter((p) => isValidCoordinate(Number(p.lat), Number(p.lng)));
}

function resolveCityCenter(
  city: string,
  points: MapPoint[]
): ExploreCoordinate | null {
  const cityKey = canonicalCity(city);
  const validPoints = sanitizePoints(points);
  if (cityKey) {
    const byCity = validPoints.filter((point) => canonicalCity(point.city) === cityKey);
    if (byCity.length > 0) {
      const avgLat = byCity.reduce((sum, point) => sum + Number(point.lat), 0) / byCity.length;
      const avgLng = byCity.reduce((sum, point) => sum + Number(point.lng), 0) / byCity.length;
      if (isValidCoordinate(avgLat, avgLng)) {
        return { latitude: avgLat, longitude: avgLng };
      }
    }

  }
  return null;
}

function haversineKm(origin: ExploreCoordinate, target: ExploreCoordinate): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(target.latitude  - origin.latitude);
  const dLng = toRad(target.longitude - origin.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.latitude)) * Math.cos(toRad(target.latitude)) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterPointsWithinRadius(points: MapPoint[], origin: ExploreCoordinate, radiusKm: number): MapPoint[] {
  return points.filter((point) =>
    isValidCoordinate(point.lat, point.lng) &&
    haversineKm(origin, { latitude: point.lat, longitude: point.lng }) <= radiusKm
  );
}

function buildRadiusRequest(origin: ExploreCoordinate, radiusKm: number): ExploreFetchRequest {
  const normalizedRadiusKm = Number(radiusKm.toFixed(1));
  return {
    key: `radius:${origin.latitude.toFixed(3)}:${origin.longitude.toFixed(3)}:${normalizedRadiusKm.toFixed(1)}`,
    origin,
    radiusKm: normalizedRadiusKm,
    params: {
      lat: origin.latitude,
      lng: origin.longitude,
      radiusKm: normalizedRadiusKm,
      limit: 500,
    },
  };
}

function getViewportRadiusCapKm(zoom: number): number | null {
  if (!Number.isFinite(zoom) || zoom < MIN_VIEWPORT_ZOOM) return null;
  if (zoom < 11) return 50;
  if (zoom < 12) return 35;
  if (zoom < 13) return 22;
  if (zoom < 14) return 12;
  return 6;
}

function getViewportLimit(zoom: number): number {
  if (zoom < 11) return 150;
  if (zoom < 12) return 130;
  if (zoom < 13) return 110;
  return 90;
}

function getViewportKeyPrecision(zoom: number): number {
  if (zoom < 12) return 2;
  if (zoom < 14) return 3;
  return 4;
}

function buildViewportRequest(viewport: ExploreMapViewport): ExploreFetchRequest | null {
  const { center, bounds, zoom } = viewport;
  const radiusCapKm = getViewportRadiusCapKm(zoom);
  if (radiusCapKm == null) return null;
  if (!isValidCoordinate(center.latitude, center.longitude)) return null;
  if (
    !isValidCoordinate(bounds.northEast.latitude, bounds.northEast.longitude) ||
    !isValidCoordinate(bounds.southWest.latitude, bounds.southWest.longitude)
  ) {
    return null;
  }

  const corners: ExploreCoordinate[] = [
    bounds.northEast,
    bounds.southWest,
    { latitude: bounds.northEast.latitude, longitude: bounds.southWest.longitude },
    { latitude: bounds.southWest.latitude, longitude: bounds.northEast.longitude },
  ];

  const computedRadiusKm = Math.max(
    ...corners.map((corner) => haversineKm(center, corner)),
    2
  );
  const normalizedRadiusKm = Number(Math.min(computedRadiusKm * 1.08, radiusCapKm).toFixed(1));
  const zoomBucket = Math.floor(zoom * 2) / 2;
  const precision = getViewportKeyPrecision(zoom);

  return {
    key:
      `viewport:${center.latitude.toFixed(precision)}:${center.longitude.toFixed(precision)}` +
      `:${normalizedRadiusKm.toFixed(1)}:${zoomBucket.toFixed(1)}`,
    origin: center,
    radiusKm: normalizedRadiusKm,
    params: {
      lat: center.latitude,
      lng: center.longitude,
      radiusKm: normalizedRadiusKm,
      limit: getViewportLimit(zoom),
    },
  };
}

function filterPointsWithinBounds(
  points: MapPoint[],
  bounds: ExploreMapViewport['bounds']
): MapPoint[] {
  const north = Math.max(bounds.northEast.latitude, bounds.southWest.latitude);
  const south = Math.min(bounds.northEast.latitude, bounds.southWest.latitude);
  const east = bounds.northEast.longitude;
  const west = bounds.southWest.longitude;
  const crossesDateLine = west > east;

  return points.filter((point) => {
    if (!isValidCoordinate(point.lat, point.lng)) return false;

    const withinLatitude = point.lat >= south && point.lat <= north;
    const withinLongitude = crossesDateLine
      ? point.lng >= west || point.lng <= east
      : point.lng >= west && point.lng <= east;

    return withinLatitude && withinLongitude;
  });
}

function getViewportSearchOrigins(viewport: ExploreMapViewport | null, fallback: ExploreCoordinate): ExploreCoordinate[] {
  const origins: ExploreCoordinate[] = [fallback];
  if (!viewport) return origins;

  const north = Math.max(viewport.bounds.northEast.latitude, viewport.bounds.southWest.latitude);
  const south = Math.min(viewport.bounds.northEast.latitude, viewport.bounds.southWest.latitude);
  const east = viewport.bounds.northEast.longitude;
  const west = viewport.bounds.southWest.longitude;
  const crossesDateLine = west > east;

  if (crossesDateLine) return origins;

  const latMid = (north + south) / 2;
  const lngMid = (east + west) / 2;
  const latQuarter = (north - south) / 4;
  const lngQuarter = (east - west) / 4;

  [
    { latitude: latMid + latQuarter, longitude: lngMid - lngQuarter },
    { latitude: latMid + latQuarter, longitude: lngMid + lngQuarter },
    { latitude: latMid - latQuarter, longitude: lngMid - lngQuarter },
    { latitude: latMid - latQuarter, longitude: lngMid + lngQuarter },
  ].forEach((origin) => {
    if (isValidCoordinate(origin.latitude, origin.longitude)) origins.push(origin);
  });

  return origins;
}

function buildRegion(points: MapPoint[], userLocation: ExploreCoordinate | null): ExploreRegion {
  const coords = [
    ...points.map((p) => ({ latitude: Number(p.lat), longitude: Number(p.lng) })),
    ...(userLocation ? [userLocation] : []),
  ].filter((c) => isValidCoordinate(c.latitude, c.longitude));

  if (coords.length === 0) return DEFAULT_REGION;

  if (coords.length === 1) {
    return { latitude: coords[0].latitude, longitude: coords[0].longitude, latitudeDelta: 0.18, longitudeDelta: 0.18 };
  }

  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  return {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLng + maxLng) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.6, 0.18),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.18),
  };
}

function timeStringToMinutes(value: string): number {
  const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, hours) * 60 + Math.max(0, minutes);
}

function normalizeTrip(raw: any): TripPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw.planData && typeof raw.planData === 'object' ? { ...raw.planData, ...raw } : raw;
  const progressSource = src?.progress || src?.planData?.progress || {};
  const updatedAt = String(src.updatedAt || src?.planData?.updatedAt || src.createdAt || new Date().toISOString());
  return {
    id:           String(src.id || ''),
    title:        String(src.title || 'Trip'),
    totalCost:    Number(src.totalCost || 0),
    duration:     Number(src.duration || 0),
    travelers:    Number(src.travelers || 1),
    style:        String(src.style || 'mid'),
    destinations: Array.isArray(src.destinations) ? src.destinations.map(String) : [],
    breakdown: {
      transport:     Number(src.breakdown?.transport || 0),
      accommodation: Number(src.breakdown?.accommodation || 0),
      food:          Number(src.breakdown?.food || 0),
      attractions:   Number(src.breakdown?.attractions || 0),
      misc:          Number(src.breakdown?.misc || 0),
    },
    days:       Array.isArray(src.days) ? src.days : [],
    warnings:   Array.isArray(src.warnings)   ? src.warnings.map(String)   : [],
    highlights: Array.isArray(src.highlights) ? src.highlights.map(String) : [],
    tips:       Array.isArray(src.tips)       ? src.tips.map(String)       : [],
    status:     src.status || src?.planData?.status,
    source:     src.source || src?.planData?.source,
    syncStatus: src.syncStatus || src?.planData?.syncStatus,
    updatedAt,
    progress: {
      visitedStopIds: Array.isArray(progressSource?.visitedStopIds) ? progressSource.visitedStopIds.map(String) : [],
      notes:
        progressSource?.notes && typeof progressSource.notes === 'object' && !Array.isArray(progressSource.notes)
          ? progressSource.notes
          : {},
      updatedAt: String(progressSource?.updatedAt || updatedAt),
    },
    createdAt:  String(src.createdAt || new Date().toISOString()),
  };
}

function mapActivityTypeToPoiType(type: string): POIType | null {
  const n = normalizeText(type);
  if (n.includes('transport')) return 'transport';
  if (n.includes('food') || n.includes('restaurant')) return 'restaurant';
  if (n.includes('hotel') || n.includes('accommodation')) return 'hotel';
  if (n.includes('landmark') || n.includes('attraction') || n.includes('history')) return 'landmark';
  return null;
}

function scorePoiByName(point: MapPoint, activityName: string, city: string, desiredType: POIType | null): number {
  const nActivity = normalizeText(activityName);
  const nPoint    = normalizeText(point.name);
  let score = 0;
  if (city && cityEquals(point.city, city)) score += 80;
  if (desiredType && point.type === desiredType) score += 26;
  if (!nActivity) return score;
  if (nPoint === nActivity) score += 140;
  if (nPoint.includes(nActivity) || nActivity.includes(nPoint)) score += 92;
  for (const term of nActivity.split(' ').filter(Boolean)) {
    if (nPoint.includes(term)) score += 18;
  }
  if (normalizeText(point.info).includes(nActivity)) score += 24;
  return score;
}

function pickPoiForStep(points: MapPoint[], city: string, activityName: string, activityType: string): MapPoint | null {
  const desiredType = mapActivityTypeToPoiType(activityType);
  const sanitizedPoints = points.filter((p) => isValidCoordinate(p.lat, p.lng));
  const cityCandidates = sanitizedPoints.filter((p) => !city || cityEquals(p.city, city));
  const candidates = cityCandidates.length > 0 ? cityCandidates : sanitizedPoints;
  if (candidates.length === 0) return null;

  const scored = candidates
    .map((p) => ({ point: p, score: scorePoiByName(p, activityName, city, desiredType) }))
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) return scored[0].point;
  if (desiredType) return candidates.find((p) => p.type === desiredType) || null;
  return candidates[0] || null;
}

function buildTripStops(trip: TripPlan | null, points: MapPoint[]): TripStop[] {
  if (!trip) return [];
  const stops: TripStop[] = [];
  const seen = new Set<string>();
  const allKnownPoints = sanitizePoints(points || []);

  (trip.days || []).forEach((day: any, dayIndex: number) => {
    const dayNumber = Number(day?.day ?? day?.dayNumber ?? dayIndex + 1);
    const dayCity = String(day?.destination || day?.city || trip.destinations?.[0] || '').trim();
    const activities = Array.isArray(day?.activities) ? day.activities : [];

    activities.forEach((activity: any, actIndex: number) => {
      const activityName = String(activity?.name || '').trim();
      const coordinate = extractActivityCoordinate(activity);
      const resolvedType = mapActivityTypeToPoiType(String(activity?.type || '')) || 'landmark';

      const point =
        (coordinate
          ? {
              id: `trip-stop-${dayNumber}-${actIndex}-${coordinate.latitude.toFixed(5)}-${coordinate.longitude.toFixed(5)}`,
              name: activityName || `${dayCity || 'Route'} stop`,
              city: dayCity || String(trip.destinations?.[0] || ''),
              slug: `trip-stop-${dayNumber}-${actIndex}`,
              type: resolvedType,
              subtype: undefined,
              lat: coordinate.latitude,
              lng: coordinate.longitude,
              info: '',
              icon: 'pin',
            }
          : pickPoiForStep(allKnownPoints, dayCity, activityName, String(activity?.type || '')));

      const fallbackCenter = !point ? resolveCityCenter(dayCity, allKnownPoints) : null;
      const resolvedPoint = point || (
        fallbackCenter
          ? {
              id: `trip-fallback-${canonicalCity(dayCity) || 'city'}-${dayNumber}-${actIndex}`,
              name: activityName || `${dayCity || 'Trip'} stop`,
              city: dayCity || String(trip.destinations?.[0] || ''),
              slug: `trip-fallback-${dayNumber}-${actIndex}`,
              type: resolvedType,
              subtype: undefined,
              lat: fallbackCenter.latitude,
              lng: fallbackCenter.longitude,
              info: '',
              icon: 'pin',
            }
          : null
      );

      if (!resolvedPoint) return;
      const stopId = `${dayNumber}-${actIndex}-${resolvedPoint.id}`;
      if (seen.has(stopId)) return;
      seen.add(stopId);
      stops.push({
        id: stopId,
        dayNumber,
        time: String(activity?.time || ''),
        title: activityName || resolvedPoint.name,
        city: resolvedPoint.city || dayCity,
        point: resolvedPoint,
      });
    });
  });

  if (stops.length === 0) {
    const routeCities = Array.from(
      new Set(
        [
          ...(Array.isArray(trip.destinations) ? trip.destinations : []),
          ...((trip.days || []).map((day: any) => String(day?.destination || day?.city || ''))),
        ]
          .map((city) => String(city || '').trim())
          .filter(Boolean)
      )
    );

    routeCities.forEach((city, index) => {
      const center = resolveCityCenter(city, allKnownPoints);
      if (!center) return;
      const fallbackPoint: MapPoint = {
        id: `trip-city-center-${canonicalCity(city) || index}`,
        name: city,
        city,
        slug: `trip-city-center-${canonicalCity(city) || index}`,
        type: 'landmark',
        subtype: undefined,
        lat: center.latitude,
        lng: center.longitude,
        info: '',
        icon: 'pin',
      };
      const dayNumber = index + 1;
      const stopId = `${dayNumber}-0-${fallbackPoint.id}`;
      if (seen.has(stopId)) return;
      seen.add(stopId);
      stops.push({
        id: stopId,
        dayNumber,
        time: '',
        title: city,
        city,
        point: fallbackPoint,
      });
    });
  }

  return [...stops].sort((left, right) => {
    if (left.dayNumber !== right.dayNumber) return left.dayNumber - right.dayNumber;
    const leftTime = timeStringToMinutes(left.time);
    const rightTime = timeStringToMinutes(right.time);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.title.localeCompare(right.title);
  });
}

function mapPoiToPoint(poi: PoiPayload): MapPoint {
  return {
    id: String(poi.id),
    name: String(poi.name || ''),
    city: String(poi.city || ''),
    slug: String(poi.slug || poi.id || ''),
    type: poi.type as POIType,
    subtype: (poi.subtype || undefined) as POISubtype | undefined,
    lat: Number(poi.lat),
    lng: Number(poi.lng),
    info: String(poi.info || ''),
    description: poi.description ?? null,
    imageUrl: poi.imageUrl ?? null,
    price: poi.price ?? undefined,
    priceLevel: poi.priceLevel ?? null,
    rating: poi.rating ?? null,
    ratingCount: poi.ratingCount ?? null,
    phone: poi.phone ?? null,
    website: poi.website ?? null,
    openingHours: poi.openingHours ?? null,
    gallery: poi.gallery ?? [],
    icon: String(poi.icon || 'pin'),
    source: poi.source ?? null,
    sourceUrl: poi.sourceUrl ?? null,
    lastVerifiedAt: poi.lastVerifiedAt ?? null,
    confidenceScore: poi.confidenceScore ?? null,
  };
}

function mapYandexRuntimePoint(item: YandexPlacePointPayload): MapPoint {
  const id = String(item.id || `yandex-${item.type || 'poi'}-${item.lat}-${item.lng}`);
  return {
    ...mapPoiToPoint(item),
    id,
    slug: String(item.slug || id),
    type: (item.type || 'landmark') as POIType,
    subtype: (item.subtype || undefined) as POISubtype | undefined,
    source: item.source || 'yandex_search',
    sourceUrl: item.sourceUrl ?? null,
    lastVerifiedAt: item.lastVerifiedAt ?? null,
    confidenceScore: item.confidenceScore ?? 0.74,
    distanceKm: item.distanceKm ?? null,
  };
}

function mapYandexTransportToPoint(item: YandexTransportPointPayload): MapPoint {
  return {
    ...mapYandexRuntimePoint(item),
    id: String(item.id || `yandex-transport-${item.lat}-${item.lng}`),
    type: 'transport',
    source: item.source || 'yandex_search',
    confidenceScore: item.confidenceScore ?? 0.76,
  };
}

function mergePoints(primary: MapPoint[], secondary: MapPoint[]): MapPoint[] {
  const seen = new Set<string>();
  const merged: MapPoint[] = [];

  [...primary, ...secondary].forEach((point) => {
    if (!isValidCoordinate(point.lat, point.lng)) return;
    const key = `${normalizeText(point.name)}:${point.type}:${point.subtype || ''}:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(point);
  });

  return merged;
}

function nativeQueriesFor(type: 'landmark' | 'restaurant' | 'hotel' | 'transport', subtype?: string): string[] {
  const querySet = NATIVE_YANDEX_QUERIES[type] || NATIVE_YANDEX_QUERIES.landmark;
  return querySet[subtype || 'all'] || querySet.all;
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mapNativeYandexSearchPoint(
  item: any,
  query: string,
  type: 'landmark' | 'restaurant' | 'hotel' | 'transport'
): MapPoint | null {
  const lat = Number(item?.lat ?? item?.point?.lat);
  const lng = Number(item?.lon ?? item?.point?.lon);
  const firstComponent = Array.isArray(item?.Components) ? item.Components[0] : null;
  const name = String(item?.title || item?.name || firstComponent?.name || item?.formatted || '').trim();
  if (!name || !isValidCoordinate(lat, lng)) return null;

  const id = `yandex-native:${type}:${slugify(`${name}-${lat.toFixed(5)}-${lng.toFixed(5)}`)}`;
  const subtitle = String(item?.subtitle || item?.formatted || '').trim();

  return {
    id,
    name,
    city: subtitle || 'Yandex MapKit',
    slug: id,
    type,
    subtype: undefined,
    lat,
    lng,
    info: subtitle || `Yandex MapKit result for ${query}`,
    description: subtitle || null,
    imageUrl: null,
    rating: null,
    ratingCount: null,
    phone: null,
    website: null,
    openingHours: null,
    gallery: [],
    icon: type === 'restaurant' ? 'restaurant' : type === 'hotel' ? 'bed' : type === 'transport' ? 'bus' : 'pin',
    source: 'yandex_mapkit_native',
    sourceUrl: item?.uri || null,
    lastVerifiedAt: new Date().toISOString(),
    confidenceScore: 0.68,
  };
}

async function fetchNativeYandexSearchPoints({
  origin,
  origins,
  type,
  subtype,
  limit,
}: {
  origin: ExploreCoordinate;
  origins?: ExploreCoordinate[];
  type: 'landmark' | 'restaurant' | 'hotel' | 'transport';
  subtype?: string;
  limit: number;
}): Promise<MapPoint[]> {
  if (Platform.OS === 'web' || !Search?.searchText) return [];

  const queries = nativeQueriesFor(type, subtype).slice(0, 6);
  const searchOrigins = (origins && origins.length > 0 ? origins : [origin]).slice(0, 5);
  const options = {
    disableSpellingCorrection: false,
    geometry: true,
    searchTypes: type === 'landmark' ? 3 : 2,
  } as any;

  const responses = await Promise.all(
    searchOrigins.flatMap((searchOrigin) => queries.map(async (query) => {
      try {
        const figure = {
          type: 'POINT',
          value: { lat: searchOrigin.latitude, lon: searchOrigin.longitude },
        } as any;
        const items = await Search.searchText(query, figure, options);
        const list = Array.isArray(items) ? items : items ? [items] : [];
        return list
              .map((item) => mapNativeYandexSearchPoint(item, query, type))
              .filter(Boolean) as MapPoint[];
      } catch {
        return [];
      }
    }))
  );

  return mergePoints(responses.flat(), []).slice(0, limit);
}

async function fetchNativeYandexTextSearchPoints({
  query,
  origin,
  type,
  limit,
}: {
  query: string;
  origin: ExploreCoordinate;
  type?: 'landmark' | 'restaurant' | 'hotel' | 'transport';
  limit: number;
}): Promise<MapPoint[]> {
  if (Platform.OS === 'web' || !Search?.searchText || query.trim().length < 2) return [];

  const fallbackType = type || 'landmark';
  const figure = {
    type: 'POINT',
    value: { lat: origin.latitude, lon: origin.longitude },
  } as any;
  const options = {
    disableSpellingCorrection: false,
    geometry: true,
    searchTypes: type && type !== 'landmark' ? 2 : 3,
  } as any;

  try {
    const items = await Search.searchText(query, figure, options);
    const list = Array.isArray(items) ? items : items ? [items] : [];
    const mapped = list
      .map((item) => mapNativeYandexSearchPoint(item, query, fallbackType))
      .filter(Boolean) as MapPoint[];
    return mergePoints(mapped, []).slice(0, limit);
  } catch {
    return [];
  }
}

function formatSourceLabel(source?: string | null): string | null {
  const normalized = normalizeText(source || '');
  if (!normalized) return null;
  if (normalized.includes('yandex')) return 'Yandex';
  if (normalized.includes('travelorai')) return 'TravelorAI verified';
  return source || null;
}

function isLegacyProviderSource(source?: string | null): boolean {
  const normalized = normalizeText(source || '');
  return normalized.includes('google_places') || normalized.includes('google places') || normalized.includes('mapbox') || normalized.includes('2gis');
}

function formatConfidence(score?: number | null): string | null {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const normalized = Number(score) <= 1 ? Number(score) * 100 : Number(score);
  return `${Math.round(Math.max(0, Math.min(normalized, 100)))}%`;
}

function formatLastUpdated(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CatPressable({
  active,
  onPress,
  style,
  activeStyle,
  children,
}: {
  active: boolean;
  onPress: () => void;
  style: object | object[];
  activeStyle: object;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 18, bounciness: 6 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
      <Animated.View style={[style, active && activeStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function FadeInRow({ index, version, children }: { index: number; version: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue:         1,
      duration:        240,
      delay:           Math.min(index * 35, 350),
      easing:          Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim, index, version]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function HeartBtn({
  wished, onPress, style, wishedStyle, size, defaultColor, activeColor,
}: {
  wished: boolean; onPress: () => void; style: object; wishedStyle: object;
  size: number; defaultColor: string; activeColor: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, speed: 45, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1,   useNativeDriver: true, speed: 16, bounciness: 10 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[style, wished && wishedStyle, { transform: [{ scale }] }]}>
        <Ionicons name={wished ? 'heart' : 'heart-outline'} size={size} color={wished ? activeColor : defaultColor} />
      </Animated.View>
    </Pressable>
  );
}

function PlacePreviewImage({
  point,
  styles,
  colors,
}: {
  point: MapPoint;
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  const [failed, setFailed] = useState(false);
  const imageUrl = failed ? null : getPointPreviewImageUrl(point);

  if (imageUrl) {
    return (
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.nearbyImage}
        imageStyle={styles.nearbyImageRadius}
        onError={() => setFailed(true)}
      >
        <View style={styles.nearbyImageOverlay}>
          <Text style={styles.nearbyImageSource}>
            {point.imageUrl ? 'Photo' : 'Map'}
          </Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <View style={styles.nearbyImageFallback}>
      <Ionicons name={getYandexPoiIconName(point) as any} size={28} color={getTypeColor(point.type, colors)} />
    </View>
  );
}

export default function ExploreScreen() {
  const { colors, resolvedTheme } = useAppTheme();
  const { t }      = useTranslation();
  const insets     = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 22);
  const styles     = useMemo(() => createStyles(colors), [colors]);
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  const tt = useCallback(
    (key: string, fallback: string, values?: Record<string, unknown>) =>
      t(key as any, { defaultValue: fallback, ...(values || {}) }),
    [t]
  );

  // ── State ─────────────────────────────────────────────────────────────
  const [userId,      setUserId]      = useState<string | null>(null);
  const [points,      setPoints]      = useState<MapPoint[]>([]);
  const [yandexRuntimePoints, setYandexRuntimePoints] = useState<MapPoint[]>([]);
  const [yandexRuntimeRefreshing, setYandexRuntimeRefreshing] = useState(false);
  const [yandexSearchPoints, setYandexSearchPoints] = useState<MapPoint[]>([]);
  const [yandexSearchRefreshing, setYandexSearchRefreshing] = useState(false);
  const [yandexTransportPoints, setYandexTransportPoints] = useState<MapPoint[]>([]);
  const [yandexTransportRefreshing, setYandexTransportRefreshing] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [query,       setQuery]       = useState('');
  const [category,    setCategory]    = useState<CategoryFilter>('all');
  const [subtype,     setSubtype]     = useState<SubtypeFilter>('all');
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [focusedMapId, setFocusedMapId] = useState<string | null>(null);
  const [previewPointId, setPreviewPointId] = useState<string | null>(null);
  const [detailPointId, setDetailPointId] = useState<string | null>(null);
  const [routePreviewPointId, setRoutePreviewPointId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<ExploreCoordinate | null>(null);
  const [locationAccess, setLocationAccess] = useState<LocationAccessState>('checking');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating,    setLocating]    = useState(false);
  const [loadMode,    setLoadMode]    = useState<ExploreLoadMode>('viewport');
  const [radiusKm,    setRadiusKm]    = useState(100);
  const [scopePanelOpen, setScopePanelOpen] = useState(false);
  const [mapViewport, setMapViewport] = useState<ExploreMapViewport | null>(null);
  const [recenterToInitialRegionSignal, setRecenterToInitialRegionSignal] = useState(0);
  const [recenterToUserLocationSignal, setRecenterToUserLocationSignal] = useState(0);
  const [refreshingPlaces, setRefreshingPlaces] = useState(false);
  const [trip,        setTrip]        = useState<TripPlan | null>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [activeDay,   setActiveDay]   = useState<number | null>(null);
  const [savingStopId, setSavingStopId] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);

  const subchipsAnim = useRef(new Animated.Value(0)).current;
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const lastPlacesRequestKeyRef = useRef<string | null>(null);
  const lastYandexRuntimeRequestKeyRef = useRef<string | null>(null);
  const lastYandexSearchRequestKeyRef = useRef<string | null>(null);
  const lastYandexTransportRequestKeyRef = useRef<string | null>(null);
  const placesRequestIdRef = useRef(0);
  const yandexRuntimeRequestIdRef = useRef(0);
  const yandexSearchRequestIdRef = useRef(0);
  const yandexTransportRequestIdRef = useRef(0);
  const tripStorageKey = useMemo(() => (userId ? getUserKey(userId, KEYS.TRIPS) : KEYS.TRIPS), [userId]);

  // ── Init: user + saved radius ─────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      const [user, savedRadius] = await Promise.all([getJSON<StoredUser>(KEYS.USER), getItem(KEYS.EXPLORE_RADIUS)]);
      if (!alive) return;
      setUserId(user?.id ?? null);
      const r = Number(savedRadius);
      if (RADIUS_OPTIONS.includes(r)) {
        setRadiusKm(r);
      } else if (r > 100) {
        setRadiusKm(100);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    saveItem(KEYS.EXPLORE_RADIUS, String(radiusKm)).catch(() => {});
  }, [radiusKm]);

  useFocusEffect(
    useCallback(() => {
      if (!tripId) {
        setRecenterToInitialRegionSignal((value) => value + 1);
      }
    }, [tripId])
  );

  // ── Load POI ──────────────────────────────────────────────────────────
  const loadPoints = useCallback(async (opts?: { silent?: boolean; force?: boolean; viewport?: ExploreMapViewport | null }) => {
    const silent = Boolean(opts?.silent);
    const nextViewport = opts?.viewport ?? mapViewport;
    const currentRequest =
      tripId
        ? null
        : loadMode === 'radius'
          ? (userLocation ? buildRadiusRequest(userLocation, radiusKm) : null)
          : (nextViewport ? buildViewportRequest(nextViewport) : null);

    if (!tripId && loadMode === 'viewport' && !currentRequest) {
      lastPlacesRequestKeyRef.current = null;
      setError(null);
      setRefreshingPlaces(false);
      setLoading(false);
      return;
    }

    const requestKey = tripId ? 'trip:all' : `${currentRequest?.key}:${category}:${subtype}`;
    if (!requestKey) {
      setRefreshingPlaces(false);
      setLoading(false);
      return;
    }

    if (!opts?.force && lastPlacesRequestKeyRef.current === requestKey) {
      setRefreshingPlaces(false);
      setLoading(false);
      return;
    }

    lastPlacesRequestKeyRef.current = requestKey;
    if (!silent) setLoading(true);
    else setRefreshingPlaces(true);
    setError(null);

    const cached = await getJSON<MapPoint[]>(KEYS.POI_CACHE_V2);
    const cachedFromStorage = sanitizePoints(Array.isArray(cached) ? cached : []);
    const cachedPoints = cachedFromStorage;
    const fallbackPoints = tripId
      ? cachedPoints
      : currentRequest
        ? loadMode === 'viewport' && nextViewport
          ? filterPointsWithinBounds(cachedPoints, nextViewport.bounds)
          : filterPointsWithinRadius(cachedPoints, currentRequest.origin, currentRequest.radiusKm)
        : [];
    const requestId = ++placesRequestIdRef.current;

    try {
      const response = extractApiData<any>(
        await poiAPI.getAll(tripId ? { limit: 500 } : currentRequest?.params)
      );
      const items = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : [];
      const normalized = sanitizePoints(
        items
          .filter((item: PoiPayload) => !isLegacyProviderSource(item.source))
          .map((item: PoiPayload) => mapPoiToPoint(item))
      );
      const scopedNormalized = !tripId && loadMode === 'viewport' && nextViewport
        ? filterPointsWithinBounds(normalized, nextViewport.bounds)
        : normalized;
      if (requestId !== placesRequestIdRef.current) return;

      if (scopedNormalized.length > 0) {
        if (tripId) {
          await saveJSON(KEYS.POI_CACHE_V2, normalized);
        }
        setPoints(scopedNormalized);
        setError(null);
      } else if (fallbackPoints.length > 0) {
        setPoints(fallbackPoints);
        setError(null);
      } else {
        setPoints([]);
        setError(null);
      }
    } catch {
      if (requestId !== placesRequestIdRef.current) return;
      if (fallbackPoints.length > 0) {
        setPoints(fallbackPoints);
        setError(null);
      } else if (cachedPoints.length > 0) {
        setPoints(cachedPoints);
        setError(null);
      } else {
        setPoints([]);
        setError(null);
      }
    } finally {
      if (requestId === placesRequestIdRef.current) {
        if (!silent) setLoading(false);
        setRefreshingPlaces(false);
      }
    }
  }, [category, loadMode, mapViewport, radiusKm, subtype, tripId, userLocation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPoints({ silent: points.length > 0 });
    }, loadMode === 'viewport' ? 240 : 140);

    return () => clearTimeout(timer);
  }, [loadMode, loadPoints, mapViewport, points.length, radiusKm, tripId, userLocation]);

  const ensureUserLocation = useCallback(async (): Promise<boolean> => {
    try {
      setLocating(true);
      setLocationError(null);

      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') {
        setLocationAccess('denied');
        return false;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      setLocationAccess('granted');
      return true;
    } catch {
      setLocationAccess('error');
      setLocationError(tt('explore.locationErrorMsg', 'Could not get your location.'));
      return false;
    } finally {
      setLocating(false);
    }
  }, [tt]);

  useEffect(() => {
    if (locationAccess !== 'granted') {
      locationWatcherRef.current?.remove();
      locationWatcherRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 25,
          },
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        );

        if (cancelled) {
          subscription.remove();
          return;
        }

        locationWatcherRef.current?.remove();
        locationWatcherRef.current = subscription;
      } catch {
        setLocationError(tt('explore.locationErrorMsg', 'Could not get your location.'));
      }
    })();

    return () => {
      cancelled = true;
      locationWatcherRef.current?.remove();
      locationWatcherRef.current = null;
    };
  }, [locationAccess, tt]);

  // ── Load trip ─────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    if (!tripId) { setTrip(null); setTripLoading(false); return () => { alive = false; }; }

    (async () => {
      setTripLoading(true);
      const scopedKey = userId ? getUserKey(userId, KEYS.TRIPS) : KEYS.TRIPS;
      const cachedTrips = await getJSON<any[]>(scopedKey);
      const cachedTrip  = Array.isArray(cachedTrips)
        ? normalizeTrip(cachedTrips.find((i) => String(i?.id) === String(tripId)))
        : null;

      if (alive && cachedTrip) setTrip(cachedTrip);

      try {
        const token = await getItem(KEYS.TOKEN);
        if (!token) { if (alive) setTrip(cachedTrip); return; }

        const response = await tripsAPI.getAll();
        const payload  = extractApiData<any>(response);
        const items: any[] = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
        const nextTrip = normalizeTrip(items.find((i) => String(i?.id) === String(tripId)));

        if (alive) setTrip(nextTrip || cachedTrip);
      } catch {
        if (alive) setTrip(cachedTrip);
      } finally {
        if (alive) setTripLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [tripId, userId]);

  const { toggle: toggleWishlist, isWishlisted } = useWishlist(userId);

  // ── Sub-categories for selected category ─────────────────────────────
  const visibleSubcategories = useMemo(() => {
    if (category === 'all') return [];
    return SUB_CATEGORIES[category] || [];
  }, [category]);

  useEffect(() => {
    if (category === 'all') { setSubtype('all'); return; }
    if (!visibleSubcategories.some((s) => s.key === subtype)) setSubtype('all');
  }, [category, subtype, visibleSubcategories]);

  useEffect(() => {
    Animated.timing(subchipsAnim, {
      toValue:         visibleSubcategories.length > 0 ? 1 : 0,
      duration:        200,
      easing:          Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [subchipsAnim, visibleSubcategories.length]);

  useEffect(() => {
    if (previewPointId) {
      setScopePanelOpen(false);
    }
  }, [previewPointId]);

  // ── Filter handlers ───────────────────────────────────────────────────
  const resetExploreSelection = useCallback(() => {
    setFocusedMapId(null);
    setPreviewPointId(null);
    setDetailPointId(null);
    setRoutePreviewPointId(null);
    setSelectedId(null);
  }, []);

  const handleSetCategory = useCallback((key: CategoryFilter) => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.8 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
    setListVersion((v) => v + 1);
    setCategory(key);
    resetExploreSelection();
  }, [resetExploreSelection]);

  const handleSetSubtype = useCallback((key: SubtypeFilter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setListVersion((v) => v + 1);
    setSubtype(key);
    resetExploreSelection();
  }, [resetExploreSelection]);

  const radiusIndex = Math.max(RADIUS_OPTIONS.indexOf(radiusKm), 0);
  const canDecreaseRadius = radiusIndex > 0;
  const canIncreaseRadius = radiusIndex < RADIUS_OPTIONS.length - 1;
  const viewportRequest = useMemo(
    () => (mapViewport ? buildViewportRequest(mapViewport) : null),
    [mapViewport]
  );

  const yandexRuntimeRequest = useMemo(() => {
    if (tripId || category === 'transport' || !YANDEX_RUNTIME_DATA_ENABLED) return null;
    if (loadMode === 'radius') {
      return userLocation ? buildRadiusRequest(userLocation, radiusKm) : null;
    }
    return viewportRequest;
  }, [category, loadMode, radiusKm, tripId, userLocation, viewportRequest]);

  useEffect(() => {
    if (!yandexRuntimeRequest) {
      lastYandexRuntimeRequestKeyRef.current = null;
      setYandexRuntimePoints([]);
      setYandexRuntimeRefreshing(false);
      return;
    }

    const requestTypes: ('landmark' | 'restaurant' | 'hotel')[] =
      category === 'all' ? ['landmark', 'restaurant', 'hotel'] : [category as 'landmark' | 'restaurant' | 'hotel'];
    const requestSubtype = subtype !== 'all' ? subtype : undefined;
    const requestKey = `yandex:${yandexRuntimeRequest.key}:${requestTypes.join(',')}:${requestSubtype || 'all'}`;
    if (lastYandexRuntimeRequestKeyRef.current === requestKey) return;

    let alive = true;
    const requestId = ++yandexRuntimeRequestIdRef.current;
    lastYandexRuntimeRequestKeyRef.current = requestKey;
    setYandexRuntimeRefreshing(true);

    (async () => {
      try {
        const requestLimit = Number(yandexRuntimeRequest.params.limit || getViewportLimit(mapViewport?.zoom || MIN_VIEWPORT_ZOOM));
        const responses = await Promise.all(
          requestTypes.map((type) =>
            yandexAPI.getPlacesNearby({
              lat: yandexRuntimeRequest.origin.latitude,
              lng: yandexRuntimeRequest.origin.longitude,
              radiusKm: yandexRuntimeRequest.radiusKm,
              type,
              subtype: requestSubtype,
              limit: requestLimit,
            })
          )
        );
        if (!alive || requestId !== yandexRuntimeRequestIdRef.current) return;
        const normalized = sanitizePoints(
          responses.flatMap((response) => {
            const payload = extractApiData<any>(response);
            const items = Array.isArray(payload?.items) ? payload.items : [];
            return items.map((item: YandexPlacePointPayload) => mapYandexRuntimePoint(item));
          })
        );
        let combined = normalized;
        if (combined.length < requestTypes.length * 8) {
          const nativeOrigins =
            loadMode === 'viewport' && mapViewport
              ? getViewportSearchOrigins(mapViewport, yandexRuntimeRequest.origin)
              : [yandexRuntimeRequest.origin];
          const nativeResponses = await Promise.all(
            requestTypes.map((type) =>
              fetchNativeYandexSearchPoints({
                origin: yandexRuntimeRequest.origin,
                origins: nativeOrigins,
                type,
                subtype: requestSubtype,
                limit: requestLimit,
              })
            )
          );
          if (!alive || requestId !== yandexRuntimeRequestIdRef.current) return;
          combined = mergePoints(nativeResponses.flat(), normalized);
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.info('[Explore] Yandex native fallback', {
              category,
              subtype: requestSubtype || 'all',
              origins: nativeOrigins.length,
              backend: normalized.length,
              native: nativeResponses.flat().length,
              combined: combined.length,
            });
          }
        }
        const scoped = loadMode === 'viewport' && mapViewport
          ? filterPointsWithinBounds(combined, mapViewport.bounds)
          : filterPointsWithinRadius(combined, yandexRuntimeRequest.origin, yandexRuntimeRequest.radiusKm);
        setYandexRuntimePoints(scoped);
      } catch {
        if (alive && requestId === yandexRuntimeRequestIdRef.current) {
          setYandexRuntimePoints([]);
        }
      } finally {
        if (alive && requestId === yandexRuntimeRequestIdRef.current) {
          setYandexRuntimeRefreshing(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [category, loadMode, mapViewport, subtype, yandexRuntimeRequest]);

  useEffect(() => {
    const searchText = query.trim();
    const normalizedQuery = normalizeText(searchText);

    if (tripId || normalizedQuery.length < 2 || !YANDEX_RUNTIME_DATA_ENABLED) {
      lastYandexSearchRequestKeyRef.current = null;
      setYandexSearchPoints([]);
      setYandexSearchRefreshing(false);
      return;
    }

    const center =
      userLocation ||
      (mapViewport && mapViewport.zoom >= MIN_VIEWPORT_ZOOM ? mapViewport.center : null);
    const requestType = category === 'all' ? undefined : category;
    const requestRadiusKm = loadMode === 'radius' ? radiusKm : 25;
    const requestKey = [
      'yandex-search',
      normalizedQuery,
      requestType || 'all',
      center ? `${center.latitude.toFixed(4)}:${center.longitude.toFixed(4)}:${requestRadiusKm}` : 'global',
    ].join(':');

    let alive = true;
    const timer = setTimeout(() => {
      if (lastYandexSearchRequestKeyRef.current === requestKey) return;

      const requestId = ++yandexSearchRequestIdRef.current;
      lastYandexSearchRequestKeyRef.current = requestKey;
      setYandexSearchRefreshing(true);

      (async () => {
        try {
          const response = extractApiData<any>(
            await yandexAPI.searchPlaces({
              query: searchText,
              type: requestType,
              ...(center
                ? {
                    lat: center.latitude,
                    lng: center.longitude,
                    radiusKm: requestRadiusKm,
                  }
                : {}),
            })
          );
          if (!alive || requestId !== yandexSearchRequestIdRef.current) return;

          const items = Array.isArray(response?.items) ? response.items : [];
          let searchPoints = sanitizePoints(items.map((item: YandexPlacePointPayload) => mapYandexRuntimePoint(item)));
          if (center && searchPoints.length < 8) {
            const nativePoints = await fetchNativeYandexTextSearchPoints({
              query: searchText,
              origin: center,
              type: requestType as 'landmark' | 'restaurant' | 'hotel' | 'transport' | undefined,
              limit: 40,
            });
            if (!alive || requestId !== yandexSearchRequestIdRef.current) return;
            searchPoints = mergePoints(nativePoints, searchPoints);
          }
          setYandexSearchPoints(searchPoints);
          if (searchPoints[0]) {
            setFocusedMapId(searchPoints[0].id);
            setSelectedId(searchPoints[0].id);
          }
        } catch {
          if (alive && requestId === yandexSearchRequestIdRef.current) {
            setYandexSearchPoints([]);
          }
        } finally {
          if (alive && requestId === yandexSearchRequestIdRef.current) {
            setYandexSearchRefreshing(false);
          }
        }
      })();
    }, 320);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [category, loadMode, mapViewport, query, radiusKm, tripId, userLocation]);

  const yandexTransportRequest = useMemo(() => {
    if (tripId || category !== 'transport' || !YANDEX_RUNTIME_DATA_ENABLED) return null;
    if (loadMode === 'radius') {
      return userLocation ? buildRadiusRequest(userLocation, radiusKm) : null;
    }
    return viewportRequest;
  }, [category, loadMode, radiusKm, tripId, userLocation, viewportRequest]);

  useEffect(() => {
    if (!yandexTransportRequest) {
      lastYandexTransportRequestKeyRef.current = null;
      setYandexTransportPoints([]);
      setYandexTransportRefreshing(false);
      return;
    }

    const yandexType = subtype !== 'all' ? subtype : undefined;
    const requestKey = `yandex-transport:${yandexTransportRequest.key}:${yandexType || 'all'}`;
    if (lastYandexTransportRequestKeyRef.current === requestKey) return;

    let alive = true;
    const requestId = ++yandexTransportRequestIdRef.current;
    lastYandexTransportRequestKeyRef.current = requestKey;
    setYandexTransportRefreshing(true);

    (async () => {
      try {
        const response = extractApiData<any>(
          await transportAPI.getYandexNearby({
            lat: yandexTransportRequest.origin.latitude,
            lng: yandexTransportRequest.origin.longitude,
            radiusKm: yandexTransportRequest.radiusKm,
            type: yandexType,
            limit: Number(yandexTransportRequest.params.limit || getViewportLimit(mapViewport?.zoom || MIN_VIEWPORT_ZOOM)),
          })
        );
        if (!alive || requestId !== yandexTransportRequestIdRef.current) return;
        const items = Array.isArray(response?.items) ? response.items : [];
        const normalized = sanitizePoints(items.map((item: YandexTransportPointPayload) => mapYandexTransportToPoint(item)));
        const scoped = loadMode === 'viewport' && mapViewport
          ? filterPointsWithinBounds(normalized, mapViewport.bounds)
          : normalized;
        setYandexTransportPoints(scoped);
      } catch {
        if (alive && requestId === yandexTransportRequestIdRef.current) {
          setYandexTransportPoints([]);
        }
      } finally {
        if (alive && requestId === yandexTransportRequestIdRef.current) {
          setYandexTransportRefreshing(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadMode, mapViewport, subtype, yandexTransportRequest]);

  const scopedPoints = useMemo(() => {
    const withYandexRuntime = category === 'transport'
      ? points
      : mergePoints(yandexRuntimePoints, points);
    const basePoints = category === 'transport'
      ? mergePoints(yandexTransportPoints, withYandexRuntime)
      : withYandexRuntime;
    const withSearchResults = normalizeText(query).length >= 2
      ? mergePoints(yandexSearchPoints, basePoints)
      : basePoints;
    if (tripId || normalizeText(query).length >= 2 || loadMode !== 'viewport' || !mapViewport) return withSearchResults;
    if (mapViewport.zoom < MIN_VIEWPORT_ZOOM) return [];
    return filterPointsWithinBounds(withSearchResults, mapViewport.bounds);
  }, [category, loadMode, mapViewport, points, query, tripId, yandexRuntimePoints, yandexSearchPoints, yandexTransportPoints]);

  // ── Filtered + sorted points ──────────────────────────────────────────
  const pointMeta = useMemo(() => {
    const nQuery = normalizeText(query);

    return scopedPoints.map((point) => {
      const distanceKm = userLocation && isValidCoordinate(point.lat, point.lng)
        ? haversineKm(userLocation, { latitude: point.lat, longitude: point.lng })
        : null;

      let queryScore = 0;
      if (nQuery) {
        if (normalizeText(point.name) === nQuery)       queryScore += 120;
        if (normalizeText(point.name).includes(nQuery)) queryScore += 80;
        if (normalizeText(point.city).includes(nQuery)) queryScore += 40;
        if (normalizeText(point.info).includes(nQuery)) queryScore += 20;
      }

      return { point, distanceKm, queryScore };
    });
  }, [query, scopedPoints, userLocation]);

  const nearbyPointMeta = useMemo(() => {
    const nQuery = normalizeText(query);

    return pointMeta
      .filter(({ queryScore }) => (nQuery ? queryScore > 0 : true))
      .filter(({ distanceKm }) => {
        if (tripId || loadMode !== 'radius' || !userLocation) return true;
        return distanceKm == null ? false : distanceKm <= radiusKm;
      })
      .sort((a, b) => {
        if (nQuery && a.queryScore !== b.queryScore) return b.queryScore - a.queryScore;
        if (userLocation && a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
        return a.point.name.localeCompare(b.point.name);
      });
  }, [loadMode, pointMeta, query, radiusKm, tripId, userLocation]);

  const filteredPoints = useMemo(() => {
    return nearbyPointMeta
      .filter(({ point }) => (category === 'all' ? true : point.type === category))
      .filter(({ point }) => (subtype === 'all' ? true : point.subtype === subtype))
      .map(({ point }) => point);
  }, [category, nearbyPointMeta, subtype]);

  const pointDistanceMap = useMemo(() => {
    const next = new Map<string, number>();
    nearbyPointMeta.forEach(({ point, distanceKm }) => {
      if (distanceKm != null) next.set(point.id, distanceKm);
    });
    return next;
  }, [nearbyPointMeta]);

  const nearbyCardPoints = useMemo(() => {
    const withUsefulImage = filteredPoints.filter((point) => Boolean((point as any).imageUrl || (point as any).photoUrl));
    return (withUsefulImage.length > 0 ? withUsefulImage : filteredPoints).slice(0, 8);
  }, [filteredPoints]);

  // ── Trip logic ────────────────────────────────────────────────────────
  const tripStops = useMemo(() => buildTripStops(trip, points), [points, trip]);
  const tripVisitedStopIds = useMemo(
    () => new Set(Array.isArray(trip?.progress?.visitedStopIds) ? trip.progress.visitedStopIds.map(String) : []),
    [trip?.progress?.visitedStopIds]
  );
  const tripDays  = useMemo(() => Array.from(new Set(tripStops.map((s) => s.dayNumber))).sort((a, b) => a - b), [tripStops]);

  useEffect(() => {
    if (!tripId || tripDays.length === 0) { setActiveDay(null); return; }
    if (activeDay == null || !tripDays.includes(activeDay)) setActiveDay(tripDays[0]);
  }, [activeDay, tripDays, tripId]);

  const visibleTripStops = useMemo(() => {
    if (!tripId) return [];
    if (activeDay == null) return tripStops;
    return tripStops.filter((s) => s.dayNumber === activeDay);
  }, [activeDay, tripId, tripStops]);

  useEffect(() => {
    if (!tripId) return;
    const firstStopId = visibleTripStops[0]?.id ?? null;
    if (!firstStopId) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleTripStops.some((stop) => stop.id === selectedId)) {
      setSelectedId(firstStopId);
    }
  }, [selectedId, tripId, visibleTripStops]);

  const tripVisitedCount = useMemo(
    () => tripStops.filter((stop) => tripVisitedStopIds.has(stop.id)).length,
    [tripStops, tripVisitedStopIds]
  );
  const visibleVisitedCount = useMemo(
    () => visibleTripStops.filter((stop) => tripVisitedStopIds.has(stop.id)).length,
    [tripVisitedStopIds, visibleTripStops]
  );

  const completedRouteCoordinates = useMemo<ExploreCoordinate[] | undefined>(() => {
    if (!tripId || visibleTripStops.length < 2) return undefined;

    let contiguousVisitedUntil = -1;
    for (let index = 0; index < visibleTripStops.length; index += 1) {
      if (!tripVisitedStopIds.has(visibleTripStops[index].id)) break;
      contiguousVisitedUntil = index;
    }

    if (contiguousVisitedUntil < 1) return undefined;
    return visibleTripStops.slice(0, contiguousVisitedUntil + 1).map((stop) => ({
      latitude: stop.point.lat,
      longitude: stop.point.lng,
    }));
  }, [tripId, tripVisitedStopIds, visibleTripStops]);

  // ── List items ────────────────────────────────────────────────────────
  /* const listItems = useMemo<ExploreListItem[]>(() => {
    if (tripId) {
      return visibleTripStops.map((s) => ({
        id:        s.id,
        title:     s.title,
        subtitle:  `${tt('common.dayShort', 'Day')} ${s.dayNumber} • ${s.city}`,
        meta:      s.time || tt('explore.tripStopMeta', 'Trip stop'),
        point:     s.point,
        dayNumber: s.dayNumber,
        time:      s.time,
      }));
    }

    return filteredPoints.map((p) => ({
      id:       p.id,
      title:    p.name,
      subtitle: p.city,
      meta:     CATEGORY_META[p.type]?.label || p.type,
      point:    p,
    }));
  }, [filteredPoints, tripId, tt, visibleTripStops]);

  useEffect(() => {
    const firstId = listItems[0]?.id ?? null;
    if (!firstId) { setSelectedId(null); return; }
    if (!listItems.some((i) => i.id === selectedId)) setSelectedId(firstId);
  }, [listItems, selectedId]); */

  // ── Map data ──────────────────────────────────────────────────────────
  const mapPoints = useMemo(() => {
    if (tripId) return visibleTripStops.map((s) => s.point);
    return filteredPoints;
  }, [filteredPoints, tripId, visibleTripStops]);

  const routePreviewPoint = useMemo(() => {
    if (!routePreviewPointId || tripId) return null;
    return filteredPoints.find((point) => point.id === routePreviewPointId) || null;
  }, [filteredPoints, routePreviewPointId, tripId]);

  const routeCoordinates = useMemo<ExploreCoordinate[] | undefined>(() => {
    if (!tripId) {
      if (!userLocation || !routePreviewPoint) return undefined;
      return [
        userLocation,
        { latitude: routePreviewPoint.lat, longitude: routePreviewPoint.lng },
      ];
    }
    return visibleTripStops.map((s) => ({ latitude: s.point.lat, longitude: s.point.lng }));
  }, [routePreviewPoint, tripId, userLocation, visibleTripStops]);

  const mapMarkers = useMemo<ExploreMapMarker[]>(() => {
    if (tripId) {
      return visibleTripStops.map((s, index) => ({
        id:         s.id,
        title:      s.point.name,
        subtitle:   `${tt('common.dayShort', 'Day')} ${s.dayNumber}${s.time ? ` • ${s.time}` : ''}`,
        coordinate: { latitude: s.point.lat, longitude: s.point.lng },
        color:      tripVisitedStopIds.has(s.id) ? '#16A34A' : colors.primary,
        iconName:   tripVisitedStopIds.has(s.id) ? 'checkmark' : 'navigate',
        badgeLabel: String(index + 1),
        active:     s.id === selectedId,
        onPress:    () => { setSelectedId(s.id); setActiveDay(s.dayNumber); },
      }));
    }

    return filteredPoints.map((p) => ({
      id:         p.id,
      title:      p.name,
      subtitle:   p.city,
      coordinate: { latitude: p.lat, longitude: p.lng },
      color:      getTypeColor(p.type, colors),
      iconName:   getYandexPoiIconName(p),
      active:     p.id === selectedId,
      onPress:    () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedId(p.id);
        setPreviewPointId(p.id);
      },
    }));
  }, [colors, filteredPoints, selectedId, tripId, tripVisitedStopIds, tt, visibleTripStops]);

  useEffect(() => {
    if (selectedId && !mapMarkers.some((marker) => marker.id === selectedId)) {
      setSelectedId(null);
    }
  }, [mapMarkers, selectedId]);

  const selectedTripStop = useMemo(() => {
    if (!tripId || !selectedId) return null;
    return (
      visibleTripStops.find((stop) => stop.id === selectedId) ||
      tripStops.find((stop) => stop.id === selectedId) ||
      null
    );
  }, [selectedId, tripId, tripStops, visibleTripStops]);
  const selectedTripStopVisited = selectedTripStop ? tripVisitedStopIds.has(selectedTripStop.id) : false;

  const previewPoint = useMemo(() => {
    if (!previewPointId || tripId) return null;
    return filteredPoints.find((point) => point.id === previewPointId) || null;
  }, [filteredPoints, previewPointId, tripId]);

  const previewDistanceKm = useMemo(() => {
    if (!previewPoint) return null;
    return pointDistanceMap.get(previewPoint.id) ?? null;
  }, [pointDistanceMap, previewPoint]);
  const previewSourceLabel = useMemo(() => formatSourceLabel(previewPoint?.source), [previewPoint?.source]);
  const previewConfidence = useMemo(() => formatConfidence(previewPoint?.confidenceScore), [previewPoint?.confidenceScore]);
  const previewLastUpdated = useMemo(() => formatLastUpdated(previewPoint?.lastVerifiedAt), [previewPoint?.lastVerifiedAt]);
  const previewIsDetailed = Boolean(previewPoint && detailPointId === previewPoint.id);

  const initialRegion = useMemo(
    () => (tripId ? buildRegion(mapPoints, null) : DEFAULT_REGION),
    [mapPoints, tripId]
  );
  const mapEnabled    = useMemo(() => Platform.OS !== 'web', []);
  const mapDisabledReason = mapEnabled ? undefined : tt('explore.mapDisabledWeb', 'Map is available in the Android app.');
  const tripModeSubtitle = useMemo(() => {
    if (!tripId) return '';
    if (tripLoading) return tt('explore.tripLoadingSub', 'Loading...');
    const total = activeDay == null ? tripStops.length : visibleTripStops.length;
    const visited = activeDay == null ? tripVisitedCount : visibleVisitedCount;
    return tt('explore.tripProgressShort', '{{visited}}/{{total}} visited stops', {
      visited,
      total,
    });
  }, [activeDay, tripId, tripLoading, tripStops.length, tripVisitedCount, tt, visibleTripStops.length, visibleVisitedCount]);
  const scopeHintText = useMemo(() => {
    if (tripId) return '';
    if (normalizeText(query).length >= 2 && yandexSearchRefreshing) {
      return tt('explore.searchRefreshing', 'Yandex qidiruv natijalari yuklanmoqda...');
    }
    if (normalizeText(query).length >= 2) {
      return tt('explore.searchHint', 'Qidiruv natijalari Yandex va saqlangan joylardan yig‘ilmoqda.');
    }
    if (category === 'transport' && yandexTransportRefreshing) {
      return tt('explore.transportRefreshing', 'Yandex transport nuqtalari yuklanmoqda...');
    }
    if (category !== 'transport' && yandexRuntimeRefreshing) {
      return tt('explore.yandexPlacesRefreshing', 'Yandex joy malumotlari yuklanmoqda...');
    }
    if (loadMode === 'radius') {
      return refreshingPlaces
        ? tt('explore.radiusRefreshing', 'Updating nearby places...')
        : tt('explore.radiusHint', 'Only places within your chosen radius are shown.');
    }
    if (!mapViewport) {
      return tt('explore.viewportPreparing', 'Preparing the visible area...');
    }
    if (!viewportRequest) {
      return tt('explore.viewportZoomHint', 'Zoom in to load places in the visible area.');
    }
    return refreshingPlaces
      ? tt('explore.viewportRefreshing', 'Loading places in the visible area...')
      : tt('explore.viewportHint', 'Places load only for the currently visible zone.');
  }, [category, loadMode, mapViewport, query, refreshingPlaces, tripId, tt, viewportRequest, yandexRuntimeRefreshing, yandexSearchRefreshing, yandexTransportRefreshing]);

  const scopeButtonLabel = useMemo(() => {
    if (loadMode === 'radius') return `${radiusKm} km`;
    return tt('explore.scopeVisibleArea', 'Visible area');
  }, [loadMode, radiusKm, tt]);

  // ── Actions ───────────────────────────────────────────────────────────
  const handleUseMyLocation = useCallback(async () => {
    const granted = await ensureUserLocation();
    if (!granted) {
      Alert.alert(
        tt('explore.locationNeededTitle', 'Location access is required'),
        tt('explore.locationNeededMsg', 'Allow location access to show nearby places.')
      );
      return;
    }
    lastPlacesRequestKeyRef.current = null;
    setLoadMode('radius');
    setRecenterToUserLocationSignal((value) => value + 1);
  }, [ensureUserLocation, tt]);

  const handleAdjustRadius = useCallback((direction: 'decrease' | 'increase') => {
    const nextIndex = direction === 'decrease'
      ? Math.max(0, radiusIndex - 1)
      : Math.min(RADIUS_OPTIONS.length - 1, radiusIndex + 1);
    if (nextIndex === radiusIndex) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRadiusKm(RADIUS_OPTIONS[nextIndex]);
    resetExploreSelection();
  }, [radiusIndex, resetExploreSelection]);

  const handleSetLoadMode = useCallback((nextMode: ExploreLoadMode) => {
    if (nextMode === loadMode) return;
    if (nextMode === 'radius' && !userLocation) {
      void handleUseMyLocation();
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    lastPlacesRequestKeyRef.current = null;
    setLoadMode(nextMode);
    resetExploreSelection();
  }, [handleUseMyLocation, loadMode, resetExploreSelection, userLocation]);

  const handleToggleScopePanel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setScopePanelOpen((current) => !current);
  }, []);

  const handleViewportChanged = useCallback((nextViewport: ExploreMapViewport) => {
    setMapViewport(nextViewport);
  }, []);

  const handleOpenYandexDirections = useCallback(async (point: MapPoint) => {
    const routeMode = point.type === 'transport' ? 'mt' : 'auto';
    const text = encodeURIComponent(point.name || 'TravelorAI place');
    const yandexPointWeb = `https://yandex.com/maps/?ll=${point.lng},${point.lat}&z=16&pt=${point.lng},${point.lat}&text=${text}`;
    const yandexRouteWeb = userLocation
      ? `https://yandex.com/maps/?rtext=${userLocation.latitude},${userLocation.longitude}~${point.lat},${point.lng}&rtt=${routeMode}`
      : yandexPointWeb;
    const yandexPointApp = `yandexmaps://maps.yandex.com/?ll=${point.lng},${point.lat}&z=16&pt=${point.lng},${point.lat}&text=${text}`;
    const yandexRouteApp = userLocation
      ? `yandexmaps://maps.yandex.com/?rtext=${userLocation.latitude},${userLocation.longitude}~${point.lat},${point.lng}&rtt=${routeMode}`
      : yandexPointApp;
    const fallbackUrls =
      Platform.OS === 'android'
        ? [yandexRouteApp, yandexRouteWeb]
        : [yandexRouteWeb];

    try {
      for (const candidate of fallbackUrls) {
        if (candidate.startsWith('https://')) {
          await Linking.openURL(candidate);
          return;
        }

        if (await Linking.canOpenURL(candidate)) {
          await Linking.openURL(candidate);
          return;
        }
      }

      Alert.alert(tt('explore.directionErrorTitle', 'Cannot open maps'), yandexRouteWeb);
    } catch {
      Alert.alert(tt('explore.directionErrorTitle', 'Cannot open maps'), tt('explore.directionErrorMsg', 'Failed to open directions.'));
    }
  }, [tt, userLocation]);

  const handleOpenDirections = useCallback(async (point: MapPoint) => {
    if (tripId) {
      await handleOpenYandexDirections(point);
      return;
    }

    let origin = userLocation;

    if (!origin) {
      const granted = await ensureUserLocation();
      if (!granted) {
        Alert.alert(
          tt('explore.locationNeededTitle', 'Location access is required'),
          tt('explore.locationNeededMsg', 'Allow location access to draw route inside the map.')
        );
        return;
      }

      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        origin = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setUserLocation(origin);
      } catch {
        Alert.alert(tt('explore.locationErrorTitle', 'Location unavailable'), tt('explore.locationErrorMsg', 'Could not get your location.'));
        return;
      }
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRoutePreviewPointId(point.id);
    setPreviewPointId(point.id);
    setDetailPointId(point.id);
    setFocusedMapId(point.id);
    setSelectedId(point.id);
  }, [ensureUserLocation, handleOpenYandexDirections, tripId, tt, userLocation]);

  const handleOpenDetail = useCallback((point: MapPoint) => {
    router.push({
      pathname: '/place/[slug]',
      params: {
        slug: point.slug || point.id,
        id: point.id,
        name: point.name,
        city: point.city,
        type: point.type,
        subtype: point.subtype || '',
        lat: String(point.lat),
        lng: String(point.lng),
        info: point.info || '',
        description: point.description || point.info || '',
        imageUrl: point.imageUrl || '',
        gallery: JSON.stringify(point.gallery || []),
        price: point.price != null ? String(point.price) : '',
        priceLevel: point.priceLevel != null ? String(point.priceLevel) : '',
        rating: point.rating != null ? String(point.rating) : '',
        ratingCount: point.ratingCount != null ? String(point.ratingCount) : '',
        phone: point.phone || '',
        website: point.website || '',
        openingHours: JSON.stringify(point.openingHours || []),
        source: point.source || '',
        sourceUrl: point.sourceUrl || '',
        lastVerifiedAt: point.lastVerifiedAt || '',
        confidenceScore: point.confidenceScore != null ? String(point.confidenceScore) : '',
        distanceKm: point.distanceKm != null ? String(point.distanceKm) : '',
        icon: point.icon || 'pin',
      },
    });
  }, []);

  const handleToggleWishlist = useCallback(async (point: MapPoint) => {
    if (!userId) {
      Alert.alert(tt('explore.authNeededTitle', 'Sign in required'), tt('explore.authNeededMsg', 'Please sign in to save places.'));
      return;
    }
    await toggleWishlist({ id: point.id, poiId: point.id, name: point.name, city: point.city, slug: point.slug, type: point.type, icon: point.icon });
  }, [toggleWishlist, tt, userId]);

  const handleExitTripMode = useCallback(() => {
    router.replace('/(tabs)/explore' as any);
  }, []);

  const persistVisitedStops = useCallback(
    async (nextVisitedIds: string[]) => {
      if (!tripId || !trip) return;

      const now = new Date().toISOString();
      const uniqueVisited = Array.from(new Set(nextVisitedIds.map(String)));
      const nextTrip: TripPlan = {
        ...trip,
        updatedAt: now,
        progress: {
          visitedStopIds: uniqueVisited,
          notes:
            trip.progress?.notes && typeof trip.progress.notes === 'object' && !Array.isArray(trip.progress.notes)
              ? trip.progress.notes
              : {},
          updatedAt: now,
        },
      };

      setTrip(nextTrip);

      try {
        const cachedTrips = await getJSON<any[]>(tripStorageKey);
        if (Array.isArray(cachedTrips)) {
          const updatedTrips = cachedTrips.map((item) =>
            String(item?.id) === String(tripId) ? { ...item, ...nextTrip } : item
          );
          await saveJSON(tripStorageKey, updatedTrips);
        }
      } catch {
        // ignore local cache write failure
      }

      try {
        const token = await getItem(KEYS.TOKEN);
        if (token) {
          await tripsAPI.update(String(tripId), nextTrip);
        }
      } catch {
        // keep local progress even if server sync fails
      }
    },
    [trip, tripId, tripStorageKey]
  );

  const handleToggleTripStopVisited = useCallback(
    async (stopId: string) => {
      if (!tripId || !trip) return;
      setSavingStopId(stopId);
      try {
        const nextSet = new Set(Array.isArray(trip.progress?.visitedStopIds) ? trip.progress.visitedStopIds.map(String) : []);
        if (nextSet.has(stopId)) nextSet.delete(stopId);
        else nextSet.add(stopId);
        await persistVisitedStops(Array.from(nextSet));
      } finally {
        setSavingStopId((current) => (current === stopId ? null : current));
      }
    },
    [persistVisitedStops, trip, tripId]
  );

  const handleClosePreview = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPreviewPointId(null);
    setDetailPointId(null);
    setRoutePreviewPointId(null);
  }, []);

  useEffect(() => {
    if (previewPointId && !filteredPoints.some((point) => point.id === previewPointId)) {
      setPreviewPointId(null);
      setDetailPointId(null);
      setRoutePreviewPointId(null);
    }
  }, [filteredPoints, previewPointId]);

  // ── List item renderer ────────────────────────────────────────────────
  const renderListItem = ({ item, index }: { item: ExploreListItem; index: number }) => {
    const wished    = isWishlisted(item.point.id) || isWishlisted(item.point.slug);
    const isFocused = focusedMapId === item.id;
    const iconColor = getTypeColor(item.point.type, colors);

    const handleMapBtn = () => {
      if (isFocused) {
        handleOpenDirections(item.point);
      } else {
        setFocusedMapId(item.id);
        setSelectedId(item.id);
      }
    };

    return (
      <FadeInRow index={index} version={listVersion}>
        <Pressable style={styles.placeRow} onPress={() => handleOpenDetail(item.point)}>

          <View style={[styles.placeIcon, { backgroundColor: iconColor + '18' }]}>
            <Ionicons name={getYandexPoiIconName(item.point) as any} size={22} color={iconColor} />
          </View>

          {/* Name + city */}
          <View style={styles.placeBody}>
            <Text style={styles.placeName} numberOfLines={1}>{item.title}</Text>
            <View style={styles.placeMetaRow}>
              <Ionicons name="location-outline" size={11} color={colors.textMuted} />
              <Text style={styles.placeMeta} numberOfLines={1}>{item.subtitle}</Text>
            </View>
          </View>

          {/* Wishlist */}
          <HeartBtn
            wished={wished}
            onPress={() => handleToggleWishlist(item.point)}
            style={styles.actionCircle}
            wishedStyle={styles.actionCircleWished}
            size={17}
            defaultColor={colors.textSecondary}
            activeColor="#EF4444"
          />

          {/* Map focus → directions */}
          <TouchableOpacity
            style={[styles.actionCircle, isFocused ? styles.actionCircleNav : styles.actionCircleMap]}
            onPress={handleMapBtn}
            activeOpacity={0.82}
          >
            <Ionicons
              name={isFocused ? 'navigate' : 'map-outline'}
              size={17}
              color={isFocused ? '#fff' : colors.primary}
            />
          </TouchableOpacity>

        </Pressable>
      </FadeInRow>
    );
  };

  // ── Header (rendered as FlatList header) ─────────────────────────────
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>

      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>{tt('tabs.explore', 'Explore')}</Text>

        {/* Location / radius buttons */}
        <View style={styles.titleActions}>
          {!tripId ? (
            <TouchableOpacity
              style={[styles.pillBtn, scopePanelOpen ? styles.pillBtnActive : null]}
              onPress={handleToggleScopePanel}
              activeOpacity={0.82}
            >
              <Ionicons
                name={loadMode === 'radius' ? 'radio-outline' : 'scan-outline'}
                size={13}
                color={scopePanelOpen ? colors.textInverse : colors.primary}
              />
              <Text style={[styles.pillBtnText, scopePanelOpen ? styles.pillBtnTextActive : null]}>
                {scopeButtonLabel}
              </Text>
              <Ionicons
                name={scopePanelOpen ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={scopePanelOpen ? colors.textInverse : colors.primary}
              />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.pillBtn, userLocation ? styles.pillBtnActive : null]}
            onPress={handleUseMyLocation}
            activeOpacity={0.82}
            disabled={locating}
          >
            {locating
              ? <ActivityIndicator size="small" color={colors.primary} style={{ width: 13, height: 13 }} />
              : <Ionicons name={userLocation ? 'location' : 'location-outline'} size={13} color={userLocation ? colors.textInverse : colors.primary} />
            }
            <Text style={[styles.pillBtnText, userLocation ? styles.pillBtnTextActive : null]}>
              {userLocation ? tt('explore.nearMeOn', 'Near me') : tt('explore.nearMe', 'Near me')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Trip mode banner */}
      {tripId ? (
        <View style={styles.tripBanner}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.tripBannerTitle} numberOfLines={1}>
              {trip?.title || tt('explore.tripLoadingTitle', 'Trip route')}
            </Text>
            <Text style={styles.tripBannerSub}>
              {tripModeSubtitle}
            </Text>
          </View>
          <TouchableOpacity style={styles.tripExitBtn} onPress={handleExitTripMode} activeOpacity={0.82}>
            <Text style={styles.tripExitBtnText}>{tt('common.exit', 'Exit')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Map */}
      <ExploreMap
        initialRegion={initialRegion}
        markers={mapMarkers}
        mapTheme={resolvedTheme}
        selectedMarkerId={selectedId}
        focusedMarkerId={focusedMapId}
        autoFitOnLoad={Boolean(tripId)}
        recenterToInitialRegionSignal={tripId ? 0 : recenterToInitialRegionSignal}
        recenterToUserLocationSignal={recenterToUserLocationSignal}
        onFocusReset={() => setFocusedMapId(null)}
        routeCoordinates={routeCoordinates}
        completedRouteCoordinates={completedRouteCoordinates}
        userLocation={userLocation}
        enabled={mapEnabled}
        disabledReason={mapDisabledReason}
        onViewportChanged={handleViewportChanged}
      />

      {!tripId ? (
        <>
          {/* Search */}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={17} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setListVersion((n) => n + 1);
                setPreviewPointId(null);
                setDetailPointId(null);
                setRoutePreviewPointId(null);
                setFocusedMapId(null);
                setSelectedId(null);
              }}
              placeholder={tt('explore.searchPlaceholder', 'Search places, cities...')}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => {
                  setQuery('');
                  setListVersion((n) => n + 1);
                  setPreviewPointId(null);
                  setDetailPointId(null);
                  setRoutePreviewPointId(null);
                  setFocusedMapId(null);
                  setSelectedId(null);
                }}>
                  <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
          </View>

          {/* Category blocks */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            {(Object.keys(CATEGORY_META) as POIType[]).map((key) => {
              const meta   = CATEGORY_META[key];
              const active = category === key;
              const count  = points.filter((p) => p.type === key).length;

              return (
                <CatPressable
                  key={key}
                  active={active}
                  onPress={() => handleSetCategory(active ? 'all' : key)}
                  style={styles.catBlock}
                  activeStyle={[styles.catBlockActive, { borderColor: meta.markerColor + '55', backgroundColor: meta.markerColor + '12' }]}
                >
                  <View style={[styles.catIconCircle, { backgroundColor: active ? meta.markerColor + '20' : colors.cardMuted }]}>
                    <Ionicons name={getYandexCategoryIconName(key) as any} size={27} color={active ? meta.markerColor : colors.textSecondary} />
                  </View>
                  <Text style={[styles.catLabel, active && { color: meta.markerColor }]}>{tt(`explore.cat.${key}`, meta.label)}</Text>
                  <View style={[styles.catBadge, active && { backgroundColor: meta.markerColor }]}>
                    <Text style={[styles.catBadgeText, active && styles.catBadgeTextActive]}>{count}</Text>
                  </View>
                </CatPressable>
              );
            })}
          </ScrollView>

          {/* Sub-category chips */}
          <Animated.View style={{ opacity: subchipsAnim }}>
            {visibleSubcategories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {visibleSubcategories.map((item) => {
                  const chipActive = subtype === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.chip, chipActive && { backgroundColor: item.color, borderColor: item.color }]}
                      onPress={() => handleSetSubtype(chipActive ? 'all' : (item.key as SubtypeFilter))}
                      activeOpacity={0.82}
                    >
                      <Ionicons
                        name={getYandexSubtypeIconName(item.key) as any}
                        size={13}
                        color={chipActive ? colors.textInverse : item.color}
                      />
                      <Text style={[styles.chipText, chipActive && styles.chipTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </Animated.View>
        </>
      ) : null}

      {/* Trip day selector */}
      {tripId && tripDays.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
          {tripDays.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.dayChip, activeDay === d && styles.dayChipActive]}
              onPress={() => setActiveDay(d)}
              activeOpacity={0.82}
            >
              <Text style={[styles.dayChipText, activeDay === d && styles.dayChipTextActive]}>
                {tt('common.dayShort', 'Day')} {d}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {/* Section header */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>
          {tripId ? tt('explore.tripStopsTitle', 'Route stops') : tt('explore.listTitle', 'Places')}
        </Text>
        <Text style={styles.sectionCount}>
          {tripId ? visibleTripStops.length : filteredPoints.length}
        </Text>
      </View>

      {/* Status / error */}
      {tripLoading && tripId ? (
        <View style={styles.statusCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.statusText}>{tt('explore.tripLoadingSub', 'Loading trip stops...')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{tt('explore.loadErrorTitle', 'Could not load places')}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadPoints({ force: true })} activeOpacity={0.82}>
            <Text style={styles.retryBtnText}>{tt('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  // ── Root render ───────────────────────────────────────────────────────
  void renderListItem;
  void header;

  if (loadMode === 'radius' && locating && !userLocation) {
    return (
      <View style={[styles.container, styles.permissionGate, { paddingTop: insets.top + SPACING.xl }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.permissionTitle}>{tt('explore.locationLoadingTitle', 'Getting your location...')}</Text>
        <Text style={styles.permissionText}>
          {tt('explore.locationLoadingText', 'Explore opens after your current location is ready.')}
        </Text>
      </View>
    );
  }

  if (loadMode === 'radius' && (!userLocation || locationAccess === 'denied' || locationAccess === 'error')) {
    return (
      <View style={[styles.container, styles.permissionGate, { paddingTop: insets.top + SPACING.xl }]}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="location" size={24} color={colors.primary} />
          </View>
          <Text style={styles.permissionTitle}>{tt('explore.locationNeededTitle', 'Location access is required')}</Text>
          <Text style={styles.permissionText}>
            {locationError || tt('explore.locationNeededMsg', 'Allow location access first, then Explore will open and keep your position visible on the map.')}
          </Text>
          <TouchableOpacity style={styles.permissionPrimaryBtn} onPress={handleUseMyLocation} activeOpacity={0.82}>
            <Text style={styles.permissionPrimaryBtnText}>{tt('explore.allowLocation', 'Allow access')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permissionSecondaryBtn} onPress={() => Linking.openSettings()} activeOpacity={0.82}>
            <Text style={styles.permissionSecondaryBtnText}>{tt('explore.openSettings', 'Open settings')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && points.length === 0 && loadMode !== 'viewport') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + SPACING.xl }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{tt('explore.loading', 'Loading places...')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExploreMap
        initialRegion={initialRegion}
        markers={mapMarkers}
        mapTheme={resolvedTheme}
        selectedMarkerId={selectedId}
        focusedMarkerId={focusedMapId}
        autoFitOnLoad={Boolean(tripId)}
        recenterToInitialRegionSignal={tripId ? 0 : recenterToInitialRegionSignal}
        recenterToUserLocationSignal={recenterToUserLocationSignal}
        onFocusReset={() => setFocusedMapId(null)}
        routeCoordinates={routeCoordinates}
        completedRouteCoordinates={completedRouteCoordinates}
        userLocation={userLocation}
        enabled={mapEnabled}
        disabledReason={mapDisabledReason}
        onViewportChanged={handleViewportChanged}
      />

      <View pointerEvents="box-none" style={styles.mapOverlay}>
        <View pointerEvents="box-none" style={[styles.topOverlay, { paddingTop: insets.top + SPACING.sm }]}>
          {tripId ? (
            <View style={styles.tripBanner}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.tripBannerTitle} numberOfLines={1}>
                  {trip?.title || tt('explore.tripLoadingTitle', 'Trip route')}
                </Text>
                <Text style={styles.tripBannerSub}>
                  {tripModeSubtitle}
                </Text>
              </View>
              <TouchableOpacity style={styles.tripExitBtn} onPress={handleExitTripMode} activeOpacity={0.82}>
                <Text style={styles.tripExitBtnText}>{tt('common.exit', 'Exit')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.exploreChrome}>
              <View style={styles.exploreHeader}>
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/side-menu' as any)} activeOpacity={0.82}>
                  <Ionicons name="menu" size={17} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerBrand}>TravelorAI</Text>
                <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.82}>
                  <Ionicons name="person-outline" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={17} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setPreviewPointId(null);
                  setDetailPointId(null);
                  setRoutePreviewPointId(null);
                  setFocusedMapId(null);
                  setSelectedId(null);
                }}
                placeholder={tt('explore.searchPlaceholder', 'Search places, cities...')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => {
                  setQuery('');
                  setPreviewPointId(null);
                  setDetailPointId(null);
                  setRoutePreviewPointId(null);
                  setFocusedMapId(null);
                  setSelectedId(null);
                }}>
                  <Ionicons name="close-circle" size={17} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
                <TouchableOpacity
                  style={[styles.searchTuneBtn, scopePanelOpen && styles.searchTuneBtnActive]}
                  onPress={() => router.push('/search-filters' as any)}
                  activeOpacity={0.82}
                >
                  <Ionicons name="options-outline" size={16} color={colors.success} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topChipRow}>
                <TouchableOpacity style={[styles.topChip, category === 'all' && styles.topChipActive]} onPress={() => handleSetCategory('all')} activeOpacity={0.82}>
                  <Text style={[styles.topChipText, category === 'all' && styles.topChipTextActive]}>Barchasi</Text>
                </TouchableOpacity>
                {(['restaurant', 'hotel', 'landmark', 'transport'] as POIType[]).map((key) => {
                  const active = category === key;
                  const meta = CATEGORY_META[key];
                  return (
                    <TouchableOpacity key={key} style={[styles.topChip, active && styles.topChipActive]} onPress={() => handleSetCategory(active ? 'all' : key)} activeOpacity={0.82}>
                      <Ionicons name={getYandexCategoryIconName(key) as any} size={13} color={active ? colors.textInverse : colors.textSecondary} />
                      <Text style={[styles.topChipText, active && styles.topChipTextActive]}>{tt(`explore.cat.${key}`, meta.label)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {tripLoading && tripId ? (
            <View style={styles.statusCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>{tt('explore.tripLoadingSub', 'Loading trip stops...')}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>{tt('explore.loadErrorTitle', 'Could not load places')}</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadPoints({ force: true })} activeOpacity={0.82}>
                <Text style={styles.retryBtnText}>{tt('common.retry', 'Retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!tripId && scopePanelOpen ? (
            <View style={styles.scopePopover}>
              <View style={styles.scopeCard}>
                <View style={styles.scopeModeRow}>
                  <TouchableOpacity
                    style={[styles.scopeModeBtn, loadMode === 'radius' && styles.scopeModeBtnActive]}
                    onPress={() => handleSetLoadMode('radius')}
                    activeOpacity={0.82}
                  >
                    <Ionicons
                      name="radio-outline"
                      size={14}
                      color={loadMode === 'radius' ? colors.textInverse : colors.textSecondary}
                    />
                    <Text style={[styles.scopeModeText, loadMode === 'radius' && styles.scopeModeTextActive]}>
                      {tt('explore.scopeRadius', 'Radius')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.scopeModeBtn, loadMode === 'viewport' && styles.scopeModeBtnActive]}
                    onPress={() => handleSetLoadMode('viewport')}
                    activeOpacity={0.82}
                  >
                    <Ionicons
                      name="scan-outline"
                      size={14}
                      color={loadMode === 'viewport' ? colors.textInverse : colors.textSecondary}
                    />
                    <Text style={[styles.scopeModeText, loadMode === 'viewport' && styles.scopeModeTextActive]}>
                      {tt('explore.scopeVisibleArea', 'Visible area')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.scopeBodyRow}>
                  <View style={styles.scopeInfoWrap}>
                    <Text style={styles.scopeTitle}>
                      {loadMode === 'radius'
                        ? tt('explore.scopeNearbyTitle', 'Nearby places')
                        : tt('explore.scopeVisibleTitle', 'Places on this map area')}
                    </Text>
                    <Text style={styles.scopeHint}>{scopeHintText}</Text>
                  </View>

                  {loadMode === 'radius' ? (
                    <View style={styles.radiusStepper}>
                      <TouchableOpacity
                        style={[styles.radiusStepBtn, !canDecreaseRadius && styles.radiusStepBtnDisabled]}
                        onPress={() => handleAdjustRadius('decrease')}
                        activeOpacity={0.82}
                        disabled={!canDecreaseRadius}
                      >
                        <Ionicons name="remove" size={16} color={canDecreaseRadius ? colors.text : colors.textMuted} />
                      </TouchableOpacity>

                      <Text style={styles.radiusValue}>{radiusKm} km</Text>

                      <TouchableOpacity
                        style={[styles.radiusStepBtn, !canIncreaseRadius && styles.radiusStepBtnDisabled]}
                        onPress={() => handleAdjustRadius('increase')}
                        activeOpacity={0.82}
                        disabled={!canIncreaseRadius}
                      >
                        <Ionicons name="add" size={16} color={canIncreaseRadius ? colors.text : colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.scopeStatusBadge}>
                      {refreshingPlaces ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons
                          name={viewportRequest ? 'map-outline' : 'search-outline'}
                          size={16}
                          color={colors.primary}
                        />
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {tripId && tripDays.length > 0 ? (
          <View pointerEvents="box-none" style={[styles.bottomOverlay, { bottom: safeBottom + 112 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              <TouchableOpacity
                style={[styles.dayChip, activeDay == null && styles.dayChipActive]}
                onPress={() => setActiveDay(null)}
                activeOpacity={0.82}
              >
                <Text style={[styles.dayChipText, activeDay == null && styles.dayChipTextActive]}>
                  {tt('common.all', 'All')}
                </Text>
              </TouchableOpacity>
              {tripDays.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dayChip, activeDay === d && styles.dayChipActive]}
                  onPress={() => setActiveDay(d)}
                  activeOpacity={0.82}
                >
                  <Text style={[styles.dayChipText, activeDay === d && styles.dayChipTextActive]}>
                    {tt('common.dayShort', 'Day')} {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.tripProgressPill}>
              <Ionicons name="checkmark-done" size={14} color={colors.primary} />
              <Text style={styles.tripProgressPillText}>
                {visibleVisitedCount}/{visibleTripStops.length} {tt('explore.tripVisitedShort', 'visited')}
              </Text>
            </View>

            {selectedTripStop ? (
              <View style={styles.tripStopCard}>
                <View style={styles.tripStopHead}>
                  <View style={styles.tripStopBadge}>
                    <Text style={styles.tripStopBadgeText}>
                      {visibleTripStops.findIndex((stop) => stop.id === selectedTripStop.id) + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripStopTitle} numberOfLines={1}>{selectedTripStop.title}</Text>
                    <Text style={styles.tripStopMeta} numberOfLines={1}>
                      {tt('common.dayShort', 'Day')} {selectedTripStop.dayNumber}
                      {selectedTripStop.time ? ` • ${selectedTripStop.time}` : ''}
                      {selectedTripStop.city ? ` • ${selectedTripStop.city}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.tripStopActions}>
                  <TouchableOpacity
                    style={[styles.tripStopBtn, selectedTripStopVisited && styles.tripStopBtnVisited]}
                    onPress={() => handleToggleTripStopVisited(selectedTripStop.id)}
                    activeOpacity={0.82}
                    disabled={savingStopId === selectedTripStop.id}
                  >
                    {savingStopId === selectedTripStop.id ? (
                      <ActivityIndicator size="small" color={selectedTripStopVisited ? colors.textInverse : colors.primary} />
                    ) : (
                      <Ionicons
                        name={selectedTripStopVisited ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={selectedTripStopVisited ? colors.textInverse : colors.primary}
                      />
                    )}
                    <Text style={[styles.tripStopBtnText, selectedTripStopVisited && styles.tripStopBtnTextVisited]}>
                      {selectedTripStopVisited ? tt('explore.tripVisitedUndo', 'Mark as not visited') : tt('explore.tripVisitedMark', 'Mark as visited')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tripStopBtn, styles.tripStopBtnPrimary]}
                    onPress={() => handleOpenDirections(selectedTripStop.point)}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="navigate-outline" size={16} color={colors.textInverse} />
                    <Text style={styles.tripStopBtnPrimaryText}>{tt('explore.directions', 'Directions')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        ) : !tripId ? (
          <View pointerEvents="box-none" style={[styles.bottomOverlay, { bottom: previewPoint ? safeBottom + 124 : safeBottom + 104 }]}>
            {previewPoint ? (
              <View style={[styles.previewCard, previewIsDetailed && styles.previewCardDetailed]}>
                <View style={styles.previewHeader}>
                  <View style={[styles.previewIconWrap, { backgroundColor: getTypeColor(previewPoint.type, colors) + '18' }]}>
                    <Ionicons name={getYandexPoiIconName(previewPoint) as any} size={24} color={getTypeColor(previewPoint.type, colors)} />
                  </View>

                  <View style={styles.previewBody}>
                    <Text style={styles.previewName} numberOfLines={1}>{previewPoint.name}</Text>
                    <Text style={styles.previewCity} numberOfLines={1}>{previewPoint.city}</Text>
                    <View style={styles.previewMetaRow}>
                      <View style={styles.previewMetaChip}>
                        <Text style={styles.previewMetaChipText}>
                          {tt(`explore.cat.${previewPoint.type}`, CATEGORY_META[previewPoint.type]?.label || previewPoint.type)}
                        </Text>
                      </View>
                      {previewDistanceKm != null ? (
                        <View style={styles.previewMetaChip}>
                          <Text style={styles.previewMetaChipText}>{previewDistanceKm.toFixed(1)} km</Text>
                        </View>
                      ) : null}
                      {previewSourceLabel ? (
                        <View style={[styles.previewMetaChip, styles.previewMetaChipSource]}>
                          <Text style={[styles.previewMetaChipText, styles.previewMetaChipSourceText]}>{previewSourceLabel}</Text>
                        </View>
                      ) : null}
                      {previewConfidence ? (
                        <View style={styles.previewMetaChip}>
                          <Text style={styles.previewMetaChipText}>Ishonch {previewConfidence}</Text>
                        </View>
                      ) : null}
                      {previewLastUpdated ? (
                        <View style={styles.previewMetaChip}>
                          <Text style={styles.previewMetaChipText}>Yangilandi {previewLastUpdated}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <TouchableOpacity style={styles.previewCloseBtn} onPress={handleClosePreview} activeOpacity={0.82}>
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.previewInfo} numberOfLines={previewIsDetailed ? undefined : 2}>
                  {previewPoint.info || tt('explore.detailErrorMsg', 'This place has no detail page yet.')}
                </Text>

                {previewIsDetailed ? (
                  <View style={styles.detailGrid}>
                    <View style={styles.detailLine}>
                      <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.detailText}>
                        {routePreviewPointId === previewPoint.id
                          ? tt('explore.routePreviewOn', 'Route preview is shown on the map.')
                          : tt('explore.routePreviewHint', 'Directions can be previewed inside this map.')}
                      </Text>
                    </View>
                    <View style={styles.detailLine}>
                      <Ionicons name="analytics-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.detailText}>
                        {previewConfidence
                          ? `${tt('explore.confidence', 'Confidence')}: ${previewConfidence}`
                          : tt('explore.confidenceUnknown', 'Confidence score is not available yet.')}
                      </Text>
                    </View>
                    <View style={styles.detailLine}>
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.detailText}>
                        {previewLastUpdated
                          ? `${tt('explore.lastUpdated', 'Last updated')}: ${previewLastUpdated}`
                          : tt('explore.lastUpdatedUnknown', 'Last verified date is not available yet.')}
                      </Text>
                    </View>
                    <View style={styles.detailLine}>
                      <Ionicons name="locate-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.detailText}>
                        {previewPoint.lat.toFixed(5)}, {previewPoint.lng.toFixed(5)}
                      </Text>
                    </View>
                    {previewSourceLabel ? (
                      <View style={styles.detailLine}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.detailText}>{`${tt('explore.source', 'Source')}: ${previewSourceLabel}`}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={[styles.previewActionBtn, styles.previewActionSecondary]}
                    onPress={() => handleOpenDirections(previewPoint)}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                    <Text style={[styles.previewActionText, { color: colors.primary }]}>
                      {tt('explore.routeInApp', 'Route')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.previewActionBtn, styles.previewActionPrimary]}
                    onPress={() => handleOpenDetail(previewPoint)}
                    activeOpacity={0.82}
                  >
                    <Text style={styles.previewActionTextPrimary}>
                      {tt('explore.moreDetails', 'More details')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {previewIsDetailed ? (
                  <TouchableOpacity
                    style={styles.previewExternalBtn}
                    onPress={() => handleOpenYandexDirections(previewPoint)}
                    activeOpacity={0.82}
                  >
                    <Ionicons name="open-outline" size={15} color={colors.primary} />
                    <Text style={styles.previewExternalBtnText}>
                      {tt('explore.openInYandex', 'Open exact navigation in Yandex')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                <Animated.View style={{ opacity: subchipsAnim }}>
                  {visibleSubcategories.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                      {visibleSubcategories.map((item) => {
                        const chipActive = subtype === item.key;
                        return (
                          <TouchableOpacity
                            key={item.key}
                            style={[styles.chip, chipActive && { backgroundColor: item.color, borderColor: item.color }]}
                            onPress={() => handleSetSubtype(chipActive ? 'all' : (item.key as SubtypeFilter))}
                            activeOpacity={0.82}
                          >
                            <Ionicons
                              name={getYandexSubtypeIconName(item.key) as any}
                              size={13}
                              color={chipActive ? colors.textInverse : item.color}
                            />
                            <Text style={[styles.chipText, chipActive && styles.chipTextActive]}>{item.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </Animated.View>

                <View style={styles.nearbyPanel}>
                  <View style={styles.nearbyHeader}>
                    <Text style={styles.nearbyTitle}>Yaqin atrofdagi joylar</Text>
                    <Text style={styles.nearbyCount}>{filteredPoints.length}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyCardRow}>
                    {nearbyCardPoints.map((point) => {
                      const distance = pointDistanceMap.get(point.id);
                      return (
                        <TouchableOpacity key={point.id} style={styles.nearbyCard} onPress={() => handleOpenDetail(point)} activeOpacity={0.9}>
                          <View style={styles.nearbyImageWrap}>
                            <PlacePreviewImage point={point} styles={styles} colors={colors} />
                            <TouchableOpacity style={styles.nearbyHeart} onPress={() => handleToggleWishlist(point)} activeOpacity={0.82}>
                              <Ionicons name={isWishlisted(point.id) || isWishlisted(point.slug) ? 'heart' : 'heart-outline'} size={15} color={colors.text} />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.nearbyCardBody}>
                            <View style={styles.nearbyNameRow}>
                              <Text style={styles.nearbyName} numberOfLines={1}>{point.name}</Text>
                              {point.rating ? (
                                <Text style={styles.nearbyRating}>★ {Number(point.rating).toFixed(1)}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.nearbyMeta} numberOfLines={1}>
                              {tt(`explore.cat.${point.type}`, CATEGORY_META[point.type]?.label || point.type)}
                              {distance != null ? ` · ${distance.toFixed(1)} km` : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mapOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    topOverlay: {
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
      paddingTop: SPACING.sm,
    },
    exploreChrome: {
      gap: SPACING.sm,
    },
    exploreHeader: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.glassStrong,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 3,
    },
    headerBrand: {
      fontFamily: FONTS.display,
      fontSize: 15,
      color: colors.text,
      textShadowColor: colors.surface + 'AA',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    scopePopover: {
      marginTop: SPACING.xs,
    },
    bottomOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    loadingText: {
      fontFamily: FONTS.medium,
      fontSize: 14,
      color: colors.textSecondary,
    },
    permissionGate: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
    },
    permissionCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: RADIUS.xl,
      backgroundColor: colors.surface,
      padding: SPACING.lg,
      alignItems: 'center',
      gap: SPACING.md,
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 5,
    },
    permissionIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 18,
      color: colors.text,
      textAlign: 'center',
    },
    permissionText: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    permissionPrimaryBtn: {
      width: '100%',
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionPrimaryBtnText: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.textInverse,
    },
    permissionSecondaryBtn: {
      width: '100%',
      height: 42,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    permissionSecondaryBtnText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.textSecondary,
    },

    // ── Header ──
    header: {
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
      paddingBottom: SPACING.md,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontFamily: FONTS.display,
      fontSize: 34,
      color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.28)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    titleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    pillBtn: {
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.glassStrong,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      gap: 5,
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    pillBtnActive: {
      backgroundColor: colors.primary,
    },
    pillBtnText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.primary,
    },
    pillBtnTextActive: {
      color: colors.textInverse,
    },
    scopeCard: {
      borderRadius: RADIUS.xl,
      backgroundColor: colors.glassStrong,
      padding: SPACING.md,
      gap: SPACING.sm,
      shadowColor: colors.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 9,
    },
    scopeModeRow: {
      flexDirection: 'row',
      gap: SPACING.xs,
    },
    scopeModeBtn: {
      flex: 1,
      height: 34,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    scopeModeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scopeModeText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    scopeModeTextActive: {
      color: colors.textInverse,
    },
    scopeBodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    scopeInfoWrap: {
      flex: 1,
      gap: 2,
    },
    scopeTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.text,
    },
    scopeHint: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
    },
    radiusStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.background,
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    radiusStepBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    radiusStepBtnDisabled: {
      opacity: 0.45,
    },
    radiusValue: {
      minWidth: 60,
      textAlign: 'center',
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.text,
    },
    scopeStatusBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primary + '22',
    },

    // ── Trip banner ──
    tripBanner: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryPale,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    tripBannerTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: colors.text,
    },
    tripBannerSub: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
    },
    tripExitBtn: {
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripExitBtnText: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.primary,
    },

    // ── Search ──
    searchBox: {
      height: 52,
      borderRadius: RADIUS.full,
      backgroundColor: colors.glassStrong,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      gap: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 22,
      elevation: 4,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 0,
      color: colors.text,
      fontFamily: FONTS.regular,
      fontSize: 14,
    },
    searchTuneBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.successPale,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: -4,
    },
    searchTuneBtnActive: {
      backgroundColor: colors.success,
    },
    topChipRow: {
      gap: SPACING.sm,
      paddingRight: SPACING.lg,
      paddingBottom: 2,
    },
    topChip: {
      height: 31,
      borderRadius: RADIUS.full,
      backgroundColor: colors.glassStrong,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 2,
    },
    topChipActive: {
      backgroundColor: colors.text,
    },
    topChipText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textSecondary,
    },
    topChipTextActive: {
      color: colors.textInverse,
    },

    // ── Category blocks ──
    catRow: {
      gap: SPACING.sm,
      paddingRight: SPACING.md,
    },
    catBlock: {
      width: 88,
      height: 122,
      borderRadius: RADIUS.xl,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 5,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 3,
    },
    catBlockActive: {},
    catIconCircle: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catLabel: {
      fontFamily: FONTS.medium,
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    catBadge: {
      minWidth: 22,
      height: 15,
      borderRadius: 8,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    catBadgeText: {
      fontFamily: FONTS.semibold,
      fontSize: 9,
      color: colors.textSecondary,
    },
    catBadgeTextActive: {
      color: '#fff',
    },
    nearbyPanel: {
      marginHorizontal: -SPACING.lg,
      paddingLeft: SPACING.lg,
      gap: SPACING.sm,
    },
    nearbyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: SPACING.lg,
    },
    nearbyTitle: {
      fontFamily: FONTS.display,
      fontSize: 18,
      color: colors.text,
    },
    nearbyCount: {
      minWidth: 30,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.glassStrong,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.success,
      overflow: 'hidden',
    },
    nearbyCardRow: {
      gap: SPACING.sm,
      paddingRight: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    nearbyCard: {
      width: 172,
      borderRadius: 20,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 22,
      elevation: 5,
    },
    nearbyImageWrap: {
      height: 108,
      backgroundColor: colors.cardMuted,
    },
    nearbyImage: {
      flex: 1,
    },
    nearbyImageRadius: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    nearbyImageOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      padding: 8,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    nearbyImageSource: {
      overflow: 'hidden',
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.86)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontFamily: FONTS.semibold,
      fontSize: 9,
      color: colors.text,
    },
    nearbyImageFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successPale,
    },
    nearbyHeart: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    nearbyCardBody: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
      gap: 4,
    },
    nearbyNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    nearbyName: {
      flex: 1,
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.text,
    },
    nearbyRating: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.gold,
    },
    nearbyMeta: {
      fontFamily: FONTS.regular,
      fontSize: 11,
      color: colors.textSecondary,
    },
    previewCard: {
      borderRadius: RADIUS.xxl,
      backgroundColor: colors.glassStrong,
      padding: SPACING.lg,
      gap: SPACING.sm,
      shadowColor: colors.shadow,
      shadowOpacity: 0.16,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 14 },
      elevation: 12,
    },
    previewCardDetailed: {
      gap: SPACING.md,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    previewIconWrap: {
      width: 52,
      height: 52,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewBody: {
      flex: 1,
      gap: 4,
    },
    previewName: {
      fontFamily: FONTS.semibold,
      fontSize: 16,
      color: colors.text,
    },
    previewCity: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    previewMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
    },
    previewMetaChip: {
      height: 24,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewMetaChipText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    previewMetaChipSource: {
      backgroundColor: colors.primary + '14',
    },
    previewMetaChipSourceText: {
      color: colors.primary,
    },
    previewCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    previewInfo: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    detailGrid: {
      gap: 8,
      padding: SPACING.sm,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    detailLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    previewActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    previewActionBtn: {
      flex: 1,
      height: 42,
      borderRadius: RADIUS.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    previewActionPrimary: {
      backgroundColor: colors.primary,
    },
    previewActionSecondary: {
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    previewActionText: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
    },
    previewActionTextPrimary: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.textInverse,
    },
    previewExternalBtn: {
      height: 40,
      borderRadius: RADIUS.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primary + '22',
    },
    previewExternalBtnText: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.primary,
    },

    // ── Sub-category chips ──
    chipsRow: {
      gap: SPACING.xs,
      paddingRight: SPACING.md,
    },
    chip: {
      height: 32,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      gap: 4,
    },
    chipText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: '#fff',
    },

    // ── Day selector ──
    dayRow: {
      gap: SPACING.xs,
      paddingRight: SPACING.md,
    },
    dayChip: {
      height: 36,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    dayChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipText: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
    },
    dayChipTextActive: {
      color: '#fff',
    },

    // ── Section header ──
    tripProgressPill: {
      alignSelf: 'flex-start',
      height: 28,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
    },
    tripProgressPillText: {
      fontFamily: FONTS.medium,
      fontSize: 11,
      color: colors.textSecondary,
    },
    tripStopCard: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      gap: SPACING.sm,
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    tripStopHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    tripStopBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryPale,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    tripStopBadgeText: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: colors.primary,
    },
    tripStopTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 15,
      color: colors.text,
    },
    tripStopMeta: {
      marginTop: 2,
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
    },
    tripStopActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    tripStopBtn: {
      flex: 1,
      height: 40,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      backgroundColor: colors.primaryPale,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 10,
    },
    tripStopBtnVisited: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tripStopBtnText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.primary,
    },
    tripStopBtnTextVisited: {
      color: colors.textInverse,
    },
    tripStopBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tripStopBtnPrimaryText: {
      fontFamily: FONTS.semibold,
      fontSize: 11,
      color: colors.textInverse,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.xs,
    },
    sectionTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 18,
      color: colors.text,
    },
    sectionCount: {
      fontFamily: FONTS.semibold,
      fontSize: 13,
      color: colors.primary,
    },

    // ── Status / error cards ──
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    statusText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    errorCard: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: colors.errorPale,
      backgroundColor: colors.errorPale,
      padding: SPACING.md,
      gap: 8,
    },
    errorTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.error,
    },
    errorText: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    retryBtn: {
      alignSelf: 'flex-start',
      height: 36,
      borderRadius: RADIUS.full,
      backgroundColor: colors.error,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryBtnText: {
      fontFamily: FONTS.semibold,
      fontSize: 12,
      color: '#fff',
    },

    // ── Place list item ──
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.07,
      shadowRadius: 18,
      elevation: 2,
    },
    placeIcon: {
      width: 46,
      height: 46,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeBody: {
      flex: 1,
      gap: 3,
    },
    placeName: {
      fontFamily: FONTS.semibold,
      fontSize: 14,
      color: colors.text,
    },
    placeMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    placeMeta: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
    },
    actionCircle: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.cardMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionCircleWished: {
      borderColor: '#FEE2E2',
      backgroundColor: '#FEF2F2',
    },
    actionCircleMap: {
      borderColor: colors.primaryPale,
      backgroundColor: colors.primaryPale,
    },
    actionCircleNav: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },

    // ── Empty state ──
    empty: {
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.xl,
      gap: SPACING.sm,
    },
    emptyTitle: {
      fontFamily: FONTS.semibold,
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
