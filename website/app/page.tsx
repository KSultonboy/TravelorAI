import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, MapPin, Sparkles, Wallet,
  Compass, Plane, Umbrella, Landmark, Quote, Star,
} from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import Reveal from "@/components/marketing/Reveal";
import HeroSearch from "@/components/marketing/HeroSearch";
import CountUp from "@/components/marketing/CountUp";
import TourCard from "@/components/marketing/TourCard";
import FaqAccordion from "@/components/marketing/FaqAccordion";
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

const CATEGORIES = [
  { icon: Compass, title: "Ichki turizm", text: "O‘zbekiston bo‘ylab Samarqand, Buxoro, Xiva va tabiat sayohatlari.", href: "/tours" },
  { icon: Plane, title: "Chiqish turizmi", text: "Turkiya, BAA, Misr va Yevropa — tasdiqlangan agentliklardan tayyor paketlar.", href: "/tours" },
  { icon: Umbrella, title: "Dengiz dam olish", text: "Antalya, Dubay, Maldiv va boshqa plyaj kurortlari — hordiq uchun.", href: "/tours" },
  { icon: Landmark, title: "Ekskursiya & madaniyat", text: "Tarixiy shaharlar, Ipak yo‘li merosi va madaniy dasturlar.", href: "/tours" },
];

const DESTINATIONS = [
  { name: "Samarqand", desc: "Registon maydoni va oltin gumbazlar shahri.", img: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=900&auto=format&fit=crop" },
  { name: "Buxoro", desc: "Ming yillik minoralar, Ark qal‘asi va savdo gumbazlari.", img: "https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?q=80&w=900&auto=format&fit=crop" },
  { name: "Xiva", desc: "Ichan Qal‘a — ochiq osmon ostidagi tarixiy muzey.", img: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=900&auto=format&fit=crop" },
  { name: "Toshkent", desc: "Zamonaviy poytaxt va boy tarix uyg‘unligi.", img: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=900&auto=format&fit=crop" },
];

const VALUES = [
  { icon: Sparkles, title: "AI sayohat rejasi", text: "Byudjet, sana va qiziqishlaringizga mos shaxsiy marshrutni bir zumda yaratadi." },
  { icon: BadgeCheck, title: "Tasdiqlangan agentliklar", text: "Faqat tekshirilgan turagentliklar — shaffof narx, reyting va javob muddati." },
  { icon: MapPin, title: "Aqlli marshrutlar", text: "Tasdiqlangan joylar, kun-bo‘yi reja va xarita yo‘naltirishlari bir joyda." },
  { icon: Wallet, title: "Byudjet nazorati", text: "Taxminiy xarajatlarni ko‘rib turing va uslubingizga mos tanlov qiling." },
];

const TESTIMONIALS = [
  { text: "TravelorAI orqali Turkiyaga tur topdim — narx shaffof, agentlik bilan to‘g‘ridan-to‘g‘ri gaplashdim. Juda qulay!", name: "Dilnoza R.", city: "Toshkent" },
  { text: "Bir nechta agentlikni taqqoslab, eng yaxshi Buxoro turini tanladim. Vositachisiz va bepul.", name: "Jasur K.", city: "Samarqand" },
  { text: "Agentlik sifatida mijoz so‘rovlari bevosita menga keladi — reklamaga ortiqcha pul sarflamayman.", name: "Sherzod A.", city: "Xorazm" },
];

const FAQS = [
  { q: "TravelorAI qanday ishlaydi?", a: "Turlarni ko‘rasiz, narx va muddat bo‘yicha taqqoslaysiz, so‘ng yoqqan agentlikka to‘g‘ridan-to‘g‘ri so‘rov yuborasiz. Vositachi yo‘q — agentlik siz bilan bevosita bog‘lanadi." },
  { q: "Foydalanish pullikmi?", a: "Yo‘q. Sayohatchilar uchun platforma mutlaqo bepul — turlarni ko‘rish, taqqoslash va so‘rov yuborish hech qanday to‘lovsiz." },
  { q: "Agentliklar ishonchlimi?", a: "Ha. Platformada faqat tasdiqlangan (verified) turagentliklar turlari ko‘rsatiladi — shaffof narx, reyting va javob muddati bilan." },
  { q: "Qanday bron qilaman?", a: "Yoqqan turni tanlab, ism va aloqa ma’lumotingizni qoldirasiz. So‘rovingiz to‘g‘ridan-to‘g‘ri agentlikka boradi va ular siz bilan bog‘lanadi." },
  { q: "Agentlik bo‘lib qo‘shilsam bo‘ladimi?", a: "Albatta! /partners sahifasi orqali ariza qoldiring. Tasdiqlangach o‘z kabinetingizda turlaringizni joylaysiz va bepul mijoz so‘rovlarini olasiz." },
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
            <Reveal from="scale" delay={200}>
              <HeroSearch />
            </Reveal>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head mkt-section__head--center">
            <span className="mkt-eyebrow">Yo‘nalishlar</span>
            <h2 className="mkt-h2">Sayohatingizni tanlang</h2>
            <p className="mkt-lead" style={{ margin: "14px auto 0" }}>Ichki va chiqish turizmi, dengiz dam olish yoki madaniy ekskursiya — har biriga tasdiqlangan agentliklar turlari.</p>
          </Reveal>
          <div className="mkt-cats">
            {CATEGORIES.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title} delay={i * 70} as="div">
                  <Link href={c.href} className="mkt-cat">
                    <span className="mkt-cat__icon"><Icon size={24} /></span>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                    <span className="mkt-cat__link">Ko‘rish <ArrowRight size={15} /></span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED TOURS */}
      <section className="mkt-section mkt-section--soft">
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

      {/* DESTINATIONS — curated Uzbek heritage cities */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head">
            <span className="mkt-eyebrow">Ipak yo‘li merosi</span>
            <h2 className="mkt-h2">Mashhur shaharlar</h2>
            <p className="mkt-lead">Feruza gumbazlar ostidagi asrlar tarixi — afsonaviy karvon shaharlarini kashf eting.</p>
          </Reveal>
          <div className="mkt-tiles">
            {DESTINATIONS.map((d, i) => (
              <Reveal key={d.name} delay={i * 80} as="div">
                <Link href="/tours" className="mkt-tile mkt-tile--solid">
                  <span className="mkt-tile__cap"><b>{d.name}</b><span>{d.desc}</span></span>
                </Link>
              </Reveal>
            ))}
          </div>
          {places.length > 0 ? (
            <div className="mkt-tiles" style={{ marginTop: 18 }}>
              {places.slice(0, 4).map((p, i) => (
                <Reveal key={p.id} delay={i * 80} as="div">
                  <Link href="/tours" className="mkt-tile">
                    {p.imageUrl ? <img src={publicImageSrc(p.imageUrl)} alt={p.name} loading="lazy" /> : null}
                    <span className="mkt-tile__cap"><b>{p.name}</b><span>{p.city}</span></span>
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* WHY TRAVELORAI */}
      <section className="mkt-section mkt-section--soft">
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

      {/* TESTIMONIALS */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <Reveal className="mkt-section__head mkt-section__head--center">
            <span className="mkt-eyebrow">Sharhlar</span>
            <h2 className="mkt-h2">Sayohatchilar nima deydi</h2>
          </Reveal>
          <div className="mkt-testi">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 90} as="div" className="mkt-quote">
                <Quote className="mkt-quote__mark" size={30} />
                <blockquote>{t.text}</blockquote>
                <div className="mkt-quote__cap">
                  <span className="mkt-quote__av">{t.name.charAt(0)}</span>
                  <span><b>{t.name}</b><small>{t.city}</small></span>
                  <span className="mkt-quote__stars">
                    {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={13} fill="currentColor" />)}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mkt-section mkt-section--soft">
        <div className="mkt-wrap">
          <div className="mkt-stats">
            <Reveal as="div" className="mkt-stat"><div className="mkt-stat__num"><CountUp to={Math.max(tours.length, 120)} suffix="+" /></div><div className="mkt-stat__label">Sayohat turlari</div></Reveal>
            <Reveal as="div" delay={80} className="mkt-stat"><div className="mkt-stat__num"><CountUp to={30} suffix="+" /></div><div className="mkt-stat__label">Hamkor agentliklar</div></Reveal>
            <Reveal as="div" delay={160} className="mkt-stat"><div className="mkt-stat__num"><CountUp to={5000} suffix="+" /></div><div className="mkt-stat__label">Mamnun sayohatchi</div></Reveal>
            <Reveal as="div" delay={240} className="mkt-stat"><div className="mkt-stat__num">24/7</div><div className="mkt-stat__label">Qo‘llab-quvvatlash</div></Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-faq-wrap">
            <Reveal className="mkt-section__head">
              <span className="mkt-eyebrow">Savol-javob</span>
              <h2 className="mkt-h2">Tez-tez so‘raladigan savollar</h2>
              <p className="mkt-lead">Bron va platforma haqida qisqa javoblar.</p>
            </Reveal>
            <Reveal delay={100} as="div">
              <FaqAccordion items={FAQS} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mkt-section mkt-section--soft">
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
