// Server-side fetch helper — marketing sahifalari uchun real backend ma'lumotlari.

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

export async function fetchTours(limit = 60): Promise<Tour[]> {
  const json = await getJson(`/home/tours?agencyOnly=true&limit=${limit}`);
  const items = json?.data?.items;
  return Array.isArray(items) ? items : [];
}

export async function fetchPlaces(limit = 24): Promise<Place[]> {
  const json = await getJson(`/home/places?limit=${limit}`);
  const items = json?.data?.items;
  return Array.isArray(items) ? items : [];
}

export async function fetchTour(idOrSlug: string): Promise<Tour | null> {
  const tours = await fetchTours(60);
  return tours.find((t) => t.slug === idOrSlug || t.id === idOrSlug) || null;
}

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
