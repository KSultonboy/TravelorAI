import { useCallback, useRef, useState } from 'react';

import { extractApiData } from '../utils/auth';
import { yandexAPI } from '../utils/api';

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  raw: YandexPredictionRaw;
}

export interface PlaceDetail {
  name: string;
  lat: number;
  lng: number;
  address: string;
  types: string[];
  rating?: number;
  placeId: string;
}

interface YandexPredictionRaw {
  id: string;
  title?: string;
  subtitle?: string;
  uri?: string | null;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  source?: string;
}

function toPrediction(item: YandexPredictionRaw): PlacePrediction {
  const title = String(item.title || item.name || 'Yandex place').trim();
  const subtitle = String(item.subtitle || item.address || '').trim();

  return {
    place_id: String(item.id || item.uri || title),
    description: [title, subtitle].filter(Boolean).join(', '),
    structured_formatting: {
      main_text: title,
      secondary_text: subtitle,
    },
    raw: item,
  };
}

function toDetail(item: YandexPredictionRaw): PlaceDetail | null {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    name: String(item.name || item.title || 'Yandex place'),
    lat,
    lng,
    address: String(item.address || item.subtitle || ''),
    types: [String(item.source || 'yandex')],
    placeId: String(item.id || item.uri || `${lat}:${lng}`),
  };
}

export function usePlaceSearch() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPlacesRef = useRef<Map<string, YandexPredictionRaw>>(new Map());

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = input.trim();
    if (query.length < 2) {
      setPredictions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = extractApiData<any>(await yandexAPI.searchPlaces({ query, radiusKm: 20 }));
        const items = Array.isArray(response?.items) ? (response.items as YandexPredictionRaw[]) : [];
        latestPlacesRef.current = new Map(items.map((item) => [String(item.id || item.uri), item]));
        setPredictions(items.map(toPrediction));
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const getDetails = useCallback(async (placeId: string): Promise<PlaceDetail | null> => {
    setDetailLoading(true);
    try {
      const cached = latestPlacesRef.current.get(placeId);
      return cached ? toDetail(cached) : null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPredictions([]);
    latestPlacesRef.current.clear();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { predictions, loading, detailLoading, search, getDetails, clear };
}
