import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock3, MapPin, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { LandingTour } from "@/components/LandingTours";
import type { LandingPlace } from "@/components/Destinations";
import { publicImageSrc } from "@/lib/imageUrls";

export const metadata: Metadata = {
  title: "Turlar",
  description:
    "Tasdiqlangan agentliklarning turlari va mashhur joylar. Ko‘rib chiqing — bron qilish uchun hisobingizga kiring.",
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
      fetch(`${apiUrl}/home/tours?agencyOnly=true&limit=30`, { cache: "no-store" }),
      fetch(`${apiUrl}/home/places?limit=12`, { cache: "no-store" }),
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

function placeMapHref(item: LandingPlace) {
  const query = [item.name, item.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default async function ToursPage() {
  const { tours, places } = await getToursData();

  return (
    <>
      <Navbar />
      <main className="landing-site tours-page">
        <section className="section">
          <div className="lp-wrap">
            <div className="section-head">
              <div>
                <p className="section-kicker">Tasdiqlangan agentlik turlari</p>
                <h2>Turlar</h2>
                <p>
                  Rasm, narx, agentlik va javob muddati — hammasi shu yerda. Ko‘rib chiqing; bron
                  qilmoqchi bo‘lsangiz hisobingizga kirishingiz so‘raladi.
                </p>
              </div>
              <Link className="landing-tours__account" href="/account">
                Mening bookinglarim
              </Link>
            </div>

            {tours.length > 0 ? (
              <div className="landing-tour-grid">
                {tours.map((tour) => (
                  <article className="landing-tour-card" key={tour.id}>
                    <div className="landing-tour-card__image">
                      {tour.imageUrl ? (
                        <Image
                          unoptimized
                          width={640}
                          height={380}
                          src={publicImageSrc(tour.imageUrl)}
                          alt={tour.title}
                        />
                      ) : (
                        <span>TravelorAI Tur</span>
                      )}
                      <b>
                        <Clock3 size={14} /> {tour.responseTimeMinutes || 45} daqiqada javob
                      </b>
                    </div>
                    <div className="landing-tour-card__body">
                      <small>
                        <MapPin size={14} /> {tour.city} · {tour.duration || "Davomiylik aniqlanadi"}
                      </small>
                      <h3>{tour.title}</h3>
                      <p>{tour.subtitle || "Tasdiqlangan agentlik turi"}</p>
                      <div className="landing-tour-card__meta">
                        <span>{tour.agency?.name || "TravelorAI hamkor"}</span>
                        <span>
                          <Star size={14} fill="currentColor" /> {(tour.rating || 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="landing-tour-card__footer">
                        <strong>
                          {tour.price || (tour.priceMin ? `$${tour.priceMin} dan` : "Narx so‘rovda")}
                        </strong>
                        <a href={`/account?tour=${encodeURIComponent(tour.slug || tour.id)}`}>
                          Bron qilish
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="landing-empty lp-reveal">
                <strong>Hozircha turlar yo‘q.</strong>
                <span>Tez orada tasdiqlangan agentliklar turlari shu yerda paydo bo‘ladi.</span>
                <Link href="/">Bosh sahifaga qaytish <ArrowRight size={15} /></Link>
              </div>
            )}
          </div>
        </section>

        {places.length > 0 ? (
          <section className="section section--soft">
            <div className="lp-wrap">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Mashhur joylar</p>
                  <h2>Joylar</h2>
                  <p>Tasdiqlangan ma’lumotlar asosida saralangan yo‘nalishlar — xaritada ko‘ring.</p>
                </div>
              </div>
              <div className="destination-cards">
                {places.map((item) => (
                  <Link
                    href={placeMapHref(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="destination-card"
                    key={item.id || item.slug || item.name}
                    style={
                      {
                        "--image": item.imageUrl
                          ? `url("${publicImageSrc(item.imageUrl)}")`
                          : "linear-gradient(135deg, #0c8b63, #101217)",
                      } as React.CSSProperties
                    }
                  >
                    <div className="destination-card__content">
                      <span className="destination-card__city">{item.city}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description || item.info || "Tasdiqlangan joy va mahalliy kontekst."}</p>
                      <div className="destination-card__meta">
                        <Star size={14} fill="currentColor" />
                        {item.rating ? `${item.rating.toFixed(1)} reyting` : "Tasdiqlangan"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
