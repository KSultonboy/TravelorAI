import { useState, useCallback, useEffect } from 'react';
import { wishlistAPI } from '../utils/api';
import { extractApiData } from '../utils/auth';
import { getUserKey, KEYS, getItem, getJSON, saveJSON } from '../utils/storage';

export interface WishlistItem {
  id: string;
  poiId?: string | null;
  name: string;
  city: string;
  icon: string;
  slug: string;
  type: string;
  savedAt: string;
}

interface ToggleWishlistItemInput {
  id?: string;
  poiId?: string | null;
  name: string;
  city: string;
  icon: string;
  slug: string;
  type: string;
}

function normalizeWishlistItem(item: Partial<WishlistItem> & Record<string, unknown>): WishlistItem {
  return {
    id: String(item.id || item.slug || item.poiId || `${item.name || 'place'}_${Date.now()}`),
    poiId: item.poiId ? String(item.poiId) : null,
    name: String(item.name || ''),
    city: String(item.city || ''),
    icon: String(item.icon || '📍'),
    slug: String(item.slug || ''),
    type: String(item.type || 'landmark'),
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
  };
}

function findMatchIndex(items: WishlistItem[], input: { id?: string; poiId?: string | null; slug?: string }) {
  const byPoiId = input.poiId || input.id || null;
  return items.findIndex((item) => {
    if (input.slug && item.slug === input.slug) return true;
    if (byPoiId && (item.poiId === byPoiId || item.id === byPoiId)) return true;
    if (input.id && item.id === input.id) return true;
    return false;
  });
}

export function useWishlist(userId: string | null = null) {
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  const wishlistKey = userId ? getUserKey(userId, KEYS.WISHLIST) : KEYS.WISHLIST;

  useEffect(() => {
    let active = true;

    (async () => {
      const cached = await getJSON<WishlistItem[]>(wishlistKey);
      if (active) {
        setWishlist((cached || []).map((item) => normalizeWishlistItem(item as any)));
      }

      const [token, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);
      if (!token || offlineMode === 'true') {
        return;
      }

      try {
        const response = extractApiData<any>(await wishlistAPI.getAll());
        const list = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
        const normalized = list.map((item: Record<string, unknown>) => normalizeWishlistItem(item));
        await saveJSON(wishlistKey, normalized);
        if (active) {
          setWishlist(normalized);
        }
      } catch {
        // keep cached
      }
    })();

    return () => {
      active = false;
    };
  }, [wishlistKey]);

  const isWishlisted = useCallback(
    (id: string) => wishlist.some((item) => item.id === id || item.poiId === id || item.slug === id),
    [wishlist]
  );

  const toggle = useCallback(
    async (item: ToggleWishlistItemInput) => {
      const poiId = item.poiId || item.id || null;
      const existingIndex = findMatchIndex(wishlist, { id: item.id, poiId, slug: item.slug });
      const existingItem = existingIndex > -1 ? wishlist[existingIndex] : null;
      const [token, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);

      if (token && offlineMode !== 'true') {
        try {
          if (existingItem) {
            await wishlistAPI.remove(existingItem.id);
            const updated = wishlist.filter((_, index) => index !== existingIndex);
            await saveJSON(wishlistKey, updated);
            setWishlist(updated);
            return;
          }

          const response = extractApiData<any>(
            await wishlistAPI.add({
              poiId,
              name: item.name,
              city: item.city,
              slug: item.slug,
              type: item.type,
              icon: item.icon,
            })
          );
          const created = normalizeWishlistItem(response);
          const updated = [created, ...wishlist.filter((w) => w.id !== created.id)];
          await saveJSON(wishlistKey, updated);
          setWishlist(updated);
          return;
        } catch {
          // fallback to local below
        }
      }

      const localExisting = await getJSON<WishlistItem[]>(wishlistKey);
      const safeLocal = (localExisting || []).map((entry) => normalizeWishlistItem(entry as any));
      const localIndex = findMatchIndex(safeLocal, { id: item.id, poiId, slug: item.slug });
      let updated: WishlistItem[];

      if (localIndex > -1) {
        updated = safeLocal.filter((_, index) => index !== localIndex);
      } else {
        updated = [
          normalizeWishlistItem({
            id: String(poiId || item.slug || Date.now()),
            poiId,
            name: item.name,
            city: item.city,
            icon: item.icon,
            slug: item.slug,
            type: item.type,
            savedAt: new Date().toISOString(),
          }),
          ...safeLocal,
        ];
      }

      await saveJSON(wishlistKey, updated);
      setWishlist(updated);
    },
    [wishlist, wishlistKey]
  );

  const remove = useCallback(async (id: string) => {
    const [token, offlineMode] = await Promise.all([getItem(KEYS.TOKEN), getItem(KEYS.OFFLINE_MODE)]);
    const cached = (await getJSON<WishlistItem[]>(wishlistKey)) || wishlist;
    const safeCached = cached.map((item) => normalizeWishlistItem(item as any));

    if (token && offlineMode !== 'true') {
      try {
        await wishlistAPI.remove(id);
      } catch {
        const target = safeCached.find((item) => item.id === id || item.poiId === id || item.slug === id);
        if (target?.id) {
          try {
            await wishlistAPI.remove(target.id);
          } catch {
            // keep local remove fallback
          }
        }
      }
    }

    const updated = safeCached.filter((item) => item.id !== id && item.poiId !== id && item.slug !== id);
    await saveJSON(wishlistKey, updated);
    setWishlist(updated);
  }, [wishlist, wishlistKey]);

  return { wishlist, isWishlisted, toggle, remove };
}
