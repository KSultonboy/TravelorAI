import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  HAS_ONBOARDED: 'travelorai_has_onboarded',
  TOKEN: 'travelorai_token',
  USER: 'travelorai_user',
  TRIPS: 'travelorai_trips',
  CURRENT_PLAN: 'travelorai_current_plan',
  TRAVELORAI_PREFERENCES: 'travelorai_preferences',
  ACHIEVEMENTS: 'travelorai_achievements',
  POI_CACHE: 'travelorai_poi_cache',
  POI_CACHE_V2: 'travelorai_poi_cache_v3',
  HOME_PLACES_CACHE_V2: 'travelorai_home_places_cache_v2',
  HOME_CACHE_V2: 'travelorai_home_cache_v2',
  HOME_STATS_CACHE: 'travelorai_home_stats_cache_v1',
  DESTINATIONS_CACHE_V1: 'travelorai_destinations_cache_v1',
  PLANNER_CITIES_CACHE_V1: 'travelorai_planner_cities_cache_v1',
  THEME_PREFERENCE: 'travelorai_theme_preference',
  EXPLORE_RADIUS: 'travelorai_explore_radius',
  WISHLIST: 'travelorai_wishlist',
  TRIP_SYNC_QUEUE: 'travelorai_trip_sync_queue',
  TRIP_REVIEWS: 'travelorai_trip_reviews',
  LANGUAGE: 'travelorai_language',
  NOTIFICATIONS_ENABLED: 'travelorai_notif_enabled',
  OFFLINE_MODE: 'travelorai_offline_mode',
} as const;

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
}

export async function saveUserProfile(user: unknown): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
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
}

/** Returns a storage key scoped to a specific user, e.g. travelorai_trips_u_abc123 */
export function getUserKey(userId: string, baseKey: string): string {
  return `${baseKey}_u_${userId}`;
}

export async function clearAll(): Promise<void> {
  const themePreference = await AsyncStorage.getItem(KEYS.THEME_PREFERENCE);
  await AsyncStorage.clear();
  if (themePreference) {
    await AsyncStorage.setItem(KEYS.THEME_PREFERENCE, themePreference);
  }
}
