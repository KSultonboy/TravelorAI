import { Clock3, MapPin, Star } from "lucide-react";
import Image from "next/image";
import { publicImageSrc } from "@/lib/imageUrls";

export type LandingTour = {
  id: string;
  slug?: string | null;
  title: string;
  city: string;
  subtitle?: string;
  duration?: string;
  price?: string;
  priceMin?: number | null;
  rating?: number;
  imageUrl?: string | null;
  responseTimeMinutes?: number;
  agency?: {
    name: string;
    imageUrl?: string | null;
  } | null;
};

export default function LandingTours({ tours = [] }: { tours?: LandingTour[] }) {
  if (!tours.length) return null;

  return (
    <section className="section landing-tours" id="tours" aria-labelledby="landing-tours-title">
      <div className="lp-wrap">
        <div className="section-head">
          <div>
            <p className="section-kicker">Tasdiqlangan agentlik turlari</p>
            <h2 id="landing-tours-title">Tour tanlang va holatini kuzating</h2>
            <p>Rasm, narx, agentlik va javob muddati web hamda mobil ilovada bir xil ko‘rinadi.</p>
          </div>
          <a className="landing-tours__account" href="/account">Mening bookinglarim</a>
        </div>
        <div className="landing-tour-grid">
          {tours.slice(0, 8).map((tour) => (
            <article className="landing-tour-card" key={tour.id}>
              <div className="landing-tour-card__image">
                {tour.imageUrl ? <Image unoptimized width={640} height={380} src={publicImageSrc(tour.imageUrl)} alt={tour.title} /> : <span>TravelorAI Tour</span>}
                <b><Clock3 size={14} /> {tour.responseTimeMinutes || 45} daqiqada javob</b>
              </div>
              <div className="landing-tour-card__body">
                <small><MapPin size={14} /> {tour.city} · {tour.duration || "Davomiylik aniqlanadi"}</small>
                <h3>{tour.title}</h3>
                <p>{tour.subtitle || "Tasdiqlangan agentlik turi"}</p>
                <div className="landing-tour-card__meta">
                  <span>{tour.agency?.name || "TravelorAI partner"}</span>
                  <span><Star size={14} fill="currentColor" /> {(tour.rating || 0).toFixed(1)}</span>
                </div>
                <div className="landing-tour-card__footer">
                  <strong>{tour.price || (tour.priceMin ? `$${tour.priceMin} dan` : "Narx so‘rovda")}</strong>
                  <a href={`/account?tour=${encodeURIComponent(tour.slug || tour.id)}`}>Booking qilish</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
