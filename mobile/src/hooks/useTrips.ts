import { useCallback, useState } from 'react';

import { ApiError, tripsAPI } from '../utils/api';
import { KEYS, getItem, getJSON, getUserKey, saveJSON } from '../utils/storage';
import type { TripPlan, TripSyncStatus } from '../utils/tripPlanner';

type QueueOperationType = 'upsert' | 'delete';

interface TripSyncQueueItem {
  type: QueueOperationType;
  tripId: string;
  plan?: TripPlan;
  syncStatus: Extract<TripSyncStatus, 'pending' | 'failed'>;
  updatedAt: string;
}

interface PersistTripResult {
  trip: TripPlan;
  syncStatus: Extract<TripSyncStatus, 'pending' | 'synced'>;
}

function normalizeTrip(plan: any, fallbackSyncStatus: TripSyncStatus = 'synced'): TripPlan {
  const source = plan?.planData && typeof plan.planData === 'object' ? { ...plan.planData, ...plan } : plan;
  const progressSource = source?.progress || source?.planData?.progress || {};
  const updatedAt = String(source?.updatedAt || source?.planData?.updatedAt || source?.createdAt || new Date().toISOString());

  return {
    id: source?.id || '',
    title: source?.title || 'Trip',
    startDate: source?.startDate || source?.planData?.startDate,
    endDate: source?.endDate || source?.planData?.endDate,
    coverImage: source?.coverImage || source?.planData?.coverImage,
    notes: source?.notes || source?.planData?.notes,
    totalCost: Number(source?.totalCost || source?.planData?.totalCost || 0),
    duration: Number(source?.duration || source?.planData?.duration || 0),
    travelers: Number(source?.travelers || source?.planData?.travelers || 1),
    style: source?.style || source?.planData?.style || 'mid',
    destinations: Array.isArray(source?.destinations) ? source.destinations : source?.planData?.destinations || [],
    transportLegs: Array.isArray(source?.transportLegs) ? source.transportLegs : source?.planData?.transportLegs || [],
    breakdown:
      source?.breakdown ||
      source?.planData?.breakdown || {
        transport: 0,
        accommodation: 0,
        food: 0,
        attractions: 0,
        misc: 0,
      },
    days: Array.isArray(source?.days) ? source.days : source?.planData?.days || [],
    warnings: Array.isArray(source?.warnings) ? source.warnings : source?.planData?.warnings || [],
    highlights: Array.isArray(source?.highlights) ? source.highlights : source?.planData?.highlights || [],
    tips: Array.isArray(source?.tips) ? source.tips : source?.planData?.tips || [],
    dataConfidence: source?.dataConfidence || source?.planData?.dataConfidence,
    sourceSummary: source?.sourceSummary || source?.planData?.sourceSummary,
    alternatives: source?.alternatives || source?.planData?.alternatives,
    verificationWarnings: Array.isArray(source?.verificationWarnings)
      ? source.verificationWarnings
      : source?.planData?.verificationWarnings || [],
    status: source?.status || source?.planData?.status,
    source: source?.source || source?.planData?.source,
    syncStatus: source?.syncStatus || source?.planData?.syncStatus || fallbackSyncStatus,
    updatedAt,
    progress: {
      visitedStopIds: Array.isArray(progressSource?.visitedStopIds) ? progressSource.visitedStopIds : [],
      notes:
        progressSource?.notes && typeof progressSource.notes === 'object' && !Array.isArray(progressSource.notes)
          ? progressSource.notes
          : {},
      updatedAt: String(progressSource?.updatedAt || updatedAt),
    },
    createdAt: source?.createdAt || source?.planData?.createdAt || new Date().toISOString(),
  };
}

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortTrips(items: TripPlan[]): TripPlan[] {
  return [...items].sort((left, right) => {
    const rightTime = toTimestamp(right.updatedAt) || toTimestamp(right.createdAt);
    const leftTime = toTimestamp(left.updatedAt) || toTimestamp(left.createdAt);
    return rightTime - leftTime;
  });
}

function dedupeTrips(items: TripPlan[]): TripPlan[] {
  const next = new Map<string, TripPlan>();

  for (const item of items) {
    const normalized = normalizeTrip(item);
    const existing = next.get(normalized.id);
    if (!existing) {
      next.set(normalized.id, normalized);
      continue;
    }

    const normalizedTime = toTimestamp(normalized.updatedAt) || toTimestamp(normalized.createdAt);
    const existingTime = toTimestamp(existing.updatedAt) || toTimestamp(existing.createdAt);
    if (normalizedTime >= existingTime) {
      next.set(normalized.id, normalized);
    }
  }

  return Array.from(next.values());
}

function unwrapList<T>(response: any, fallback: T[] = []): T[] {
  if (Array.isArray(response?.data)) return response.data as T[];
  if (Array.isArray(response)) return response as T[];
  return fallback;
}

function unwrapObject<T>(response: any, fallback: T): T {
  if (response?.data && typeof response.data === 'object') return response.data as T;
  if (response && typeof response === 'object') return response as T;
  return fallback;
}

function normalizeQueueItem(item: any): TripSyncQueueItem | null {
  if (!item || typeof item !== 'object' || typeof item.tripId !== 'string' || !item.tripId) {
    return null;
  }

  const type: QueueOperationType = item.type === 'delete' ? 'delete' : 'upsert';
  const syncStatus: Extract<TripSyncStatus, 'pending' | 'failed'> =
    item.syncStatus === 'failed' ? 'failed' : 'pending';

  return {
    type,
    tripId: item.tripId,
    plan: item.plan ? normalizeTrip(item.plan, syncStatus) : undefined,
    syncStatus,
    updatedAt: String(item.updatedAt || item.plan?.updatedAt || new Date().toISOString()),
  };
}

function upsertQueueItem(queue: TripSyncQueueItem[], nextItem: TripSyncQueueItem): TripSyncQueueItem[] {
  return [...queue.filter((item) => item.tripId !== nextItem.tripId), nextItem].sort(
    (left, right) => toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt)
  );
}

function mergeTrips(remoteTrips: TripPlan[], localTrips: TripPlan[], queue: TripSyncQueueItem[]): TripPlan[] {
  const queueById = new Map(queue.map((item) => [item.tripId, item] as const));
  const localById = new Map(localTrips.map((item) => [item.id, normalizeTrip(item)] as const));
  const merged: TripPlan[] = [];
  const includedIds = new Set<string>();

  for (const remoteTrip of remoteTrips) {
    const queueItem = queueById.get(remoteTrip.id);
    if (queueItem?.type === 'delete') {
      continue;
    }

    if (queueItem?.type === 'upsert') {
      const localTrip = localById.get(remoteTrip.id);
      if (localTrip) {
        merged.push({ ...localTrip, syncStatus: queueItem.syncStatus });
        includedIds.add(remoteTrip.id);
        continue;
      }
    }

    merged.push({ ...normalizeTrip(remoteTrip, 'synced'), syncStatus: 'synced' });
    includedIds.add(remoteTrip.id);
  }

  for (const localTrip of localTrips) {
    if (includedIds.has(localTrip.id)) {
      continue;
    }

    const queueItem = queueById.get(localTrip.id);
    if (queueItem?.type === 'delete') {
      continue;
    }

    if (queueItem?.type === 'upsert') {
      merged.push({ ...normalizeTrip(localTrip, queueItem.syncStatus), syncStatus: queueItem.syncStatus });
      includedIds.add(localTrip.id);
      continue;
    }

    const normalizedTrip = normalizeTrip(localTrip);
    if (normalizedTrip.syncStatus === 'pending' || normalizedTrip.syncStatus === 'failed') {
      merged.push(normalizedTrip);
    }
  }

  return sortTrips(dedupeTrips(merged));
}

export function useTrips(userId: string | null = null) {
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const tripsKey = userId ? getUserKey(userId, KEYS.TRIPS) : KEYS.TRIPS;
  const queueKey = userId ? getUserKey(userId, KEYS.TRIP_SYNC_QUEUE) : KEYS.TRIP_SYNC_QUEUE;

  const readLocalTrips = useCallback(async (): Promise<TripPlan[]> => {
    const local = await getJSON<TripPlan[]>(tripsKey);
    const normalized = Array.isArray(local) ? local.map((item) => normalizeTrip(item)) : [];
    return sortTrips(dedupeTrips(normalized));
  }, [tripsKey]);

  const writeLocalTrips = useCallback(
    async (nextTrips: TripPlan[]) => {
      const normalized = sortTrips(dedupeTrips(nextTrips.map((item) => normalizeTrip(item))));
      await saveJSON(tripsKey, normalized);
      setTrips(normalized);
      return normalized;
    },
    [tripsKey]
  );

  const readQueue = useCallback(async (): Promise<TripSyncQueueItem[]> => {
    const raw = await getJSON<TripSyncQueueItem[]>(queueKey);
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((item) => normalizeQueueItem(item))
      .filter((item): item is TripSyncQueueItem => Boolean(item))
      .sort((left, right) => toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt));
  }, [queueKey]);

  const writeQueue = useCallback(
    async (nextQueue: TripSyncQueueItem[]) => {
      await saveJSON(queueKey, nextQueue);
      return nextQueue;
    },
    [queueKey]
  );

  const removeQueuedTrip = useCallback(
    async (...tripIds: string[]) => {
      const uniqueIds = Array.from(new Set(tripIds.filter(Boolean)));
      if (uniqueIds.length === 0) return;
      const queue = await readQueue();
      await writeQueue(queue.filter((item) => !uniqueIds.includes(item.tripId)));
    },
    [readQueue, writeQueue]
  );

  const queueTripForSync = useCallback(
    async (plan: TripPlan, syncStatus: Extract<TripSyncStatus, 'pending' | 'failed'> = 'pending') => {
      const normalizedPlan = { ...normalizeTrip(plan, syncStatus), syncStatus, updatedAt: new Date().toISOString() };
      const queue = await readQueue();
      await writeQueue(
        upsertQueueItem(queue, {
          type: 'upsert',
          tripId: normalizedPlan.id,
          plan: normalizedPlan,
          syncStatus,
          updatedAt: normalizedPlan.updatedAt || new Date().toISOString(),
        })
      );
      return normalizedPlan;
    },
    [readQueue, writeQueue]
  );

  const queueTripDelete = useCallback(
    async (tripId: string, syncStatus: Extract<TripSyncStatus, 'pending' | 'failed'> = 'pending') => {
      const queue = await readQueue();
      await writeQueue(
        upsertQueueItem(queue, {
          type: 'delete',
          tripId,
          syncStatus,
          updatedAt: new Date().toISOString(),
        })
      );
    },
    [readQueue, writeQueue]
  );

  const pushTripRemote = useCallback(async (plan: TripPlan): Promise<TripPlan> => {
    const normalizedPlan = normalizeTrip(plan, 'pending');

    try {
      const updated = await tripsAPI.update(normalizedPlan.id, normalizedPlan);
      return { ...normalizeTrip(unwrapObject(updated, normalizedPlan), 'synced'), syncStatus: 'synced' };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }

    const created = await tripsAPI.save(normalizedPlan);
    return { ...normalizeTrip(unwrapObject(created, normalizedPlan), 'synced'), syncStatus: 'synced' };
  }, []);

  const flushQueue = useCallback(async () => {
    const queue = await readQueue();
    if (queue.length === 0) {
      return { queue, localTrips: await readLocalTrips() };
    }

    let workingTrips = await readLocalTrips();
    const nextQueue: TripSyncQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'delete') {
          await tripsAPI.delete(item.tripId);
          workingTrips = workingTrips.filter((trip) => trip.id !== item.tripId);
          continue;
        }

        const plan = normalizeTrip(item.plan || workingTrips.find((trip) => trip.id === item.tripId), item.syncStatus);
        const syncedTrip = await pushTripRemote(plan);
        workingTrips = sortTrips(
          dedupeTrips([
            syncedTrip,
            ...workingTrips.filter((trip) => trip.id !== item.tripId && trip.id !== syncedTrip.id),
          ])
        );
      } catch {
        const failedAt = new Date().toISOString();
        if (item.type === 'upsert' && item.plan) {
          const failedTrip = {
            ...normalizeTrip(item.plan, 'failed'),
            syncStatus: 'failed' as const,
            updatedAt: failedAt,
          };
          workingTrips = sortTrips(
            dedupeTrips([
              failedTrip,
              ...workingTrips.filter((trip) => trip.id !== failedTrip.id),
            ])
          );
          nextQueue.push({
            ...item,
            plan: failedTrip,
            syncStatus: 'failed',
            updatedAt: failedAt,
          });
          continue;
        }

        nextQueue.push({
          ...item,
          syncStatus: 'failed',
          updatedAt: failedAt,
        });
      }
    }

    await saveJSON(tripsKey, workingTrips);
    await writeQueue(nextQueue);

    return { queue: nextQueue, localTrips: workingTrips };
  }, [pushTripRemote, readLocalTrips, readQueue, tripsKey, writeQueue]);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const offlineMode = await getItem(KEYS.OFFLINE_MODE);
      if (offlineMode === 'true') {
        const cached = await readLocalTrips();
        setTrips(cached);
        return;
      }

      const { queue, localTrips } = await flushQueue();
      const remote = await tripsAPI.getAll();
      const remoteTrips = unwrapList(remote).map((item) => normalizeTrip(item, 'synced'));
      const merged = mergeTrips(remoteTrips, localTrips, queue);
      await saveJSON(tripsKey, merged);
      setTrips(merged);
    } catch {
      const local = await readLocalTrips();
      setTrips(local);
    } finally {
      setLoading(false);
    }
  }, [flushQueue, readLocalTrips, tripsKey]);

  const persistTrip = useCallback(
    async (plan: TripPlan): Promise<PersistTripResult> => {
      const nextPlan = {
        ...normalizeTrip(plan, 'pending'),
        updatedAt: new Date().toISOString(),
      };

      try {
        const syncedTrip = await pushTripRemote(nextPlan);
        await removeQueuedTrip(nextPlan.id, syncedTrip.id);
        const localTrips = await readLocalTrips();
        await writeLocalTrips([
          syncedTrip,
          ...localTrips.filter((trip) => trip.id !== nextPlan.id && trip.id !== syncedTrip.id),
        ]);
        return { trip: syncedTrip, syncStatus: 'synced' };
      } catch {
        const pendingTrip = {
          ...nextPlan,
          syncStatus: 'pending' as const,
        };
        const localTrips = await readLocalTrips();
        await writeLocalTrips([
          pendingTrip,
          ...localTrips.filter((trip) => trip.id !== pendingTrip.id),
        ]);
        await queueTripForSync(pendingTrip, 'pending');
        return { trip: pendingTrip, syncStatus: 'pending' };
      }
    },
    [pushTripRemote, queueTripForSync, readLocalTrips, removeQueuedTrip, writeLocalTrips]
  );

  const saveTrip = useCallback(async (plan: TripPlan) => persistTrip(plan), [persistTrip]);
  const updateTrip = useCallback(async (plan: TripPlan) => persistTrip(plan), [persistTrip]);

  const duplicateTrip = useCallback(
    async (plan: TripPlan): Promise<PersistTripResult> => {
      const now = new Date().toISOString();

      try {
        const duplicated = await tripsAPI.duplicate(plan.id);
        const syncedTrip = { ...normalizeTrip(unwrapObject(duplicated, plan), 'synced'), syncStatus: 'synced' as const };
        const localTrips = await readLocalTrips();
        await writeLocalTrips([syncedTrip, ...localTrips.filter((trip) => trip.id !== syncedTrip.id)]);
        return { trip: syncedTrip, syncStatus: 'synced' };
      } catch {
        return persistTrip({
          ...normalizeTrip(plan, 'pending'),
          id: `trip_copy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          title: `${plan.title || 'Trip'} nusxasi`,
          status: 'draft',
          syncStatus: 'pending',
          progress: { visitedStopIds: [], notes: {}, updatedAt: now },
          createdAt: now,
          updatedAt: now,
        });
      }
    },
    [persistTrip, readLocalTrips, writeLocalTrips]
  );

  const archiveTrip = useCallback(
    async (plan: TripPlan): Promise<PersistTripResult> => {
      const archivedPlan = {
        ...normalizeTrip(plan, 'pending'),
        status: 'archived' as const,
        updatedAt: new Date().toISOString(),
      };

      try {
        const archived = await tripsAPI.archive(archivedPlan.id, true);
        const syncedTrip = { ...normalizeTrip(unwrapObject(archived, archivedPlan), 'synced'), syncStatus: 'synced' as const };
        await removeQueuedTrip(archivedPlan.id, syncedTrip.id);
        const localTrips = await readLocalTrips();
        await writeLocalTrips([
          syncedTrip,
          ...localTrips.filter((trip) => trip.id !== archivedPlan.id && trip.id !== syncedTrip.id),
        ]);
        return { trip: syncedTrip, syncStatus: 'synced' };
      } catch {
        return persistTrip(archivedPlan);
      }
    },
    [persistTrip, readLocalTrips, removeQueuedTrip, writeLocalTrips]
  );

  const deleteTrip = useCallback(
    async (id: string): Promise<Extract<TripSyncStatus, 'pending' | 'synced'>> => {
      try {
        await tripsAPI.delete(id);
        await removeQueuedTrip(id);
        const existing = await readLocalTrips();
        await writeLocalTrips(existing.filter((trip) => trip.id !== id));
        return 'synced';
      } catch {
        const existing = await readLocalTrips();
        await writeLocalTrips(existing.filter((trip) => trip.id !== id));
        await queueTripDelete(id, 'pending');
        return 'pending';
      }
    },
    [queueTripDelete, readLocalTrips, removeQueuedTrip, writeLocalTrips]
  );

  return { trips, loading, loadTrips, saveTrip, updateTrip, duplicateTrip, archiveTrip, deleteTrip };
}
