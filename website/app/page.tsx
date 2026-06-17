import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Destinations from "@/components/Destinations";
import HowItWorks from "@/components/HowItWorks";
import AppPreview from "@/components/AppPreview";
import LandingTours, { type LandingTour } from "@/components/LandingTours";
import Footer from "@/components/Footer";
import type { LandingHeroSlide } from "@/components/Hero";
import type { LandingPlace } from "@/components/Destinations";
import type { LandingAgency, LandingStory } from "@/components/AppPreview";

export const metadata: Metadata = {
  title: "TravelorAI — AI sayohat platformasi",
  description:
    "AI yordamida shaxsiy sayohatlarni rejalashtiring. Tasdiqlangan joylar, aqlli tavsiyalar, agentlik reytinglari va xarita yo‘naltirishlari — barchasi bitta platformada.",
  alternates: {
    canonical: "/",
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeApiUrl(value: string) {
  return value.replace(/\/$/, "");
}

function getServerApiUrl() {
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

type LandingData = {
  heroSlides: LandingHeroSlide[];
  places: LandingPlace[];
  agencies: LandingAgency[];
  stories: LandingStory[];
  tours: LandingTour[];
};

async function getLandingData(): Promise<LandingData> {
  try {
    const apiUrl = getServerApiUrl();
    const [homeResult, heroResult] = await Promise.allSettled([
      fetch(`${apiUrl}/home?limit=8`, {
        cache: "no-store",
      }),
      fetch(`${apiUrl}/home/hero-slides?limit=8`, {
        cache: "no-store",
      }),
    ]);

    const homeResponse = homeResult.status === "fulfilled" ? homeResult.value : null;
    const heroResponse = heroResult.status === "fulfilled" ? heroResult.value : null;
    if (!homeResponse?.ok && !heroResponse?.ok) throw new Error("Landing API failed");

    const payload = homeResponse?.ok ? await homeResponse.json() : {};
    const heroPayload = heroResponse?.ok ? await heroResponse.json() : {};
    const data = payload?.data || {};
    const directHeroSlides = Array.isArray(heroPayload?.data?.items) ? heroPayload.data.items : [];
    return {
      heroSlides: directHeroSlides.length > 0 ? directHeroSlides : Array.isArray(data.heroSlides) ? data.heroSlides : [],
      places: Array.isArray(data.places) ? data.places : [],
      agencies: Array.isArray(data.agencies) ? data.agencies : [],
      stories: Array.isArray(data.stories) ? data.stories : [],
      tours: Array.isArray(data.tours) ? data.tours : [],
    };
  } catch {
    return { heroSlides: [], places: [], agencies: [], stories: [], tours: [] };
  }
}

export default async function Home() {
  const landingData = await getLandingData();

  return (
    <>
      <Navbar />
      <main id="top" className="landing-site">
        <Hero slides={landingData.heroSlides} />
        <Destinations places={landingData.places} />
        <LandingTours tours={landingData.tours} />
        <HowItWorks />
        <AppPreview agencies={landingData.agencies} stories={landingData.stories} />
      </main>
      <Footer />
    </>
  );
}
