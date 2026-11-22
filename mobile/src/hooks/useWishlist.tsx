import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { wishlistAPI } from '../utils/api';
import { extractApiData } from '../utils/auth';
import { getJSON, getUserKey, KEYS, saveJSON } from '../utils/storage';

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

export interface WishlistToggleInput {
  poiId?: string | null;
  name: string;
  city: string;
  icon: string;
  slug: string;
  type: string;
}

/** Tours are stored in the generic wishlist with type "tour" and slug "tour-<id>". */
export const TOUR_WISHLIST_TYPE = 'tour';
const TOUR_SLUG_PREFIX = 'tour-';

export function tourWishlistSlug(tourId: string): string {
  return `${TOUR_SLUG_PREFIX}${tourId}`.slice(0, 120);
}

export function tourIdFromWishlistItem(item: Pick<WishlistItem, 'type' | 'slug'>): string | null {
  if (item.type !== TOUR_WISHLIST_TYPE || !item.slug.startsWith(TOUR_SLUG_PREFIX)) return null;
  return item.slug.slice(TOUR_SLUG_PREFIX.length) || null;
}

export function buildTourWishlistInput(tour: { id: string; title: string; city?: string | null }): WishlistToggleInput {
  return {
    poiId: null,
    name: (tour.title || 'Tur').slice(0, 120),
    city: (tour.city || 'Global').slice(0, 120),
    slug: tourWishlistSlug(tour.id),
    type: TOUR_WISHLIST_TYPE,
    icon: '🧳',
  };
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

interface WishlistContextValue {
  wishlist: WishlistItem[];
  isWishlisted: (slugOrId: string) => boolean;
  toggle: (item: WishlistToggleInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, token, ready } = useAuth();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const wishlistRef = useRef<WishlistItem[]>([]);
  const wishlistKey = user?.id ? getUserKey(user.id, KEYS.WISHLIST) : KEYS.WISHLIST;

  const commit = useCallback(
    async (items: WishlistItem[]) => {
      wishlistRef.current = items;
      setWishlist(items);
      await saveJSON(wishlistKey, items).catch(() => {});
    },
    [wishlistKey]
  );

  useEffect(() => {
    if (!ready) return;
    let active = true;

    (async () => {
      const cached = await getJSON<WishlistItem[]>(wishlistKey);
      if (!active) return;
      const local = (cached || []).map((item) => normalizeWishlistItem(item as any));
      wishlistRef.current = local;
      setWishlist(local);

      if (!token) return;
      try {
        const response = extractApiData<any>(await wishlistAPI.getAll());
        const list = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
        const normalized = list.map((item: Record<string, unknown>) => normalizeWishlistItem(item));
        if (!active) return;
        wishlistRef.current = normalized;
        setWishlist(normalized);
        await saveJSON(wishlistKey, normalized);
      } catch {
        // keep cached
      }
    })();

    return () => {
      active = false;
    };
  }, [ready, token, wishlistKey]);

  const isWishlisted = useCallback(
    (slugOrId: string) => wishlist.some((item) => item.slug === slugOrId || item.id === slugOrId || item.poiId === slugOrId),
    [wishlist]
  );

  const toggle = useCallback(
    async (input: WishlistToggleInput) => {
      const current = wishlistRef.current;
      const existing = current.find((item) => item.slug === input.slug);

      if (existing) {
        // optimistic remove
        await commit(current.filter((item) => item !== existing));
        if (token) {
          try {
            await wishlistAPI.remove(existing.id);
          } catch {
            // server copy will be reconciled on next load
          }
        }
        return;
      }

      const optimistic = normalizeWishlistItem({ ...input, id: input.slug, savedAt: new Date().toISOString() });
      await commit([optimistic, ...current]);

      if (token) {
        try {
          const created = normalizeWishlistItem(
            extractApiData<any>(
              await wishlistAPI.add({
                poiId: input.poiId || null,
                name: input.name,
                city: input.city,
                slug: input.slug,
                type: input.type,
                icon: input.icon,
              })
            )
          );
          await commit([created, ...wishlistRef.current.filter((item) => item.slug !== input.slug)]);
        } catch {
          // keep the local copy
        }
      }
    },
    [commit, token]
  );

  const remove = useCallback(
    async (id: string) => {
      const current = wishlistRef.current;
      const target = current.find((item) => item.id === id || item.poiId === id || item.slug === id);
      await commit(current.filter((item) => item !== target));
      if (token && target) {
        try {
          await wishlistAPI.remove(target.id);
        } catch {
          // keep local remove
        }
      }
    },
    [commit, token]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({ wishlist, isWishlisted, toggle, remove }),
    [wishlist, isWishlisted, toggle, remove]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used inside <WishlistProvider>');
  }
  return ctx;
}
