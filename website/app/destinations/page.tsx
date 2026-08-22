import type { Metadata } from "next";
import Link from "next/link";
import MarketingShell from "@/components/marketing/MarketingShell";
import PageHero from "@/components/marketing/PageHero";
import Reveal from "@/components/marketing/Reveal";
import { fetchPlaces, fetchTours } from "@/lib/marketingApi";
import { REGIONS } from "@/lib/travelData";
import { publicImageSrc } from "@/lib/imageUrls";

export const metadata: Metadata = {
  title: "Yo‘nalishlar",
  description: "TravelorAI yo‘nalishlari — BAA, Turkiya, Misr, Tailand va boshqalar. Har bir yo‘nalish bo‘yicha tasdiqlangan turlar.",
  alternates: { canonical: "/destinations" },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HERO = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1920&q=70";

/* eslint-disable @next/next/no-img-element */
export default async function DestinationsPage() {
  const [places, tours] = await Promise.all([fetchPlaces(24), fetchTours(60)]);

  // Har bir region uchun tur sonini hisoblaymiz + namuna rasm.
  // Ro'yxat uzun (60+) — sahifada turi bor yo'nalishlar va mashhurlari ko'rinadi,
  // turi bori esa oldinda turadi (bo'sh kartalar bilan to'ldirib qo'ymaslik uchun).
  const regionCards = REGIONS
    .map((r) => {
      const count = tours.filter((t) => {
        const hay = `${t.title} ${t.city} ${t.destinationCountry || ""} ${t.subtitle || ""}`.toLowerCase();
        return r.match.some((m) => hay.includes(m));
      }).length;
      const place = places.find((p) => r.match.some((m) => `${p.name} ${p.city}`.toLowerCase().includes(m)));
      return { ...r, count, image: place?.imageUrl || null };
    })
    .filter((r) => r.count > 0 || r.popular)
    .sort((a, b) => b.count - a.count);

  return (
    <MarketingShell>
      <PageHero
        eyebrow="Yo‘nalishlar"
        title="Qayerga sayohat qilmoqchisiz?"
        subtitle="Tasdiqlangan agentliklarning turlari bo‘yicha eng mashhur yo‘nalishlarni tanlang."
        image={HERO}
      />
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-tiles">
            {regionCards.map((r, i) => (
              <Reveal key={r.key} delay={Math.min(i, 8) * 60} as="div">
                <Link href={`/tours?region=${r.key}`} className="mkt-tile">
                  {r.image ? <img src={publicImageSrc(r.image)} alt={r.label} loading="lazy" /> : null}
                  <span className="mkt-tile__cap">
                    <b>{r.label}</b>
                    <span>{r.count > 0 ? `${r.count} ta tur` : "Tez orada"}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
