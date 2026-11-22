// Agentlik storefront'i (/a/[slug]) — server-side fetch. Backend:
// GET /home/agencies/:slug/storefront (faqat faol + tasdiqlangan agentlik).
import { cache } from "react";
import { serverApiUrl, type Tour } from "./marketingApi";

export type StorefrontAgency = {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  description?: string | null;
  specialty?: string | null;
  rating?: number | null;
  reviews?: number | null;
  verified: boolean;
  phone?: string | null;
  telegram?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  toursCount?: number;
  updatedAt?: string | null;
};

export type Storefront = { agency: StorefrontAgency; tours: Tour[] };

/**
 * - found       — agentlik va turlari
 * - missing     — backend JSON 404 qaytardi (agentlik yo'q / faol emas)
 * - unavailable — tarmoq xatosi yoki eski backend (endpoint yo'q, JSON emas)
 */
export type StorefrontResult =
  | { kind: "found"; data: Storefront }
  | { kind: "missing" }
  | { kind: "unavailable" };

const SLUG_RE = /^[A-Za-z0-9_-]{1,160}$/;

export const fetchStorefront = cache(async (slug: string): Promise<StorefrontResult> => {
  if (!SLUG_RE.test(slug)) return { kind: "missing" };
  try {
    const res = await fetch(`${serverApiUrl()}/home/agencies/${encodeURIComponent(slug)}/storefront`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success !== false) {
      const agency = json?.data?.agency;
      const tours = json?.data?.tours;
      if (agency && typeof agency.id === "string" && typeof agency.name === "string") {
        return { kind: "found", data: { agency, tours: Array.isArray(tours) ? tours : [] } };
      }
      return { kind: "unavailable" };
    }
    // Faqat haqiqiy "topilmadi" (agentlik yo'q) — 404. Eski backend'da endpoint
    // yo'q bo'lsa ham Express JSON 404 qaytaradi; u holda ham sahifa 404 bo'ladi.
    if (res.status === 404 && json && json.success === false) return { kind: "missing" };
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
});

/** Sitemap uchun: faol, tasdiqlangan agentliklar slug'lari (/home/agencies ko'pi bilan 100 ta). */
export async function fetchPublicAgencySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${serverApiUrl()}/home/agencies?limit=100`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const items = json?.data?.items;
    if (!Array.isArray(items)) return [];
    return items
      .map((a: { slug?: unknown }) => (typeof a?.slug === "string" ? a.slug : ""))
      .filter((s: string) => SLUG_RE.test(s));
  } catch {
    return [];
  }
}
