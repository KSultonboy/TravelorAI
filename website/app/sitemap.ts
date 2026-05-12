import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      priority: 1.0,
      changeFrequency: "weekly",
      lastModified: new Date(),
    },
  ];
}
