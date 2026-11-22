import axios, { type AxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getItem, KEYS } from './storage';

/** Hard-coded production backend. Release builds never talk to anything else over http. */
export const PRODUCTION_API_URL = 'https://travelorai.com/api/v1';

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

// EXPO_PUBLIC_* values are inlined at bundle time.
const ENV_API_URL = normalizeUrl(process.env.EXPO_PUBLIC_API_URL);

// ── Dev-only local backend discovery ──────────────────────────────────────────
// Everything below is gated by __DEV__, which Metro replaces with `false` in
// release/OTA bundles, so the LAN/emulator URLs and the retry failover are
// dropped from production JS entirely.
const DEV_API_PORT = __DEV__ ? process.env.EXPO_PUBLIC_API_PORT || '4000' : '';
const DEV_FALLBACK_API_URL = __DEV__
  ? Platform.OS === 'android'
    ? `http://10.0.2.2:${DEV_API_PORT}/api/v1`
    : `http://localhost:${DEV_API_PORT}/api/v1`
  : undefined;
const DEV_DETECTED_HOST = __DEV__ ? detectMetroHost() : undefined;
const DEV_DETECTED_API_URL = __DEV__ && DEV_DETECTED_HOST
  ? `http://${DEV_DETECTED_HOST}:${DEV_API_PORT}/api/v1`
  : undefined;

function resolveReleaseApiUrl(): string {
  // Release: only an https EXPO_PUBLIC_API_URL is accepted; otherwise production.
  return ENV_API_URL && /^https:\/\//i.test(ENV_API_URL) ? ENV_API_URL : PRODUCTION_API_URL;
}

export const API_URL: string = __DEV__
  ? ENV_API_URL || DEV_DETECTED_API_URL || DEV_FALLBACK_API_URL || PRODUCTION_API_URL
  : resolveReleaseApiUrl();

const RETRY_BASE_URLS: string[] = __DEV__
  ? Array.from(
      new Set([DEV_DETECTED_API_URL, DEV_FALLBACK_API_URL].filter((item): item is string => Boolean(item)))
    ).filter((url) => url !== API_URL)
  : [];

const NETWORK_HINT = __DEV__
  ? `Serverga ulanib bo'lmadi. Backend ishlayotganini tekshiring (${API_URL}).`
  : "Serverga ulanib bo'lmadi. Internet aloqasini tekshirib, qayta urinib ko'ring.";

export function resolveMediaUrl(value?: string | null): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  if (/^(https?:|data:|file:)/i.test(text)) return text;
  const origin = API_URL.replace(/\/api\/v1\/?$/i, '');
  return `${origin}${text.startsWith('/') ? text : `/${text}`}`;
}

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

// ── Central 401 handling ──────────────────────────────────────────────────────
// A 401 on an authenticated request means the stored JWT is expired/invalid.
// These endpoints legitimately answer 401 for wrong credentials/passwords and
// must NOT end the session.
const AUTH_401_EXEMPT_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google',
  '/auth/email-change/request',
  '/auth/email-change/verify',
  '/auth/account-deletion/request',
  '/auth/account',
];

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

function isExemptFrom401(url?: string): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return AUTH_401_EXEMPT_PATHS.some((exempt) => path === exempt || path.endsWith(exempt));
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
    const originalConfig = err.config as (AxiosRequestConfig & { __retryBaseIndex?: number }) | undefined;

    if (__DEV__) {
      const retryIndex = Number(originalConfig?.__retryBaseIndex || 0);
      const canRetry = !err.response && originalConfig && retryIndex < RETRY_BASE_URLS.length;

      if (canRetry && originalConfig) {
        originalConfig.__retryBaseIndex = retryIndex + 1;
        originalConfig.baseURL = RETRY_BASE_URLS[retryIndex];
        try {
          return await api.request(originalConfig);
        } catch {
          // continue to normalized error below
        }
      }
    }

    const status: number | undefined = err.response?.status;
    const data = err.response?.data as ApiErrorPayload | undefined;
    const headers = (originalConfig?.headers || {}) as Record<string, unknown>;
    const wasAuthenticated = Boolean(headers.Authorization || headers.authorization);
    // `requiresReauth` = valid session that must re-authenticate for a sensitive
    // action (e.g. Google-only email change); it is not an expired token.
    if (
      status === 401 &&
      wasAuthenticated &&
      !data?.requiresReauth &&
      !isExemptFrom401(originalConfig?.url)
    ) {
      try {
        unauthorizedHandler?.();
      } catch {
        // never mask the original error
      }
    }

    const isNetworkError = !err.response;
    // 429 (auth rate limit) and 4xx carry a user-facing server message; 5xx is
    // a generic message plus a requestId that support can look up.
    let msg = isNetworkError ? NETWORK_HINT : data?.message || err.message || 'Tarmoq xatosi';
    const requestId = typeof data?.requestId === 'string' ? data.requestId : undefined;
    if (!isNetworkError && status && status >= 500 && requestId) {
      msg = `${msg}\n(ID: ${requestId})`;
    }
    return Promise.reject(new ApiError(msg, status, data));
  }
);

export default api;

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
  /** Only returned by a development backend; shown in __DEV__ builds only. */
  devCode?: string;
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

export const homeAPI = {
  getTours: (params?: {
    badge?: string;
    filter?: string;
    limit?: number;
    page?: number;
    q?: string;
    search?: string;
    agencyOnly?: boolean;
  }) => api.get('/home/tours', { params, timeout: 12000 }),
  /**
   * Single tour by id or slug. The backend may not expose this yet; callers
   * must fall back to scanning getTours() (see utils/tourCache.ts).
   */
  getTour: (idOrSlug: string) => api.get(`/home/tours/${encodeURIComponent(idOrSlug)}`, { timeout: 12000 }),
};

export const bookingsAPI = {
  create: (body: TourBookingPayload) => api.post('/bookings', body),
  getMine: () => api.get('/bookings/mine'),
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
