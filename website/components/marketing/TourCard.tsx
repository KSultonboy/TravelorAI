import Link from "next/link";
import { Clock3, MapPin, Star } from "lucide-react";
import { type Tour, tourPrice } from "@/lib/marketingApi";
import { publicImageSrc } from "@/lib/imageUrls";

/* eslint-disable @next/next/no-img-element */
export default function TourCard({ tour }: { tour: Tour }) {
  const href = `/tours/${encodeURIComponent(tour.slug || tour.id)}`;
  return (
    <Link href={href} className="tcard">
      <div className="tcard__media">
        {tour.imageUrl ? <img src={publicImageSrc(tour.imageUrl)} alt={tour.title} loading="lazy" /> : null}
        <span className="badge">{tour.agency?.name || "TravelorAI"}</span>
      </div>
      <div className="tcard__body">
        <span className="tcard__loc"><MapPin size={14} /> {tour.city}{tour.duration ? ` · ${tour.duration}` : ""}</span>
        <h3 className="tcard__title">{tour.title}</h3>
        <p className="tcard__desc">{tour.subtitle || "Tasdiqlangan agentlik turi"}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="rating"><Star size={14} fill="currentColor" /> {(tour.rating || 0).toFixed(1)}</span>
          <span className="tcard__loc"><Clock3 size={13} /> {tour.responseTimeMinutes || 45} daqiqada javob</span>
        </div>
        <div className="tcard__foot">
          <span className="tcard__price">{tourPrice(tour)}</span>
          <span className="btn btn--gold btn--md" style={{ pointerEvents: "none" }}>Ko‘rish</span>
        </div>
      </div>
    </Link>
  );
}
