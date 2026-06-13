import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getItem, KEYS } from './storage';

const DEV_API_PORT = process.env.EXPO_PUBLIC_API_PORT || '4000';
const FALLBACK_LOCAL_API_URL =
  Platform.OS === 'android' ? `http://10.0.2.2:${DEV_API_PORT}/api/v1` : `http://localhost:${DEV_API_PORT}/api/v1`;

function normalizeUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function detectMetroHost(): string | undefined {
  const expoHostUri = (Constants.expoConfig as { hostUri?: string } | null | undefined)?.hostUri;
  const manifest2Host = (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost as string | undefined;
  const manifestHost = (Constants as any)?.manifest?.debuggerHost as string | undefined;
  const hostUri = expoHostUri || manifest2Host || manifestHost;

  if (!hostUri || typeof hostUri !== 'string') {
    return undefined;
  }

  const host = hostUri.split(':')[0]?.trim();
  return host || undefined;
}

const ENV_API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
const DETECTED_METRO_HOST = detectMetroHost();
const DETECTED_API_URL = DETECTED_METRO_HOST ? `http://${DETECTED_METRO_HOST}:${DEV_API_PORT}/api/v1` : undefined;
const API_URL = ENV_API_URL || DETECTED_API_URL || FALLBACK_LOCAL_API_URL;

export function resolveMediaUrl(value?: string | null): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^(https?:|data:|file:)/i.test(text)) return text;
  const origin = API_URL.replace(/\/api\/v1\/?$/i, '');
  return `${origin}${text.startsWith('/') ? text : `/${text}`}`;
}

const RETRY_BASE_URLS = Array.from(
  new Set([DETECTED_API_URL, FALLBACK_LOCAL_API_URL].filter((item): item is string => Boolean(item)))
).filter((url) => url !== API_URL);

const NETWORK_HINT = `Serverga ulanib bo'lmadi. Backend ishlayotganini tekshiring (${API_URL}).`;

export interface ApiErrorPayload {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status?: number;
  data?: ApiErrorPayload;

  constructor(message: string, status?: number, data?: ApiErrorPayload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await getItem(KEYS.TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const originalConfig = err.config as any;
    const retryIndex = Number(originalConfig?.__retryBaseIndex || 0);
    const canRetry =
      !err.response &&
      originalConfig &&
      !originalConfig?.skipBaseRetry &&
      retryIndex < RETRY_BASE_URLS.length;

    if (canRetry) {
      originalConfig.__retryBaseIndex = retryIndex + 1;
      originalConfig.baseURL = RETRY_BASE_URLS[retryIndex];
      try {
        return await api.request(originalConfig);
      } catch {
        // continue to normalized error below
      }
    }

    const data = err.response?.data as ApiErrorPayload | undefined;
    const isNetworkError = !err.response;
    const msg = isNetworkError ? NETWORK_HINT : data?.message || err.message || 'Tarmoq xatosi';
    return Promise.reject(new ApiError(msg, err.response?.status, data));
  }
);

export default api;

export interface TravelPreferencesPayload {
  style: 'budget' | 'mid' | 'luxury';
  interests: string[];
  updatedAt: string | null;
}

export interface WishlistPayload {
  id: string;
  poiId?: string | null;
  name: string;
  city: string;
  slug: string;
  type: string;
  icon: string;
  savedAt: string;
}

export interface PoiPayload {
  id: string;
  name: string;
  city: string;
  slug: string;
  type: string;
  subtype?: string | null;
  lat: number;
  lng: number;
  info: string;
  description?: string | null;
  imageUrl?: string | null;
  priceLevel?: number | null;
  price?: number | null;
  icon: string;
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
  verifiedBy?: string | null;
  duplicateGroupId?: string | null;
  priceUpdatedAt?: string | null;
}

export interface CityCoveragePayload {
  city: string;
  destinationCount: number;
  poiCount: number;
  transportRouteCount: number;
  avgConfidence?: number | null;
  coverageLevel: 'missing' | 'starter' | 'usable' | 'strong';
  offlinePack?: {
    version: number;
    offlineReady: boolean;
    poiCount: number;
    destinationCount: number;
    transportRouteCount: number;
    emergencyContacts?: Record<string, string>;
    transportNotes?: Record<string, string>;
    sourceSummary?: Record<string, unknown>;
    updatedAt?: string;
  } | null;
}

export interface TransportRoutePayload {
  id: string;
  fromCity: string;
  toCity: string;
  mode: string;
  provider?: { id: string; name: string; type: string; website?: string | null } | null;
  priceMin: number;
  priceMax: number;
  durationMinutes: number;
  distanceKm?: number | null;
  scheduleNote: string;
  bookingUrl?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore: number;
  whyRecommended?: string | null;
}

export interface YandexPlacePointPayload extends PoiPayload {
  source?: string | null;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  confidenceScore?: number | null;
  distanceKm?: number | null;
}

export type YandexTransportPointPayload = YandexPlacePointPayload;

export interface PaginatedPayload<T> {
  items: T[];
  total: number;
  page: number;
  limit?: number;
}

export interface AchievementStatsPayload {
  tripCount: number;
  uniqueCities: number;
  totalSpent: number;
  budgetTrips: number;
  maxDuration: number;
  maxTravelers: number;
}

export interface AchievementItemPayload {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: string;
  accent: string;
  metric: string;
  target: number;
  current: number;
  unlocked: boolean;
  progress: number;
  progressText: string;
}

export interface AchievementsPayload {
  items: AchievementItemPayload[];
  unlocked: AchievementItemPayload[];
  locked: AchievementItemPayload[];
  unlockedCount: number;
  totalCount: number;
  completionRate: number;
  nextAchievement: AchievementItemPayload | null;
  stats: AchievementStatsPayload;
}

export interface DeleteAccountPayload {
  confirm: true;
  code: string;
}

export interface SecurityCodePayload {
  message: string;
  email?: string;
  currentEmail?: string;
  pendingEmail?: string;
  attemptsRemaining: number;
  delivery?: string;
  devCode?: string;
}

export interface FeedbackPayload {
  category: 'suggestion' | 'complaint' | 'bug' | 'feature' | 'other';
  subject?: string;
  message: string;
  contactEmail?: string;
  platform?: string;
  appVersion?: string;
}

export interface TripReviewPayload {
  rating: number;
  comment: string;
}

export interface TripReviewItemPayload {
  id: string;
  tripId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
  trip?: {
    id: string;
    title: string;
    createdAt?: string;
  };
}

export interface TourBookingPayload {
  tourId?: string;
  tourSlug?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  travelers?: number;
  travelDate?: string;
  message?: string;
  source?: string;
}

export interface TourBookingItemPayload {
  id: string;
  tourId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  travelers: number;
  travelDate?: string | null;
  message?: string | null;
  status: string;
  totalEstimate?: number | null;
  currency: string;
  createdAt?: string;
  responseDeadlineAt?: string | null;
  tour?: {
    id: string;
    slug?: string | null;
    title: string;
    city: string;
    duration?: string | null;
    price?: string | null;
    priceMin?: number | null;
    imageUrl?: string | null;
    responseTimeMinutes?: number | null;
  } | null;
  agency?: {
    id: string;
    name: string;
    city?: string | null;
    phone?: string | null;
    website?: string | null;
  } | null;
}

export const destinationsAPI = {
  getAll: (params?: Record<string, unknown>) => api.get('/destinations', { params }),
  getById: (id: string) => api.get(`/destinations/${id}`),
};

export const citiesAPI = {
  getAll: () => api.get('/cities'),
};

export const transportAPI = {
  getRoutes: (params?: Record<string, unknown>) => api.get('/transport/routes', { params }),
  getYandexNearby: (params: { lat: number; lng: number; radiusKm?: number; radius?: number; type?: string; limit?: number }) =>
    api.get('/transport/yandex/nearby', { params, timeout: 12000 }),
};

export const yandexAPI = {
  getPlacesNearby: (params: { lat: number; lng: number; radiusKm?: number; radius?: number; type?: string; subtype?: string; limit?: number }) =>
    api.get('/yandex/places/nearby', { params, timeout: 12000 }),
  searchPlaces: (params: { query: string; lat?: number; lng?: number; radiusKm?: number; radius?: number; type?: string }) =>
    api.get('/yandex/places/search', { params, timeout: 12000 }),
  suggest: (params: { query: string; lat?: number; lng?: number; results?: number }) =>
    api.get('/yandex/suggest', { params, timeout: 12000 }),
  geocode: (params: { query: string; results?: number }) =>
    api.get('/yandex/geocode', { params, timeout: 12000 }),
  reverse: (params: { lat: number; lng: number; results?: number }) =>
    api.get('/yandex/reverse', { params, timeout: 12000 }),
};

export const homeAPI = {
  getHome: (params?: { limit?: number }) => api.get('/home', { params, timeout: 18000 }),
  getHeroSlides: (params?: { limit?: number }) => api.get('/home/hero-slides', { params, timeout: 12000 }),
  getPlaces: (params?: { type?: string; limit?: number }) => api.get('/home/places', { params, timeout: 18000 }),
  getTours: (params?: {
    badge?: string;
    filter?: string;
    limit?: number;
    page?: number;
    q?: string;
    search?: string;
    agencyOnly?: boolean;
  }) => api.get('/home/tours', { params, timeout: 12000 }),
  getAgencies: (params?: { sort?: string; limit?: number }) => api.get('/home/agencies', { params, timeout: 12000 }),
};

export const bookingsAPI = {
  create: (body: TourBookingPayload) => api.post('/bookings', body),
  getMine: (params?: { email?: string }) => api.get('/bookings/mine', { params }),
};

export const plannerAPI = {
  generate: (body: unknown) => {
    const config: any = { timeout: 60000 };
    config.skipBaseRetry = true;
    return api.post('/planner/generate', body, config);
  },
};

export const tripsAPI = {
  getAll: (params?: { status?: string; q?: string; limit?: number }) => api.get('/trips', { params }),
  getById: (id: string) => api.get(`/trips/${id}`),
  save: (plan: unknown) => api.post('/trips', plan),
  update: (id: string, plan: unknown) => api.put(`/trips/${id}`, plan),
  updateProgress: (id: string, progress: unknown) => api.patch(`/trips/${id}/progress`, progress),
  duplicate: (id: string) => api.post(`/trips/${id}/duplicate`),
  archive: (id: string, archived = true) => api.patch(`/trips/${id}/archive`, { archived }),
  delete: (id: string) => api.delete(`/trips/${id}`),
  getReviews: () => api.get('/trips/reviews'),
  saveReview: (id: string, body: TripReviewPayload) => api.post(`/trips/${id}/reviews`, body),
};

export const authAPI = {
  register: (body: unknown) => api.post('/auth/register', body),
  verifyEmail: (body: unknown) => api.post('/auth/verify-email', body),
  resendVerification: (body: unknown) => api.post('/auth/resend-verification', body),
  login: (body: unknown) => api.post('/auth/login', body),
  forgotPassword: (body: unknown) => api.post('/auth/forgot-password', body),
  resetPassword: (body: unknown) => api.post('/auth/reset-password', body),
  google: (body: unknown) => api.post('/auth/google', body),
  me: () => api.get('/auth/me'),
  savePushToken: (token: string) => api.post('/auth/push-token', { token }),
  getPreferences: () => api.get('/auth/preferences'),
  updatePreferences: (body: { style: 'budget' | 'mid' | 'luxury'; interests: string[] }) => api.put('/auth/preferences', body),
  updateProfile: (body: unknown) => api.put('/auth/profile', body),
  requestEmailChange: (body: { newEmail: string; password?: string }) => api.post('/auth/email-change/request', body),
  verifyEmailChange: (body: { code: string }) => api.post('/auth/email-change/verify', body),
  requestAccountDeletion: (body: { password?: string }) => api.post('/auth/account-deletion/request', body),
  deleteAccount: (body: DeleteAccountPayload) => api.delete('/auth/account', { data: body }),
};

export const wishlistAPI = {
  getAll: () => api.get('/wishlist'),
  add: (body: { poiId?: string | null; name: string; city: string; slug: string; type: string; icon: string }) => api.post('/wishlist', body),
  remove: (id: string) => api.delete(`/wishlist/${id}`),
};

export const poiAPI = {
  getAll: (params?: Record<string, unknown>, timeoutMs = 12000) => {
    const config: any = { params, timeout: timeoutMs };
    config.skipBaseRetry = true;
    return api.get('/poi', config);
  },
  getById: (id: string) => api.get(`/poi/${id}`),
};

export const achievementsAPI = {
  getMy: () => api.get('/achievements'),
};

export const feedbackAPI = {
  submit: (body: FeedbackPayload) => api.post('/feedback', body),
};
