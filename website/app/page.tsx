import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, Sparkles, Wallet } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import Reveal from "@/components/marketing/Reveal";
import HeroSearch from "@/components/marketing/HeroSearch";
import CountUp from "@/components/marketing/CountUp";
import TourCard from "@/components/marketing/TourCard";
import { fetchTours, fetchPlaces, fetchHeroImage } from "@/lib/marketingApi";
import { publicImageSrc } from "@/lib/imageUrls";

export const metadata: Metadata = {
  title: "TravelorAI — AI sayohat platformasi",
  description:
    "Chiqish, ichki va kirish turizmini bitta platformada. Tasdiqlangan agentlik turlari, aqlli AI rejalar va ishonchli bron — TravelorAI bilan aqlli rejalashtiring.",
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALUES = [
  { icon: Sparkles, title: "AI sayohat rejasi", text: "Byudjet, sana va qiziqishlaringizga mos shaxsiy marshrutni bir zumda yaratadi." },
  { icon: BadgeCheck, title: "Tasdiqlangan agentliklar", text: "Faqat tekshirilgan turagentliklar — shaffof narx, reyting va javob muddati." },
  { icon: MapPin, title: "Aqlli marshrutlar", text: "Tasdiqlangan joylar, kun-bo‘yi reja va xarita yo‘naltirishlari bir joyda." },
  { icon: Wallet, title: "Byudjet nazorati", text: "Taxminiy xarajatlarni ko‘rib turing va uslubingizga mos tanlov qiling." },
];

/* eslint-disable @next/next/no-img-element */
export default async function HomePage() {
  const [tours, places, heroImg] = await Promise.all([fetchTours(8), fetchPlaces(8), fetchHeroImage()]);
  const heroSrc = heroImg ? publicImageSrc(heroImg) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TravelorAI",
    url: "https://travelorai.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://travelorai.com/tours?region={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <MarketingShell transparentHeader>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="mkt-hero">
        <div className="mkt-hero__bg" aria-hidden="true">
          {heroSrc ? <img src={heroSrc} alt="" /> : null}
        </div>
        <div className="mkt-hero__scrim" aria-hidden="true" />
        <div className="mkt-hero__glow" aria-hidden="true" />
        <div className="mkt-wrap">
          <div className="mkt-hero__content">
            <Reveal>
              <span className="mkt-eyebrow mkt-hero__eyebrow"><Sparkles size={14} /> AI bilan sayohat</span>
              <h1>Aqlli rejalashtiring.<br /><em>Yaxshiroq</em> sayohat qiling.</h1>
              <p className="mkt-hero__sub">
                Chiqish, ichki va kirish turizmini bitta platformada birlashtiramiz. Tasdiqlangan
                agentlik turlari, shaxsiy AI rejalar va ishonchli bron — hammasi TravelorAI’da.
              </p>
            </Reveal>
            <Reveal delay={120}>
              <HeroSearch />
            </Reveal>
          </div>
        </div>
      </section>

      {/* FEATURED TOURS */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head">
            <span className="mkt-eyebrow">Tanlangan turlar</span>
            <h2 className="mkt-h2">Mashhur sayohat paketlari</h2>
            <p className="mkt-lead">Tasdiqlangan agentliklardan eng yaxshi takliflar — narx, agentlik va javob muddati shaffof ko‘rsatilgan.</p>
          </Reveal>
          {tours.length > 0 ? (
            <div className="tgrid">
              {tours.map((t, i) => (
                <Reveal key={t.id} delay={i * 70} as="div">
                  <TourCard tour={t} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal className="mkt-vcard" style={{ textAlign: "center" }}>
              <p className="mkt-lead" style={{ margin: "0 auto" }}>Turlar tez orada qo‘shiladi. AI reja yaratish uchun ilovadan foydalaning.</p>
            </Reveal>
          )}
          <Reveal style={{ textAlign: "center", marginTop: 36 }}>
            <Link className="btn btn--navy btn--lg" href="/tours">Barcha turlar <ArrowRight size={18} /></Link>
          </Reveal>
        </div>
      </section>

      {/* POPULAR DESTINATIONS */}
      {places.length > 0 ? (
        <section className="mkt-section mkt-section--soft">
          <div className="mkt-wrap">
            <Reveal className="mkt-section__head">
              <span className="mkt-eyebrow">Yo‘nalishlar</span>
              <h2 className="mkt-h2">Mashhur joylar</h2>
              <p className="mkt-lead">Sayohatchilar eng ko‘p tanlagan yo‘nalishlar — tasdiqlangan ma’lumotlar asosida.</p>
            </Reveal>
            <div className="mkt-tiles">
              {places.slice(0, 4).map((p, i) => (
                <Reveal key={p.id} delay={i * 80} as="div">
                  <Link href="/tours" className="mkt-tile">
                    {p.imageUrl ? <img src={publicImageSrc(p.imageUrl)} alt={p.name} loading="lazy" /> : null}
                    <span className="mkt-tile__cap"><b>{p.name}</b><span>{p.city}</span></span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* WHY TRAVELORA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head mkt-section__head--center">
            <span className="mkt-eyebrow">Nega TravelorAI</span>
            <h2 className="mkt-h2">Ishonchli, tez va aqlli</h2>
          </Reveal>
          <div className="mkt-vgrid">
            {VALUES.map((v, i) => {
              const Icon = v.icon;
              return (
                <Reveal key={v.title} delay={i * 80} as="article" className="mkt-vcard">
                  <span className="mkt-vcard__icon"><Icon size={24} /></span>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mkt-section mkt-section--soft">
        <div className="mkt-wrap">
          <div className="mkt-stats">
            <Reveal as="div" className="mkt-stat"><div className="mkt-stat__num"><CountUp to={Math.max(tours.length, 120)} suffix="+" /></div><div className="mkt-stat__label">Sayohat turlari</div></Reveal>
            <Reveal as="div" delay={80} className="mkt-stat"><div className="mkt-stat__num"><CountUp to={13} suffix="+" /></div><div className="mkt-stat__label">Yo‘nalishlar</div></Reveal>
            <Reveal as="div" delay={160} className="mkt-stat"><div className="mkt-stat__num"><CountUp to={5000} suffix="+" /></div><div className="mkt-stat__label">Mamnun sayohatchi</div></Reveal>
            <Reveal as="div" delay={240} className="mkt-stat"><div className="mkt-stat__num">24/7</div><div className="mkt-stat__label">Qo‘llab-quvvatlash</div></Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-cta">
            <h2>Keyingi sayohatingizni bugun rejalashtiring</h2>
            <p>AI yordamida shaxsiy marshrut tuzing yoki tasdiqlangan agentlik turini bron qiling — bir necha daqiqada.</p>
            <Link className="btn btn--gold btn--lg" href="/tours">Turlarni ko‘rish <ArrowRight size={18} /></Link>
          </Reveal>
        </div>
      </section>
    </MarketingShell>
  );
}
