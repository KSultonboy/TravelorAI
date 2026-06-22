import { Ionicons } from '@expo/vector-icons';
import { resolveMediaUrl } from './api';

export type HomePlaceType = 'all' | 'landmark' | 'restaurant' | 'hotel' | 'transport';
export type HomeTourBadge = 'Latest' | 'Popular';

export type HomeTourItineraryItem = {
  day: number;
  title: string;
  description?: string | null;
};

export type PopularPlaceItem = {
  id: string;
  slug: string;
  name: string;
  city: string;
  type: string;
  subtype?: string | null;
  icon: string;
  imageUrl?: string | null;
  info?: string | null;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string[] | null;
  gallery?: string[];
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore?: number | null;
};

export type HomeTourItem = {
  id: string;
  slug?: string | null;
  title: string;
  city: string;
  subtitle: string;
  description?: string | null;
  duration: string;
  responseTimeMinutes?: number;
  price: string;
  priceMin?: number | null;
  priceCurrency?: string | null;
  priceBasis?: string | null;
  rating: number;
  badge: HomeTourBadge;
  imageUrl?: string | null;
  highlights?: string[];
  itinerary?: HomeTourItineraryItem[];
  departureCity?: string | null;
  destinationCountry?: string | null;
  tourGroup?: string | null;
  nights?: number | null;
  hotelIncluded?: boolean;
  hotelName?: string | null;
  hotelCategory?: string | null;
  hotelLocation?: string | null;
  roomType?: string | null;
  mealPlan?: string | null;
  mealPlanLabel?: string | null;
  childPolicy?: string | null;
  flightSeatStatus?: string | null;
  availabilityStatus?: string | null;
  instantConfirmation?: boolean;
  stopSale?: boolean;
  promo?: boolean;
  priceIncludes?: string[];
  priceExcludes?: string[];
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore?: number | null;
  agency?: {
    id: string;
    slug?: string | null;
    name: string;
    city?: string | null;
    rating?: number | null;
    phone?: string | null;
    telegram?: string | null;
    website?: string | null;
  } | null;
};

export type HomeAgencyItem = {
  id: string;
  slug?: string | null;
  name: string;
  city: string;
  description?: string | null;
  rating: number;
  reviews: number;
  tours: number;
  specialty: string;
  phone?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore?: number | null;
};

export type HomeHeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  placeSlug?: string | null;
};

export type HomePayload = {
  places: PopularPlaceItem[];
  tours: HomeTourItem[];
  agencies: HomeAgencyItem[];
  heroSlides: HomeHeroSlide[];
  stats?: {
    places?: number;
    tours?: number;
    agencies?: number;
    source?: string;
  };
  updatedAt?: string;
};

export const HOME_DEFAULT_HERO: HomeHeroSlide = {
  id: 'empty',
  title: 'TravelorAI',
  subtitle: 'Dunyo bo‘ylab aqlli marshrutlar, joylar va turlar.',
  imageUrl: null,
};

export const PLACE_FILTERS: { key: HomePlaceType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Barchasi', icon: 'grid-outline' },
  { key: 'landmark', label: 'Landmark', icon: 'location-outline' },
  { key: 'restaurant', label: 'Restoran', icon: 'restaurant-outline' },
  { key: 'hotel', label: 'Hotel', icon: 'bed-outline' },
  { key: 'transport', label: 'Transport', icon: 'bus-outline' },
];

export function isGlobalPlace(item: { lat?: number | null; lng?: number | null; city?: string | null }) {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  return Boolean(String(item.city || '').trim());
}

export function normalizePopularPlaces(items: unknown[]) {
  const seen = new Set<string>();
  return (Array.isArray(items) ? items : [])
    .map((item: any, index: number): PopularPlaceItem => ({
      id: String(item?.id || item?.slug || `poi-${index}`),
      slug: String(item?.slug || item?.id || `poi-${index}`),
      name: String(item?.name || 'Nomsiz joy'),
      city: String(item?.city || ''),
      type: String(item?.type || 'landmark').toLowerCase(),
      icon: String(item?.icon || 'pin'),
      imageUrl: resolveMediaUrl(item?.imageUrl),
      subtype: item?.subtype || null,
      info: item?.info || '',
      description: item?.description || item?.info || '',
      lat: Number.isFinite(Number(item?.lat)) ? Number(item.lat) : null,
      lng: Number.isFinite(Number(item?.lng)) ? Number(item.lng) : null,
      rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : null,
      ratingCount: Number.isFinite(Number(item?.ratingCount)) ? Number(item.ratingCount) : null,
      phone: item?.phone || null,
      website: item?.website || null,
      openingHours: Array.isArray(item?.openingHours) ? item.openingHours : [],
      gallery: Array.isArray(item?.gallery) ? item.gallery : [],
      source: item?.source || '',
      sourceUrl: item?.sourceUrl || null,
      lastVerifiedAt: item?.lastVerifiedAt || null,
      confidenceScore: Number.isFinite(Number(item?.confidenceScore)) ? Number(item.confidenceScore) : null,
    }))
    .filter((item) => item.slug && item.name && isGlobalPlace(item))
    .filter((item) => {
      const key = `${item.type}:${item.name.toLowerCase()}:${Number(item.lat || 0).toFixed(4)}:${Number(item.lng || 0).toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeTours(items: unknown[]) {
  return (Array.isArray(items) ? items : [])
    .map((item: any, index: number): HomeTourItem => ({
      id: String(item?.id || item?.slug || `tour-${index}`),
      slug: item?.slug || null,
      title: String(item?.title || 'Nomsiz tur'),
      city: String(item?.city || 'Global'),
      subtitle: String(item?.subtitle || item?.description || ''),
      description: item?.description || '',
      duration: String(item?.duration || ''),
      price: String(item?.price || (Number.isFinite(Number(item?.priceMin)) ? `$${Number(item.priceMin)}` : '')),
      priceMin: Number.isFinite(Number(item?.priceMin)) ? Number(item.priceMin) : null,
      priceCurrency: item?.priceCurrency || null,
      priceBasis: item?.priceBasis || null,
      rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : 0,
      badge: item?.badge === 'Popular' ? 'Popular' : 'Latest',
      imageUrl: resolveMediaUrl(item?.imageUrl),
      responseTimeMinutes: Number.isFinite(Number(item?.responseTimeMinutes)) ? Number(item.responseTimeMinutes) : 45,
      highlights: Array.isArray(item?.highlights) ? item.highlights : [],
      itinerary: Array.isArray(item?.itinerary)
        ? item.itinerary
            .map((entry: any, itineraryIndex: number): HomeTourItineraryItem => ({
              day: Number.isFinite(Number(entry?.day || entry?.order))
                ? Number(entry.day || entry.order)
                : itineraryIndex + 1,
              title: String(
                typeof entry === 'string'
                  ? entry
                  : entry?.title || entry?.name || entry?.description || ''
              ).trim(),
              description:
                typeof entry === 'object' && entry?.description && entry.description !== entry?.title
                  ? String(entry.description)
                  : null,
            }))
            .filter((entry: HomeTourItineraryItem) => entry.title)
        : [],
      departureCity: item?.departureCity || null,
      destinationCountry: item?.destinationCountry || null,
      tourGroup: item?.tourGroup || null,
      nights: Number.isFinite(Number(item?.nights)) ? Number(item.nights) : null,
      hotelIncluded: Boolean(item?.hotelIncluded),
      hotelName: item?.hotelName || null,
      hotelCategory: item?.hotelCategory || null,
      hotelLocation: item?.hotelLocation || null,
      roomType: item?.roomType || null,
      mealPlan: item?.mealPlan || null,
      mealPlanLabel: item?.mealPlanLabel || null,
      childPolicy: item?.childPolicy || null,
      flightSeatStatus: item?.flightSeatStatus || null,
      availabilityStatus: item?.availabilityStatus || null,
      instantConfirmation: Boolean(item?.instantConfirmation),
      stopSale: Boolean(item?.stopSale),
      promo: Boolean(item?.promo),
      priceIncludes: Array.isArray(item?.priceIncludes) ? item.priceIncludes.filter(Boolean) : [],
      priceExcludes: Array.isArray(item?.priceExcludes) ? item.priceExcludes.filter(Boolean) : [],
      source: item?.source || '',
      sourceUrl: item?.sourceUrl || null,
      lastVerifiedAt: item?.lastVerifiedAt || null,
      confidenceScore: Number.isFinite(Number(item?.confidenceScore)) ? Number(item.confidenceScore) : null,
      agency: item?.agency || null,
    }))
    .filter((item) => item.id && item.title);
}

export function serializeTourParam(item: HomeTourItem) {
  const normalized = normalizeTours([item])[0] || item;
  return encodeURIComponent(JSON.stringify(normalized));
}

export function normalizeAgencies(items: unknown[]) {
  return (Array.isArray(items) ? items : [])
    .map((item: any, index: number): HomeAgencyItem => ({
      id: String(item?.id || item?.slug || `agency-${index}`),
      slug: item?.slug || null,
      name: String(item?.name || 'Nomsiz agentlik'),
      city: String(item?.city || 'Global'),
      description: item?.description || '',
      specialty: String(item?.specialty || ''),
      rating: Number.isFinite(Number(item?.rating)) ? Number(item.rating) : 0,
      reviews: Number.isFinite(Number(item?.reviews)) ? Number(item.reviews) : 0,
      tours: Number.isFinite(Number(item?.tours)) ? Number(item.tours) : 0,
      phone: item?.phone || null,
      website: item?.website || null,
      imageUrl: item?.imageUrl || null,
      source: item?.source || '',
      sourceUrl: item?.sourceUrl || null,
      lastVerifiedAt: item?.lastVerifiedAt || null,
      confidenceScore: Number.isFinite(Number(item?.confidenceScore)) ? Number(item.confidenceScore) : null,
    }))
    .filter((item) => item.id && item.name);
}

export function normalizeHeroSlides(items: unknown[]) {
  return (Array.isArray(items) ? items : [])
    .map((item: any, index: number): HomeHeroSlide => ({
      id: String(item?.id || `hero-${index}`),
      title: String(item?.title || 'TravelorAI'),
      subtitle: String(item?.subtitle || ''),
      imageUrl: typeof item?.imageUrl === 'string' && item.imageUrl.trim() ? item.imageUrl.trim() : null,
      placeSlug: item?.placeSlug || null,
    }))
    .filter((item) => item.id && item.imageUrl);
}

export function buildPlaceParams(item: PopularPlaceItem) {
  return {
    slug: item.slug || item.id,
    id: item.id,
    name: item.name,
    city: item.city,
    type: item.type,
    subtype: item.subtype || '',
    lat: item.lat != null ? String(item.lat) : '',
    lng: item.lng != null ? String(item.lng) : '',
    info: item.info || '',
    description: item.description || item.info || '',
    imageUrl: item.imageUrl || '',
    gallery: JSON.stringify(item.gallery || []),
    rating: item.rating != null ? String(item.rating) : '',
    ratingCount: item.ratingCount != null ? String(item.ratingCount) : '',
    phone: item.phone || '',
    website: item.website || '',
    openingHours: JSON.stringify(item.openingHours || []),
    source: item.source || 'backend_home_api',
    sourceUrl: item.sourceUrl || '',
    lastVerifiedAt: item.lastVerifiedAt || '',
    confidenceScore: item.confidenceScore != null ? String(item.confidenceScore) : '',
    icon: item.icon || 'pin',
  };
}

export function getPlaceTypeLabel(type: string) {
  if (type === 'restaurant') return 'Restoran';
  if (type === 'hotel') return 'Mehmonxona';
  if (type === 'transport') return 'Transport';
  return 'Landmark';
}
