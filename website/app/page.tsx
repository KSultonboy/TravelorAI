import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Destinations from "@/components/Destinations";
import HowItWorks from "@/components/HowItWorks";
import AppPreview from "@/components/AppPreview";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";
import type { LandingHeroSlide } from "@/components/Hero";
import type { LandingPlace } from "@/components/Destinations";
import type { LandingAgency, LandingStory } from "@/components/AppPreview";

export const metadata: Metadata = {
  title: "TravelorAI - Global AI travel platform",
  description:
    "Plan personal trips around the world with AI. Verified places, smart recommendations, agency rankings and seamless map redirects in one platform.",
  alternates: {
    canonical: "/",
  },
};

export const revalidate = 60;

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://travelorai.com/api/v1").replace(/\/$/, "");

type LandingData = {
  heroSlides: LandingHeroSlide[];
  places: LandingPlace[];
  agencies: LandingAgency[];
  stories: LandingStory[];
};

async function getLandingData(): Promise<LandingData> {
  try {
    const response = await fetch(`${API_URL}/home?limit=8`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) throw new Error("Landing API failed");
    const payload = await response.json();
    const data = payload?.data || {};
    return {
      heroSlides: Array.isArray(data.heroSlides) ? data.heroSlides : [],
      places: Array.isArray(data.places) ? data.places : [],
      agencies: Array.isArray(data.agencies) ? data.agencies : [],
      stories: Array.isArray(data.stories) ? data.stories : [],
    };
  } catch {
    return { heroSlides: [], places: [], agencies: [], stories: [] };
  }
}

export default async function Home() {
  const landingData = await getLandingData();

  return (
    <>
      <ScrollReveal />
      <Navbar />
      <main id="top" className="landing-site">
        <Hero slides={landingData.heroSlides} />
        <Destinations places={landingData.places} />
        <HowItWorks />
        <AppPreview agencies={landingData.agencies} stories={landingData.stories} />
      </main>
      <Footer />
    </>
  );
}
