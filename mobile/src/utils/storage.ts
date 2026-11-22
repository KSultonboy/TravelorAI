import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  HAS_ONBOARDED: 'travelorai_has_onboarded',
  TOKEN: 'travelorai_token',
  USER: 'travelorai_user',
  THEME_PREFERENCE: 'travelorai_theme_preference',
  WISHLIST: 'travelorai_wishlist',
  LANGUAGE: 'travelorai_language',
  NOTIFICATIONS_ENABLED: 'travelorai_notif_enabled',
} as const;

/**
 * Keys written by older app versions (AI planner, maps, offline mode).
 * Nothing reads them any more; they are removed once on startup.
 */
export const LEGACY_KEYS = [
  'travelorai_trips',
  'travelorai_current_plan',
  'travelorai_preferences',
  'travelorai_achievements',
  'travelorai_poi_cache',
  'travelorai_poi_cache_v3',
  'travelorai_home_places_cache_v2',
  'travelorai_home_cache_v2',
  'travelorai_home_stats_cache_v1',
  'travelorai_destinations_cache_v1',
  'travelorai_planner_cities_cache_v1',
  'travelorai_explore_radius',
  'travelorai_trip_sync_queue',
  'travelorai_trip_reviews',
  'travelorai_offline_mode',
] as const;

// ── Auth session change notifications ─────────────────────────────────────────
// AuthProvider subscribes so that every writer (login, register, Google,
// profile edit, logout, 401 handler) keeps the in-memory session in sync.
type AuthSessionListener = () => void;
const authSessionListeners = new Set<AuthSessionListener>();

export function subscribeAuthSession(listener: AuthSessionListener): () => void {
  authSessionListeners.add(listener);
  return () => {
    authSessionListeners.delete(listener);
  };
}

function notifyAuthSession() {
  authSessionListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // listeners must never break storage writes
    }
  });
}

export async function saveItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function saveAuthSession(token: string, user: unknown): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.TOKEN, token],
    [KEYS.USER, JSON.stringify(user)],
  ]);
  notifyAuthSession();
}

export async function saveUserProfile(user: unknown): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  notifyAuthSession();
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const val = await AsyncStorage.getItem(key);
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.USER]);
  notifyAuthSession();
}

export async function removeLegacyKeys(): Promise<void> {
  await AsyncStorage.multiRemove([...LEGACY_KEYS]);
}

/** Returns a storage key scoped to a specific user, e.g. travelorai_wishlist_u_abc123 */
export function getUserKey(userId: string, baseKey: string): string {
  return `${baseKey}_u_${userId}`;
}

export async function clearAll(): Promise<void> {
  const themePreference = await AsyncStorage.getItem(KEYS.THEME_PREFERENCE);
  await AsyncStorage.clear();
  if (themePreference) {
    await AsyncStorage.setItem(KEYS.THEME_PREFERENCE, themePreference);
  }
  notifyAuthSession();
}
