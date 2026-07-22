import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import AttributionCapture from "@/components/marketing/AttributionCapture";
import "./globals.scss";
import "../styles/landing-v2.scss";
import "../styles/marketing.scss";
import "../styles/marketing-motion.scss";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

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
    default: "TravelorAI — AI sayohat platformasi",
    template: "%s | TravelorAI",
  },
  description:
    "AI yordamida sayohatlarni rejalashtiring. Tasdiqlangan joylar, aqlli marshrutlar, agentlik reytinglari va mobil-birinchi sayohat tajribasi.",
  // Mahalliy xaridor aynan shu so'zlar bilan qidiradi (o'zbek + rus + brend).
  keywords: [
    "TravelorAI",
    "tur agentligi",
    "sayohat agentligi",
    "Umra tur",
    "Umra narxi",
    "Dubay tur",
    "Turkiya tur",
    "chet el turlari",
    "aviabilet",
    "tur paketlar",
    "O'zbekiston sayohat",
    "sayohat rejalashtirish",
    "туры из Ташкента",
    "турагентство Узбекистан",
    "тур в Дубай",
    "тур в Турцию",
    "Умра из Узбекистана",
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
    title: "TravelorAI — AI sayohat platformasi",
    description:
      "Dunyo bo‘ylab yo‘nalishlar uchun shaxsiy sayohat rejalarini yarating. AI rejalashtiruvchi, tasdiqlangan joylar, agentlik reytinglari va aqlli kashfiyot.",
    url: BASE_URL,
    siteName: "TravelorAI",
    type: "website",
    locale: "uz_UZ",
    alternateLocale: ["ru_RU", "en_US"],
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "TravelorAI — AI sayohat platformasi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TravelorAI — AI sayohat platformasi",
    description: "Dunyo bo‘ylab yo‘nalishlar uchun shaxsiy sayohat rejalarini yarating.",
    images: ["/og-image.svg"],
  },
  alternates: {
    canonical: BASE_URL,
  },
  icons: {
    icon: "/favicon.ico",
  },
  // Qidiruv tizimi tasdig'i — kodlarni Search Console / Yandex Webmaster'dan olib
  // .env ga qo'yasiz (SITE_VERIFY_GOOGLE, SITE_VERIFY_YANDEX). Bo'sh bo'lsa e'tiborsiz.
  verification: {
    ...(process.env.SITE_VERIFY_GOOGLE ? { google: process.env.SITE_VERIFY_GOOGLE } : {}),
    ...(process.env.SITE_VERIFY_YANDEX ? { yandex: process.env.SITE_VERIFY_YANDEX } : {}),
  },
};

// Ikkita struktura: sayt qidiruv qutisi (Google sitelinks) + tashkilot (sayohat agentligi).
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TravelorAI",
    url: BASE_URL,
    inLanguage: "uz-UZ",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/tours?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: "TravelorAI",
    url: BASE_URL,
    description:
      "O'zbekistondagi sayohat agentliklari uchun onlayn platforma. Tasdiqlangan tur paketlar: Umra, Dubay, Turkiya va boshqa yo'nalishlar. AI yordamida rejalashtiring va ishonchli agentlikdan bron qiling.",
    image: `${BASE_URL}/og-image.svg`,
    priceRange: "$$",
    areaServed: { "@type": "Country", name: "Uzbekistan" },
    availableLanguage: ["uz", "ru"],
    sameAs: SOCIAL_LINKS,
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={jakarta.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <AttributionCapture />
        {children}
      </body>
    </html>
  );
}
