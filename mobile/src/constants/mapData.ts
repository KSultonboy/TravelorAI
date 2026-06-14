export type POIType = 'transport' | 'landmark' | 'restaurant' | 'hotel';
export type POISubtype =
  | 'historical'
  | 'mosque'
  | 'other'
  | 'train'
  | 'airport'
  | 'bus'
  | 'metro'
  | 'taxi'
  | 'traditional'
  | 'cafe'
  | 'budget'
  | 'mid'
  | 'luxury';

export interface MapPoint {
  id: string;
  name: string;
  city: string;
  slug: string;
  type: POIType;
  subtype?: POISubtype;
  lat: number;
  lng: number;
  info: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: number;
  priceLevel?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string[] | null;
  gallery?: string[];
  icon: string;
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore?: number | null;
  distanceKm?: number | null;
}

export const CATEGORY_META: Record<POIType, { label: string; icon: string; color: string; markerColor: string }> = {
  transport: { label: 'Transport', icon: 'bus-outline', color: '#3E9670', markerColor: '#3E9670' },
  landmark: { label: 'Yodgorliklar', icon: 'location-outline', color: '#5FC08A', markerColor: '#5FC08A' },
  restaurant: { label: 'Restoranlar', icon: 'restaurant-outline', color: '#EF6B6B', markerColor: '#EF6B6B' },
  hotel: { label: 'Mehmonxona', icon: 'bed-outline', color: '#E0A95A', markerColor: '#E0A95A' },
};

export interface SubCategoryMeta {
  key: POISubtype;
  label: string;
  icon: string;
  color: string;
}

export const SUB_CATEGORIES: Partial<Record<POIType, SubCategoryMeta[]>> = {
  landmark: [
    { key: 'historical', label: 'Tarixiy', icon: 'business-outline', color: '#5FC08A' },
    { key: 'mosque', label: 'Masjidlar', icon: 'moon-outline', color: '#7C3AED' },
    { key: 'other', label: 'Boshqa joylar', icon: 'pin-outline', color: '#8EB69B' },
  ],
  transport: [
    { key: 'train', label: 'Vokzal', icon: 'train-outline', color: '#2563EB' },
    { key: 'airport', label: 'Aeroport', icon: 'airplane-outline', color: '#0EA5E9' },
    { key: 'bus', label: 'Avtobus', icon: 'bus-outline', color: '#F59E0B' },
    { key: 'metro', label: 'Metro', icon: 'subway-outline', color: '#8B5CF6' },
    { key: 'taxi', label: 'Taxi', icon: 'car-outline', color: '#EAB308' },
  ],
};

// No bundled POI data. Source of truth is backend/Yandex.
export const MAP_POINTS: MapPoint[] = [];
