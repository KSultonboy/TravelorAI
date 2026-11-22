import { homeAPI } from './api';
import { extractApiData } from './auth';
import { normalizeTours, type HomeTourItem } from './homeContent';

/**
 * In-memory cache of tours already shown in a list, so that opening the
 * details screen from a card renders instantly. Deep links only carry the
 * tour id/slug; anything not cached is fetched from the API.
 */
const cache = new Map<string, HomeTourItem>();

export function rememberTours(items: HomeTourItem[]) {
  for (const item of items) {
    if (item.id) cache.set(item.id, item);
    if (item.slug) cache.set(item.slug, item);
  }
}

export function getCachedTour(idOrSlug?: string | null): HomeTourItem | null {
  if (!idOrSlug) return null;
  return cache.get(idOrSlug) || null;
}

/** Route params for the details screen: only identifiers, never the tour body. */
export function tourDetailsHref(item: Pick<HomeTourItem, 'id' | 'slug'>) {
  return {
    pathname: '/tour-details' as const,
    params: item.slug ? { id: item.id, slug: item.slug } : { id: item.id },
  };
}

function matches(item: HomeTourItem, keys: string[]) {
  return keys.includes(item.id) || (item.slug ? keys.includes(item.slug) : false);
}

const SCAN_PAGE_SIZE = 60;
const SCAN_MAX_PAGES = 10;

/**
 * Loads one tour by id or slug.
 * 1) `GET /home/tours/:idOrSlug` (if the backend provides it),
 * 2) otherwise pages through `GET /home/tours` and picks the match.
 */
export async function fetchTour(id?: string | null, slug?: string | null): Promise<HomeTourItem | null> {
  const keys = [id, slug].filter((value): value is string => Boolean(value && value.trim()));
  if (keys.length === 0) return null;

  for (const key of keys) {
    const cached = getCachedTour(key);
    if (cached) return cached;
  }

  try {
    const payload = extractApiData<any>(await homeAPI.getTour(keys[0]));
    const raw = payload?.item || payload?.tour || payload;
    const [tour] = normalizeTours(raw && typeof raw === 'object' && !Array.isArray(raw) ? [raw] : []);
    if (tour && matches(tour, keys)) {
      rememberTours([tour]);
      return tour;
    }
  } catch {
    // endpoint missing (404) or failed → fall back to the list scan
  }

  for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
    const payload = extractApiData<{ items?: unknown[]; total?: number }>(
      await homeAPI.getTours({ limit: SCAN_PAGE_SIZE, page })
    );
    const items = normalizeTours(payload?.items || []);
    rememberTours(items);
    const found = items.find((item) => matches(item, keys));
    if (found) return found;

    const total = Number(payload?.total);
    if (items.length < SCAN_PAGE_SIZE || (Number.isFinite(total) && page * SCAN_PAGE_SIZE >= total)) {
      break;
    }
  }

  return null;
}
