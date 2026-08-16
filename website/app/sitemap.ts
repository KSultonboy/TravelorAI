import type { MetadataRoute } from "next";
import { fetchTours } from "@/lib/marketingApi";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, priority: 1.0, changeFrequency: "weekly", lastModified: now },
    { url: `${BASE_URL}/tours`, priority: 0.9, changeFrequency: "daily", lastModified: now },
    { url: `${BASE_URL}/destinations`, priority: 0.8, changeFrequency: "weekly", lastModified: now },
    { url: `${BASE_URL}/about`, priority: 0.6, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE_URL}/partners`, priority: 0.7, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE_URL}/pricing`, priority: 0.7, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE_URL}/contact`, priority: 0.5, changeFrequency: "monthly", lastModified: now },
    { url: `${BASE_URL}/offer`, priority: 0.4, changeFrequency: "yearly", lastModified: now },
    { url: `${BASE_URL}/privacy`, priority: 0.3, changeFrequency: "yearly", lastModified: now },
    { url: `${BASE_URL}/terms`, priority: 0.3, changeFrequency: "yearly", lastModified: now },
  ];

  let tourRoutes: MetadataRoute.Sitemap = [];
  try {
    const tours = await fetchTours(60);
    tourRoutes = tours.map((t) => ({
      url: `${BASE_URL}/tours/${encodeURIComponent(t.slug || t.id)}`,
      priority: 0.7,
      changeFrequency: "weekly" as const,
      lastModified: now,
    }));
  } catch {
    tourRoutes = [];
  }

  return [...staticRoutes, ...tourRoutes];
}
