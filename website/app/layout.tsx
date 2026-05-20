import type { Metadata, Viewport } from "next";
import "./globals.scss";
import "../styles/landing-v2.scss";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com";
const SOCIAL_LINKS = [
  "https://www.instagram.com/traveloraai/",
  "https://www.youtube.com/@TravelorAI",
];

export const viewport: Viewport = {
  themeColor: "#087a56",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "TravelorAI - Global AI travel platform",
    template: "%s | TravelorAI",
  },
  description:
    "Plan trips around the world with AI. Verified places, smart routes, agency rankings and mobile-first travel experience.",
  keywords: [
    "TravelorAI",
    "global travel planner",
    "world travel app",
    "AI travel planner",
    "trip planner",
    "tour agencies",
    "popular destinations",
    "travel recommendations",
    "Sayohat rejalashtirish",
    "AI planner",
  ],
  authors: [{ name: "TravelorAI" }],
  creator: "TravelorAI",
  publisher: "TravelorAI",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: "TravelorAI - Global AI travel platform",
    description:
      "Create personal travel plans for destinations around the world. AI planner, verified places, agency rankings and smart discovery.",
    url: BASE_URL,
    siteName: "TravelorAI",
    type: "website",
    locale: "uz_UZ",
    alternateLocale: ["ru_RU", "en_US"],
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TravelorAI - Global AI travel platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TravelorAI - Global AI travel platform",
    description: "Create personal travel plans for destinations around the world.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: BASE_URL,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "TravelorAI",
  url: BASE_URL,
  description:
    "Plan trips around the world with AI. Discover verified places, popular tours, top agencies and smart destination recommendations.",
  applicationCategory: "TravelApplication",
  operatingSystem: "Web, iOS, Android",
  inLanguage: ["uz", "ru", "en"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Organization", name: "TravelorAI", url: BASE_URL },
  sameAs: SOCIAL_LINKS,
  areaServed: { "@type": "Place", name: "Worldwide" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
