import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, MapPin, Phone, Send, ShieldCheck, Star } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import TourCard from "@/components/marketing/TourCard";
import StorefrontLeadForm from "@/components/marketing/storefront/StorefrontLeadForm";
import { fetchStorefront, type StorefrontAgency } from "@/lib/storefrontApi";
import { publicImageSrc } from "@/lib/imageUrls";
import { jsonLdScript } from "@/lib/jsonLd";
import "../../../styles/storefront.scss";

// Agentlikning ommaviy "do'kon" sahifasi — Instagram bio / Telegram kanal havolalari
// shu yerga olib keladi. Telegram Mini App'dan farqli, istalgan brauzerda ochiladi.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com").replace(/\/$/, "");

function describe(agency: StorefrontAgency, toursCount: number) {
  const base = (agency.description || "").replace(/\s+/g, " ").trim();
  if (base) return base.length > 180 ? `${base.slice(0, 177)}…` : base;
  const city = agency.city ? `${agency.city}dagi ` : "";
  return `${city}${agency.name} — tasdiqlangan sayohat agentligi. ${toursCount ? `${toursCount} ta tur, ` : ""}so‘rov qoldiring, agentlik o‘zi bog‘lanadi.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await fetchStorefront(slug);
  // Haqiqiy 404 status (soft 404 emas) — root loading.tsx oqimidan oldin.
  if (result.kind === "missing") notFound();
  if (result.kind === "unavailable") {
    return { title: "Agentlik sahifasi", robots: { index: false, follow: true } };
  }
  const { agency, tours } = result.data;
  const description = describe(agency, tours.length);
  const img = agency.imageUrl && !agency.imageUrl.startsWith("data:")
    ? publicImageSrc(agency.imageUrl)
    : tours.find((t) => t.imageUrl && !t.imageUrl.startsWith("data:"))?.imageUrl || undefined;
  const title = `${agency.name}${agency.city ? ` — ${agency.city}` : ""} sayohat agentligi`;
  return {
    title,
    description,
    alternates: { canonical: `/a/${encodeURIComponent(agency.slug)}` },
    openGraph: {
      title: `${agency.name} | TravelorAI`,
      description,
      url: `${SITE_URL}/a/${encodeURIComponent(agency.slug)}`,
      images: img ? [publicImageSrc(img)] : undefined,
      type: "website",
    },
    twitter: { card: img ? "summary_large_image" : "summary", title: agency.name, description },
  };
}

function telHref(phone?: string | null) {
  const v = String(phone || "").replace(/[^\d+]/g, "");
  return v.length >= 7 ? `tel:${v}` : null;
}

function tgHref(handle?: string | null) {
  const v = String(handle || "").trim();
  if (!v) return null;
  if (/^https:\/\/(t\.me|telegram\.me)\//i.test(v)) return v;
  const user = v.replace(/^@/, "").replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, "");
  return /^[A-Za-z0-9_]{4,32}$/.test(user) ? `https://t.me/${user}` : null;
}

function webHref(url?: string | null) {
  const v = String(url || "").trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/* eslint-disable @next/next/no-img-element */
export default async function AgencyStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ utm_campaign?: string | string[] }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campaign = (Array.isArray(query.utm_campaign) ? query.utm_campaign[0] : query.utm_campaign) || "";
  const result = await fetchStorefront(slug);
  if (result.kind === "missing") notFound();

  if (result.kind === "unavailable") {
    // Backend vaqtincha javob bermasa — 404 emas (Google sahifani o'chirmasin),
    // foydalanuvchiga tushunarli xabar.
    return (
      <MarketingShell>
        <section className="sf-unavailable">
          <div className="mkt-wrap">
            <h1 className="sf-name">Sahifa vaqtincha ochilmadi</h1>
            <p>Agentlik ma‘lumotlarini yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.</p>
            <Link className="btn btn--navy btn--md" href="/tours">Barcha turlar</Link>
          </div>
        </section>
      </MarketingShell>
    );
  }

  const { agency, tours } = result.data;
  const url = `${SITE_URL}/a/${encodeURIComponent(agency.slug)}`;
  const logo = agency.imageUrl ? publicImageSrc(agency.imageUrl) : "";
  const rating = Number(agency.rating) || 0;
  const reviews = Number(agency.reviews) || 0;
  const tel = telHref(agency.phone);
  const tg = tgHref(agency.telegram);
  const web = webHref(agency.website);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "TravelAgency",
      name: agency.name,
      url,
      ...(agency.description ? { description: agency.description } : {}),
      ...(logo && !logo.startsWith("data:") ? { image: logo, logo } : {}),
      ...(agency.phone ? { telephone: agency.phone } : {}),
      ...(agency.city ? { address: { "@type": "PostalAddress", addressLocality: agency.city, addressCountry: "UZ" } } : {}),
      ...(rating > 0 && reviews > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating, reviewCount: reviews } } : {}),
      ...(tours.length
        ? {
            makesOffer: tours.slice(0, 30).map((t) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "TouristTrip",
                name: t.title,
                url: `${SITE_URL}/tours/${encodeURIComponent(t.slug || t.id)}`,
              },
              ...(t.priceMin
                ? { price: t.priceMin, priceCurrency: (t as typeof t & { priceCurrency?: string | null }).priceCurrency || t.currency || "USD" }
                : {}),
            })),
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Bosh sahifa", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: agency.name, item: url },
      ],
    },
  ];

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />
      <section className="sf-hero">
        <div className="mkt-wrap sf-head">
          <div className="sf-logo" aria-hidden={!logo}>
            {logo ? <img src={logo} alt={`${agency.name} logotipi`} /> : <span>{agency.name.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div>
            <h1 className="sf-name">{agency.name}</h1>
            <div className="sf-meta">
              {agency.verified ? <span className="chip"><ShieldCheck size={14} /> Tasdiqlangan agentlik</span> : null}
              {agency.city ? <span><MapPin size={15} /> {agency.city}</span> : null}
              {agency.specialty ? <span>{agency.specialty}</span> : null}
              {rating > 0 && reviews > 0 ? (
                <span className="rating"><Star size={15} fill="currentColor" /> {rating.toFixed(1)} ({reviews} sharh)</span>
              ) : null}
            </div>
            {agency.description ? <p className="sf-desc">{agency.description}</p> : null}
            <div className="sf-contacts">
              <a className="btn btn--gold btn--md" href="#sorov">So‘rov qoldirish</a>
              {tel ? <a className="btn btn--ghost btn--md" href={tel}><Phone size={16} /> Qo‘ng‘iroq</a> : null}
              {tg ? <a className="btn btn--ghost btn--md" href={tg} target="_blank" rel="noopener noreferrer"><Send size={16} /> Telegram</a> : null}
              {web ? <a className="btn btn--ghost btn--md" href={web} target="_blank" rel="noopener noreferrer nofollow"><Globe size={16} /> Sayt</a> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-section sf-body">
        <div className="mkt-wrap mkt-detail">
          <div>
            <h2 className="sf-h2">Turlar{tours.length ? ` · ${tours.length}` : ""}</h2>
            {tours.length ? (
              <div className="sf-grid">
                {tours.map((t) => <TourCard key={t.id} tour={t} />)}
              </div>
            ) : (
              <div className="sf-empty">
                Hozircha saytda e‘lon qilingan tur yo‘q. So‘rov qoldiring — {agency.name} sizga mos variantlarni o‘zi taklif qiladi.
              </div>
            )}
          </div>
          <div id="sorov">
            <StorefrontLeadForm
              agencyId={agency.id}
              agencyName={agency.name}
              tours={tours.map((t) => ({ id: t.id, slug: t.slug || null, title: t.title }))}
              initialTourId={(campaign && tours.find((t) => t.slug === campaign)?.id) || ""}
            />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
