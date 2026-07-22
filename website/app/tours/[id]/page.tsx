import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, Clock3, MapPin, Plane, ShieldCheck, Star, Utensils } from "lucide-react";
import MarketingShell from "@/components/marketing/MarketingShell";
import Reveal from "@/components/marketing/Reveal";
import BookingPanel from "@/components/marketing/BookingPanel";
import { fetchTour, tourPrice, type Tour } from "@/lib/marketingApi";
import { publicImageSrc } from "@/lib/imageUrls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const tour = await fetchTour(id);
  if (!tour) return { title: "Tur topilmadi" };
  const title = tour.title;
  const description = tour.subtitle || `${tour.city} bo‘yicha tasdiqlangan agentlik turi — ${tourPrice(tour)}.`;
  const img = tour.imageUrl ? publicImageSrc(tour.imageUrl) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/tours/${id}` },
    openGraph: { title: `${title} | TravelorAI`, description, images: img ? [img] : undefined, type: "website" },
  };
}

function inclusions(tour: Tour): { icon: typeof BedDouble; label: string }[] {
  const list: { icon: typeof BedDouble; label: string }[] = [];
  if (tour.hotelIncluded) list.push({ icon: BedDouble, label: "Mehmonxona kiritilgan" });
  if (tour.flightIncluded) list.push({ icon: Plane, label: "Aviabilet kiritilgan" });
  list.push({ icon: ShieldCheck, label: "Tasdiqlangan agentlik" });
  list.push({ icon: Utensils, label: "Ovqatlanish (paketga ko‘ra)" });
  return list;
}

/* eslint-disable @next/next/no-img-element */
export default async function TourDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tour = await fetchTour(id);

  if (!tour) {
    return (
      <MarketingShell>
        <section className="mkt-section" style={{ marginTop: 72, textAlign: "center" }}>
          <div className="mkt-wrap">
            <h1 className="mkt-h2">Tur topilmadi</h1>
            <p className="mkt-lead" style={{ margin: "12px auto 24px" }}>Bu tur mavjud emas yoki o‘chirilgan bo‘lishi mumkin.</p>
            <Link className="btn btn--gold btn--lg" href="/tours">Barcha turlar</Link>
          </div>
        </section>
      </MarketingShell>
    );
  }

  const slug = tour.slug || tour.id;
  const baseImg = tour.imageUrl ? publicImageSrc(tour.imageUrl) : "";
  const gallery = (tour.images && tour.images.length > 0 ? tour.images.map(publicImageSrc) : [baseImg, baseImg, baseImg, baseImg, baseImg]).slice(0, 5);
  const rating = tour.rating || 0;
  const reviewCount = tour.reviewCount || 0;

  const canonical = `${SITE_URL}/tours/${slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: tour.title,
      description: tour.description || tour.subtitle || `${tour.city} bo‘yicha tasdiqlangan agentlik turi.`,
      image: baseImg || undefined,
      category: "Sayohat turi",
      ...(tour.agency?.name ? { brand: { "@type": "TravelAgency", name: tour.agency.name } } : {}),
      ...(rating > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating, reviewCount: Math.max(reviewCount, 1) } } : {}),
      ...(tour.priceMin
        ? {
            offers: {
              "@type": "Offer",
              price: tour.priceMin,
              priceCurrency: tour.currency || "USD",
              availability: "https://schema.org/InStock",
              url: canonical,
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Bosh sahifa", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Turlar", item: `${SITE_URL}/tours` },
        { "@type": "ListItem", position: 3, name: tour.title, item: canonical },
      ],
    },
  ];

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mkt-section" style={{ marginTop: 72, paddingTop: 32 }}>
        <div className="mkt-wrap">
          <Reveal className="mkt-gallery">
            {gallery.map((src, i) => (src ? <img key={i} src={src} alt={`${tour.title} ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} /> : <div key={i} style={{ background: "linear-gradient(135deg,#1a6b3c,#06231a)" }} />))}
          </Reveal>

          <div className="mkt-detail" style={{ marginTop: 28 }}>
            <div>
              <Reveal>
                <h1 className="mkt-detail__title">{tour.title}</h1>
                <div className="mkt-detail__loc">
                  <span><MapPin size={16} /> {tour.city}{tour.destinationCountry ? `, ${tour.destinationCountry}` : ""}</span>
                  {tour.duration ? <span><Clock3 size={15} /> {tour.duration}</span> : null}
                  <span className="rating"><Star size={15} fill="currentColor" /> {rating.toFixed(1)} {reviewCount > 0 ? `(${reviewCount} sharh)` : ""}</span>
                  {tour.agency?.name ? <span><ShieldCheck size={15} /> {tour.agency.name}</span> : null}
                </div>
              </Reveal>

              <Reveal className="mkt-detail__section">
                <h2>Tur haqida</h2>
                <p>{tour.description || tour.subtitle || "Bu tasdiqlangan agentlik turi. Batafsil ma‘lumot va shaxsiy takliflar uchun bron so‘rovini yuboring — agentligi siz bilan bog‘lanadi."}</p>
              </Reveal>

              <Reveal className="mkt-detail__section">
                <h2>Nimalar kiritilgan</h2>
                <div className="mkt-chips">
                  {inclusions(tour).map((inc) => {
                    const Icon = inc.icon;
                    return <span key={inc.label} className="chip"><Icon size={14} /> {inc.label}</span>;
                  })}
                  {(tour.priceIncludes || []).map((x) => <span key={x} className="chip chip--gold">{x}</span>)}
                </div>
              </Reveal>

              <Reveal className="mkt-detail__section">
                <h2>Paket</h2>
                <div className="mkt-pkgs">
                  <div className="mkt-pkg is-active">
                    <div><b>Standart paket</b><br /><small>{tour.duration || "Davomiylik agentligi bilan"} · {tour.city}</small></div>
                    <span className="mkt-pkg__price">{tourPrice(tour)}</span>
                  </div>
                </div>
              </Reveal>

              <Reveal className="mkt-detail__section">
                <h2>Sharhlar</h2>
                {reviewCount > 0 ? (
                  <div className="mkt-review">
                    <div className="mkt-review__top">
                      <span className="mkt-review__av">A</span>
                      <div>
                        <b>Sayohatchi</b>
                        <div className="rating"><Star size={13} fill="currentColor" /> {rating.toFixed(1)}</div>
                      </div>
                    </div>
                    <p style={{ color: "var(--muted)", margin: "10px 0 0" }}>Tasdiqlangan agentlik, ishonchli xizmat. Tavsiya qilaman.</p>
                  </div>
                ) : (
                  <p style={{ color: "var(--muted)" }}>Hali sharhlar yo‘q. Birinchi bo‘lib sayohat qiling va fikr qoldiring.</p>
                )}
              </Reveal>
            </div>

            <BookingPanel
              tourSlug={slug}
              basePrice={tour.priceMin || 0}
              currency={tour.currency || "USD"}
              priceLabel={tourPrice(tour)}
            />
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
