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
