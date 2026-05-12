import { authAPI } from './api';
import { extractApiData } from './auth';
import { getItem, getJSON, getUserKey, KEYS, saveJSON } from './storage';

export const TRAVEL_STYLE_OPTIONS = [
  { key: 'budget', icon: 'wallet-outline', label: 'Tejamkor', desc: 'Eng arzon va oqilona variant' },
  { key: 'mid', icon: 'compass-outline', label: "O'rtacha", desc: 'Qulay balans va yaxshi tajriba' },
  { key: 'luxury', icon: 'diamond-outline', label: 'Premium', desc: 'Yuqori darajadagi qulaylik' },
] as const;

export const INTEREST_OPTIONS = [
  { key: 'tarixiy', label: 'Tarixiy' },
  { key: 'madaniy', label: 'Madaniy' },
  { key: 'tabiat', label: 'Tabiat' },
  { key: 'gastronomy', label: 'Gastronomiya' },
  { key: 'arxitektura', label: 'Arxitektura' },
  { key: 'din', label: 'Din' },
  { key: 'zamonaviy', label: 'Zamonaviy' },
  { key: 'hunarmandchilik', label: 'Hunarmandchilik' },
] as const;

export type TravelStyle = (typeof TRAVEL_STYLE_OPTIONS)[number]['key'];
export type TravelInterest = (typeof INTEREST_OPTIONS)[number]['key'];

export interface TravelPreferences {
  style: TravelStyle;
  interests: TravelInterest[];
  updatedAt: string | null;
}

export const DEFAULT_TRAVEL_PREFERENCES: TravelPreferences = {
  style: 'mid',
  interests: ['tarixiy', 'madaniy'],
  updatedAt: null,
};

const STYLE_KEYS = new Set<TravelStyle>(TRAVEL_STYLE_OPTIONS.map((option) => option.key));
const INTEREST_KEYS = new Set<TravelInterest>(INTEREST_OPTIONS.map((option) => option.key));

export function normalizeTravelPreferences(value?: Partial<TravelPreferences> | null): TravelPreferences {
  const style = value?.style && STYLE_KEYS.has(value.style) ? value.style : DEFAULT_TRAVEL_PREFERENCES.style;
  const interests = Array.from(
    new Set(
      (value?.interests ?? DEFAULT_TRAVEL_PREFERENCES.interests).filter(
        (interest): interest is TravelInterest => INTEREST_KEYS.has(interest as TravelInterest)
      )
    )
  );

  return {
    style,
    interests: interests.length > 0 ? interests : [...DEFAULT_TRAVEL_PREFERENCES.interests],
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : null,
  };
}

export async function loadTravelPreferences(userId?: string | null): Promise<TravelPreferences> {
  const key = userId ? getUserKey(userId, KEYS.TRAVELORAI_PREFERENCES) : KEYS.TRAVELORAI_PREFERENCES;
  const stored = normalizeTravelPreferences(await getJSON<TravelPreferences>(key));
  const [token, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);

  if (!token || offlineMode === 'true') {
    return stored;
  }

  try {
    const response = extractApiData<any>(await authAPI.getPreferences());
    const remote = normalizeTravelPreferences(response?.preferences ?? response);
    await saveJSON(key, remote);
    return remote;
  } catch {
    return stored;
  }
}

export async function saveTravelPreferences(value: Partial<TravelPreferences>, userId?: string | null): Promise<TravelPreferences> {
  const key = userId ? getUserKey(userId, KEYS.TRAVELORAI_PREFERENCES) : KEYS.TRAVELORAI_PREFERENCES;
  const next = {
    ...normalizeTravelPreferences(value),
    updatedAt: new Date().toISOString(),
  };

  await saveJSON(key, next);
  const [token, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);
  if (!token || offlineMode === 'true') {
    return next;
  }

  try {
    const response = extractApiData<any>(
      await authAPI.updatePreferences({
        style: next.style,
        interests: next.interests,
      })
    );
    const remote = normalizeTravelPreferences(response?.preferences ?? response);
    await saveJSON(key, remote);
    return remote;
  } catch {
    return next;
  }
}

export function getTravelStyleLabel(style: TravelStyle): string {
  return TRAVEL_STYLE_OPTIONS.find((option) => option.key === style)?.label || DEFAULT_TRAVEL_PREFERENCES.style;
}

export function getInterestLabel(interest: string): string {
  return INTEREST_OPTIONS.find((option) => option.key === interest)?.label || interest;
}

export function getTravelPreferencesSummary(preferences: TravelPreferences): string {
  const interestLabels = preferences.interests.slice(0, 3).map(getInterestLabel);
  const interestsText =
    preferences.interests.length > 3 ? `${interestLabels.join(', ')} +${preferences.interests.length - 3}` : interestLabels.join(', ');

  return `${getTravelStyleLabel(preferences.style)} | ${interestsText}`;
}
