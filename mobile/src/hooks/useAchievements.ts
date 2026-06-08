import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { achievementsAPI, type AchievementsPayload } from '../utils/api';
import { extractApiData } from '../utils/auth';
import { type AchievementsState, getAchievements } from '../utils/achievements';
import { getItem, getJSON, getUserKey, KEYS, saveJSON } from '../utils/storage';
import type { TripPlan } from '../utils/tripPlanner';

function isAchievementsPayload(value: unknown): value is AchievementsPayload {
  return typeof value === 'object' && value !== null && Array.isArray((value as AchievementsPayload).items);
}

export function useAchievements(trips: TripPlan[], userId: string | null = null) {
  const localState = useMemo(() => getAchievements(trips), [trips]);
  const [achievements, setAchievements] = useState<AchievementsState>(localState);
  const [loading, setLoading] = useState(false);
  const cacheKey = userId ? getUserKey(userId, KEYS.ACHIEVEMENTS) : KEYS.ACHIEVEMENTS;
  const localStateRef = useRef(localState);

  useEffect(() => {
    localStateRef.current = localState;
    setAchievements(localState);
  }, [localState]);

  const loadAchievements = useCallback(async () => {
    const localFallback = localStateRef.current;
    const [token, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);
    const cached = await getJSON<AchievementsState>(cacheKey);
    if (cached) {
      setAchievements(cached);
    } else {
      setAchievements(localFallback);
    }

    if (!token || offlineMode === 'true') {
      return;
    }

    setLoading(true);
    try {
      const response = extractApiData<any>(await achievementsAPI.getMy());
      const payload = response?.items ? response : response?.state;
      if (!isAchievementsPayload(payload)) {
        throw new Error('INVALID_ACHIEVEMENTS_PAYLOAD');
      }

      const remote = payload as AchievementsState;
      setAchievements(remote);
      await saveJSON(cacheKey, remote);
    } catch {
      setAchievements((cached as AchievementsState) || localStateRef.current);
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  return { achievements, loading, loadAchievements };
}
