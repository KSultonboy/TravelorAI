"use client";

import Link from "next/link";
import { Clock3, Heart, MapPin, Star } from "lucide-react";
import { type Tour, tourPrice } from "@/lib/marketingApi";
import { publicImageSrc } from "@/lib/imageUrls";
import { useWishlist } from "./WishlistProvider";

/* eslint-disable @next/next/no-img-element */
export default function TourCard({ tour }: { tour: Tour }) {
  const href = `/tours/${encodeURIComponent(tour.slug || tour.id)}`;
  const { enabled, has, toggle } = useWishlist();
  const saved = has(tour.id);
  const rating = Number(tour.rating) || 0;
  const hasRating = rating > 0;
  // Backend kiritilmagan javob vaqtini 45 deb to'ldiradi (formatTour) — 45 ni
  // ham "noma'lum" deb hisoblaymiz, chunki uni agentlik tasdiqlamagan.
  const responseMinutes = tour.responseTimeMinutes && tour.responseTimeMinutes !== 45 ? tour.responseTimeMinutes : 0;

  return (
    <Link href={href} className="tcard">
      <div className="tcard__media">
        {tour.imageUrl ? <img src={publicImageSrc(tour.imageUrl)} alt={tour.title} loading="lazy" /> : null}
        <span className="badge">{tour.agency?.name || "TravelorAI"}</span>
        {enabled ? (
          <button
            type="button"
            className={`tcard__heart${saved ? " is-active" : ""}`}
            aria-label={saved ? "Saqlanganlardan olib tashlash" : "Saqlash"}
            aria-pressed={saved}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(tour.id); }}
          >
            <Heart size={17} fill={saved ? "currentColor" : "none"} />
          </button>
        ) : null}
      </div>
      <div className="tcard__body">
        <span className="tcard__loc"><MapPin size={14} /> {tour.city}{tour.duration ? ` · ${tour.duration}` : ""}</span>
        <h3 className="tcard__title">{tour.title}</h3>
        <p className="tcard__desc">{tour.subtitle || "Tasdiqlangan agentlik turi"}</p>
        {/* Faqat haqiqiy ma'lumot: reyting bo'lmasa "0.0", javob vaqti
            kiritilmagan bo'lsa soxta "45 daqiqa" ko'rsatilmaydi. */}
        {hasRating || responseMinutes ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {hasRating ? <span className="rating"><Star size={14} fill="currentColor" /> {rating.toFixed(1)}</span> : null}
            {responseMinutes ? <span className="tcard__loc"><Clock3 size={13} /> {responseMinutes} daqiqada javob</span> : null}
          </div>
        ) : null}
        <div className="tcard__foot">
          <span className="tcard__price">{tourPrice(tour)}</span>
          <span className="btn btn--gold btn--md" style={{ pointerEvents: "none" }}>Ko‘rish</span>
        </div>
      </div>
    </Link>
  );
}
