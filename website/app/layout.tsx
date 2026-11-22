import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { connection } from "next/server";
import { headers } from "next/headers";
import AttributionCapture from "@/components/marketing/AttributionCapture";
import UmamiAnalytics from "@/components/marketing/UmamiAnalytics";
import { umamiConfig } from "@/lib/umami";
import { jsonLdScript } from "@/lib/jsonLd";
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
  // Uch bozor: chiqish (o'zbek/rus xaridor), ichki + kirish turizmi (ingliz sayohatchi).
  keywords: [
    "TravelorAI",
    // Chiqish turizmi — o'zbek
    "tur agentligi",
    "sayohat agentligi",
    "Umra tur",
    "Dubay tur",
    "Turkiya tur",
    "chet el turlari",
    "tur paketlar",
    "O'zbekiston sayohat",
    // Chiqish/CIS — rus
    "туры из Ташкента",
    "турагентство Узбекистан",
    "тур в Дубай",
    "Умра из Узбекистана",
    // Kirish + ichki turizm — ingliz (chet ellik sayohatchilar)
    "Uzbekistan tours",
    "Uzbekistan travel agency",
    "Samarkand tour",
    "Bukhara tour",
    "Khiva tour",
    "Silk Road tour",
    "Tashkent city tour",
    "Central Asia travel",
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
    // Rasm: app/opengraph-image.tsx (PNG, 1200x630) — fayl konvensiyasi orqali.
  },
  twitter: {
    card: "summary_large_image",
    title: "TravelorAI — AI sayohat platformasi",
    description: "Dunyo bo‘ylab yo‘nalishlar uchun shaxsiy sayohat rejalarini yarating.",
  },
  // canonical bu yerda BERILMAYDI: root layout'dagi canonical barcha ichki
  // sahifalarga meros bo'lib, ularni bosh sahifaning dublikati qilib qo'yardi.
  // Har bir sahifa o'z `alternates.canonical`ini o'zi belgilaydi.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Qidiruv tizimi tasdig'i — kodlarni Search Console / Yandex Webmaster'dan olib
  // .env ga qo'yasiz (SITE_VERIFY_GOOGLE, SITE_VERIFY_YANDEX). Bo'sh bo'lsa e'tiborsiz.
  verification: {
    ...(process.env.SITE_VERIFY_GOOGLE ? { google: process.env.SITE_VERIFY_GOOGLE } : {}),
    ...(process.env.SITE_VERIFY_YANDEX ? { yandex: process.env.SITE_VERIFY_YANDEX } : {}),
    // Meta (Facebook) domen tasdig'i — Business Portfolio «TravelorAI» uchun.
    // Bu <head> ichida <meta name="facebook-domain-verification"> bo'lib chiqadi.
    // Meta shartи: tag AYNAN <head> ichida bo'lsin va JS bilan qo'shilmasin —
    // Next.js metadata API buni server tomonda chizadi, shart bajariladi.
    // Instagram/Meta App Review va biznes tasdiqlash uchun kerak.
    other: { "facebook-domain-verification": "fvmkqsnfy5s1pkuxpl8nqetgitw0o8" },
  },
};

// Ikkita struktura: sayt qidiruv qutisi (Google sitelinks) + tashkilot.
// TravelorAI o'zi tur sotmaydi — agentliklar uchun onlayn platforma (oferta:
// SaaS), shuning uchun TravelAgency emas, OnlineBusiness (Organization).
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
    "@type": "OnlineBusiness",
    name: "TravelorAI",
    url: BASE_URL,
    logo: `${BASE_URL}/icon-512.png`,
    description:
      "O'zbekistondagi sayohat agentliklari uchun onlayn platforma. Chiqish, ichki va kirish turizmi: Umra, Dubay, Turkiya hamda Samarqand, Buxoro, Xiva bo'ylab tur paketlar. AI yordamida rejalashtiring va ishonchli agentlikdan bron qiling.",
    areaServed: { "@type": "Country", name: "Uzbekistan" },
    sameAs: SOCIAL_LINKS,
  },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // CSP nonce (proxy.ts) har so'rovda yangi bo'ladi — shuning uchun barcha
  // sahifalar so'rov vaqtida render qilinishi SHART (statik HTML'dagi
  // skriptlarda nonce bo'lmaydi va brauzer ularni bloklaydi).
  await connection();
  // Ixtiyoriy Umami (faqat ommaviy sahifalar, CSP nonce bilan) — env bo'lmasa o'chiq.
  const umami = umamiConfig();
  const nonce = umami ? (await headers()).get("x-nonce") || undefined : undefined;
  return (
    // suppressHydrationWarning: dark-mode sets `data-theme` on <html> before
    // hydration (and browser extensions inject attributes on <body>) — this keeps
    // those expected attribute differences from throwing a hydration error.
    <html lang="uz" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(jsonLd)}
        />
      </head>
      <body suppressHydrationWarning>
        <AttributionCapture />
        {umami ? <UmamiAnalytics src={umami.src} websiteId={umami.websiteId} nonce={nonce} /> : null}
        {children}
      </body>
    </html>
  );
}
