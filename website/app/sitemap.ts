import type { MetadataRoute } from "next";
import { fetchAllTours } from "@/lib/marketingApi";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com";

export const revalidate = 3600;

function validDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Statik sahifalar uchun lastModified berilmaydi: har so'rovda "hozir" deb
  // yozish qidiruv tizimlarini chalg'itadi (sahifa aslida o'zgarmagan).
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE_URL}/tours`, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE_URL}/destinations`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${BASE_URL}/about`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE_URL}/partners`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/pricing`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/contact`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE_URL}/offer`, priority: 0.4, changeFrequency: "yearly" },
    { url: `${BASE_URL}/privacy`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${BASE_URL}/terms`, priority: 0.3, changeFrequency: "yearly" },
    // Meta/Google App Review shu manzilni «User Data Deletion» sifatida tekshiradi —
    // indekslanadigan va topiladigan bo'lishi kerak.
    { url: `${BASE_URL}/data-deletion`, priority: 0.3, changeFrequency: "yearly" },
  ];

  let tourRoutes: MetadataRoute.Sitemap = [];
  try {
    // Barcha turlar (60 talik sahifalab) — ilgari faqat birinchi 60 ta kirardi.
    const tours = await fetchAllTours();
    tourRoutes = tours.map((t) => {
      // Backend hozircha updatedAt bermaydi; bo'lsa — haqiqiy sana, aks holda
      // lastVerifiedAt, u ham bo'lmasa lastModified umuman yozilmaydi.
      const lastModified = validDate(t.updatedAt) || validDate(t.lastVerifiedAt);
      return {
        url: `${BASE_URL}/tours/${encodeURIComponent(t.slug || t.id)}`,
        priority: 0.7,
        changeFrequency: "weekly" as const,
        ...(lastModified ? { lastModified } : {}),
      };
    });
  } catch {
    tourRoutes = [];
  }

  return [...staticRoutes, ...tourRoutes];
}
