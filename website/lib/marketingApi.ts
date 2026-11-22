// Server-side fetch helper — marketing sahifalari uchun real backend ma'lumotlari.
import { cache } from "react";

export type Tour = {
  id: string;
  slug?: string | null;
  title: string;
  city: string;
  destinationCountry?: string | null;
  subtitle?: string;
  description?: string;
  duration?: string;
  days?: number | null;
  nights?: number | null;
  price?: string;
  priceMin?: number | null;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  imageUrl?: string | null;
  images?: string[];
  responseTimeMinutes?: number;
  hotelIncluded?: boolean;
  flightIncluded?: boolean;
  transferIncluded?: boolean;
  insuranceIncluded?: boolean;
  priceIncludes?: string[];
  agency?: { name: string; imageUrl?: string | null } | null;
  /** Backend hozircha updatedAt bermaydi — bor bo'lsa sitemap'da ishlatiladi. */
  updatedAt?: string | null;
  lastVerifiedAt?: string | null;
};

export type Place = {
  id: string;
  slug?: string;
  name: string;
  city: string;
  type?: string;
  imageUrl?: string | null;
  description?: string | null;
  info?: string | null;
  rating?: number | null;
};

function normalizeApiUrl(value: string) {
  return value.replace(/\/$/, "");
}

export function serverApiUrl() {
  const configured =
    process.env.HOME_API_URL ||
    process.env.ADMIN_API_URL ||
    process.env.AGENCY_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  if (/^https?:\/\//i.test(configured)) return normalizeApiUrl(configured);
  if (configured.startsWith("/")) {
    if (process.env.NODE_ENV !== "production") return `http://localhost:4000${configured}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com";
    return `${normalizeApiUrl(siteUrl)}${configured}`;
  }
  if (process.env.NODE_ENV !== "production") return "http://localhost:4000/api/v1";
  if (!process.env.NEXT_PUBLIC_SITE_URL) return "http://localhost:4000/api/v1";
  return "https://travelorai.com/api/v1";
}

async function getJson(path: string): Promise<any> {
  try {
    const res = await fetch(`${serverApiUrl()}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Backend /home/tours sahifa hajmi cheklovi (clampLimit max = 60). */
const TOURS_PAGE_SIZE = 60;
/** Xavfsizlik chegarasi: 60 × 50 = 3000 tur. */
const TOURS_MAX_PAGES = 50;

type ToursPage = { ok: boolean; items: Tour[]; total: number };

const fetchToursPage = cache(async (page: number, limit: number): Promise<ToursPage> => {
  const json = await getJson(`/home/tours?agencyOnly=true&limit=${limit}&page=${page}`);
  const items = json?.data?.items;
  const total = Number(json?.data?.total);
  return {
    ok: Array.isArray(items),
    items: Array.isArray(items) ? items : [],
    total: Number.isFinite(total) ? total : 0,
  };
});

export async function fetchTours(limit = 60): Promise<Tour[]> {
  const { items } = await fetchToursPage(1, Math.min(Math.max(1, limit), TOURS_PAGE_SIZE));
  return items;
}

/** Ommaviy turlar umumiy soni (backend `total`). Xato bo'lsa — 0. */
export const fetchToursCount = cache(async (): Promise<number> => {
  const { total } = await fetchToursPage(1, 1);
  return total;
});

/** Barcha ommaviy turlar (60 talik sahifalab). Katalog va sitemap uchun. */
export const fetchAllTours = cache(async (): Promise<Tour[]> => {
  const first = await fetchToursPage(1, TOURS_PAGE_SIZE);
  const all = [...first.items];
  const pages = Math.min(TOURS_MAX_PAGES, Math.ceil(first.total / TOURS_PAGE_SIZE));
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchToursPage(page, TOURS_PAGE_SIZE);
    if (next.items.length === 0) break;
    all.push(...next.items);
  }
  return all;
});

/**
 * Tasdiqlangan hamkor agentliklar soni. /home/agencies ko'pi bilan 100 ta
 * qaytaradi — 100 bo'lsa UI "100+" ko'rsatadi.
 */
export const fetchAgenciesCount = cache(async (): Promise<number> => {
  const json = await getJson(`/home/agencies?limit=100`);
  const items = json?.data?.items;
  return Array.isArray(items) ? items.length : 0;
});

export async function fetchPlaces(limit = 24): Promise<Place[]> {
  const json = await getJson(`/home/places?limit=${limit}`);
  const items = json?.data?.items;
  return Array.isArray(items) ? items : [];
}

type SingleTourResult = { kind: "found"; tour: Tour } | { kind: "missing" } | { kind: "unsupported" };

/**
 * GET /home/tours/:idOrSlug — yangi backend endpoint'i.
 *  - 200 + data → topildi
 *  - 404 + JSON {success:false} → tur haqiqatan yo'q/nofaol
 *  - boshqa (JSON bo'lmagan 404 = eski backend'da route yo'q, tarmoq xatosi) → "unsupported",
 *    chaqiruvchi ro'yxatni sahifalab qidirishga o'tadi.
 */
async function fetchSingleTour(idOrSlug: string): Promise<SingleTourResult> {
  try {
    const res = await fetch(`${serverApiUrl()}/home/tours/${encodeURIComponent(idOrSlug)}`, { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success !== false) {
      const data = json?.data;
      const tour = (data?.tour ?? data?.item ?? data) as Tour | null;
      if (tour && typeof tour === "object" && typeof tour.id === "string") return { kind: "found", tour };
      return { kind: "unsupported" };
    }
    if (res.status === 404 && json && json.success === false) return { kind: "missing" };
    return { kind: "unsupported" };
  } catch {
    return { kind: "unsupported" };
  }
}

/**
 * Bitta tur (slug yoki id bo'yicha). Avval GET /home/tours/:idOrSlug; eski
 * backend'da u bo'lmasa — ro'yxatni sahifalab qidiramiz, topilgach to'xtaymiz.
 * React `cache` — generateMetadata va sahifa bitta so'rovda ikki marta
 * chaqirsa ham backend'ga bir marta boriladi.
 */
export const fetchTour = cache(async (idOrSlug: string): Promise<Tour | null> => {
  const single = await fetchSingleTour(idOrSlug);
  if (single.kind === "found") return single.tour;
  if (single.kind === "missing") return null;

  const match = (t: Tour) => t.slug === idOrSlug || t.id === idOrSlug;
  const first = await fetchToursPage(1, TOURS_PAGE_SIZE);
  // Backend javob bermasa — bu "topilmadi" emas: xato tashlaymiz (error.tsx,
  // 500), aks holda vaqtinchalik nosozlikda Google sahifani 404 deb o'chirardi.
  if (!first.ok) throw new Error("Turlar API javob bermadi");
  const hit = first.items.find(match);
  if (hit) return hit;
  const pages = Math.min(TOURS_MAX_PAGES, Math.ceil(first.total / TOURS_PAGE_SIZE));
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchToursPage(page, TOURS_PAGE_SIZE);
    if (!next.ok) throw new Error("Turlar API javob bermadi");
    const found = next.items.find(match);
    if (found) return found;
    if (next.items.length === 0) break;
  }
  return null;
});

/* ===== Tariflar (ommaviy) — /pricing sahifasi uchun. Narxlar so'mda. ===== */
export type PublicTariff = {
  slug: string;
  name: string;
  priceMonthly: number;
  priceMonthlyUzs: number;
  features: string[];
  sortOrder: number;
};

export async function fetchTariffs(): Promise<PublicTariff[]> {
  const json = await getJson("/tariffs");
  const items = json?.data;
  return Array.isArray(items) ? (items as PublicTariff[]) : [];
}

/* ===== Dinamik taklif (prezentatsiya) — agent mijozga yuboradigan shaxsiy sahifa ===== */

export type PresentationTour = {
  title: string;
  city?: string | null;
  subtitle?: string | null;
  description?: string | null;
  duration?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  images?: string[] | null;
  mapAddress?: string | null;
  routeStops?: unknown;
  highlights?: string[] | null;
  itinerary?: unknown;
  nights?: number | null;
  hotelName?: string | null;
  hotelCategory?: string | null;
  mealPlanLabel?: string | null;
  priceIncludes?: string[] | null;
  priceExcludes?: string[] | null;
  destinationCountry?: string | null;
};

export type Presentation = {
  title: string;
  customerName?: string | null;
  priceText?: string | null;
  note?: string | null;
  interested: boolean;
  createdAt: string;
  agency: {
    name: string;
    city?: string | null;
    phone?: string | null;
    telegram?: string | null;
    imageUrl?: string | null;
    slug?: string | null;
  } | null;
  tour: PresentationTour | null;
  /** Agentlikning o'z to'lov havolasi / rekvizitlari (sozlanmagan bo'lsa null). */
  payment?: { url?: string | null; requisites?: string | null } | null;
};

export async function fetchPresentation(token: string): Promise<Presentation | null> {
  const json = await getJson(`/p/${encodeURIComponent(token)}`);
  return json?.data || null;
}

export async function fetchHeroImage(): Promise<string | null> {
  const json = await getJson(`/home/hero-slides?limit=6`);
  const items = json?.data?.items;
  if (Array.isArray(items) && items.length > 0) {
    return items[0].imageUrl || items[0].fallbackImageUrl || null;
  }
  return null;
}

export function tourPrice(t: Tour): string {
  if (t.price) return t.price;
  if (t.priceMin) return `$${t.priceMin} dan`;
  return "Narx so‘rovda";
}
