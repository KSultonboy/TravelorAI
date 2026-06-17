import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ToursBrowser from "@/components/ToursBrowser";
import type { LandingTour } from "@/components/LandingTours";
import type { LandingPlace } from "@/components/Destinations";

export const metadata: Metadata = {
  title: "Turlar",
  description:
    "Tasdiqlangan agentliklarning turlari va mashhur joylar. Yo‘nalish bo‘yicha filtrlang — bron qilish uchun hisobingizga kiring.",
  alternates: { canonical: "/tours" },
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

async function getToursData(): Promise<{ tours: LandingTour[]; places: LandingPlace[] }> {
  try {
    const apiUrl = getServerApiUrl();
    const [toursRes, placesRes] = await Promise.allSettled([
      fetch(`${apiUrl}/home/tours?agencyOnly=true&limit=60`, { cache: "no-store" }),
      fetch(`${apiUrl}/home/places?limit=24`, { cache: "no-store" }),
    ]);
    const toursPayload =
      toursRes.status === "fulfilled" && toursRes.value.ok ? await toursRes.value.json() : {};
    const placesPayload =
      placesRes.status === "fulfilled" && placesRes.value.ok ? await placesRes.value.json() : {};
    return {
      tours: Array.isArray(toursPayload?.data?.items) ? toursPayload.data.items : [],
      places: Array.isArray(placesPayload?.data?.items) ? placesPayload.data.items : [],
    };
  } catch {
    return { tours: [], places: [] };
  }
}

export default async function ToursPage() {
  const { tours, places } = await getToursData();

  return (
    <>
      <Navbar />
      <main className="landing-site tours-page">
        <ToursBrowser tours={tours} places={places} />
      </main>
      <Footer />
    </>
  );
}
