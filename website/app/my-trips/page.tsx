import type { Metadata } from "next";
import { Suspense } from "react";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import MyTripsClient from "@/components/marketing/MyTripsClient";

export const metadata: Metadata = {
  title: "Mening safarlarim",
  description: "TravelorAI bronlaringiz va sayohatlaringiz.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/my-trips" },
};

const HERO = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=70";

export default function MyTripsPage() {
  return (
    <MarketingShell>
      <PageHero eyebrow="Shaxsiy kabinet" title="Mening safarlarim" subtitle="Bronlaringiz holati, sanalar va to'lov ma'lumotlari — mobil ilova bilan sinxron." image={HERO} />
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Suspense fallback={null}>
            <MyTripsClient />
          </Suspense>
        </div>
      </section>
    </MarketingShell>
  );
}
