import { resolveMediaUrl } from './api';

export type HomeTourBadge = 'Latest' | 'Popular';

export type HomeTourItineraryItem = {
  day: number;
  title: string;
  description?: string | null;
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
