"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock3, MapPin, Search, Star } from "lucide-react";
import type { LandingTour } from "@/components/LandingTours";
import type { LandingPlace } from "@/components/Destinations";
import { publicImageSrc } from "@/lib/imageUrls";

// Mobil ilovadagi (tours.tsx) bilan bir xil — agentlik formasidagi DESTINATION_OPTIONS ga mos.
const COUNTRY_OPTIONS: { key: string; label: string; match: string[] }[] = [
  { key: "all", label: "Barchasi", match: [] },
  { key: "uae", label: "BAA (Dubay)", match: ["baa", "dubai", "dubay", "uae", "emirat", "abu dhabi", "abu-dhabi"] },
  { key: "turkey", label: "Turkiya", match: ["turkiya", "turkey", "turk", "antalya", "istanbul", "stambul", "bodrum"] },
  { key: "egypt", label: "Misr", match: ["misr", "egypt", "sharm", "hurghada"] },
  { key: "saudi", label: "Saudiya Arabistoni", match: ["saudiya", "saudi", "makka", "madina", "umra", "umrah", "hajj", "haj"] },
  { key: "thailand", label: "Tailand", match: ["tailand", "thailand", "phuket", "bangkok", "pattaya"] },
  { key: "maldives", label: "Maldiv orollari", match: ["maldiv", "maldive"] },
  { key: "georgia", label: "Gruziya", match: ["gruziya", "georgia", "batumi", "tbilisi"] },
  { key: "malaysia", label: "Malayziya", match: ["malayziya", "malaysia", "kuala"] },
  { key: "indonesia", label: "Indoneziya (Bali)", match: ["indoneziya", "indonesia", "bali", "jakarta"] },
  { key: "qatar", label: "Qatar", match: ["qatar", "doha"] },
  { key: "azerbaijan", label: "Ozarbayjon", match: ["ozarbayjon", "azerbaijan", "baku", "boku"] },
  { key: "europe", label: "Yevropa", match: ["yevropa", "europe", "parij", "paris", "rim", "rome", "london", "barcelona", "praga"] },
];

function placeMapHref(item: LandingPlace) {
  const query = [item.name, item.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function ToursBrowser({
  tours = [],
  places = [],
}: {
  tours?: LandingTour[];
  places?: LandingPlace[];
}) {
  const [country, setCountry] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");

  const filteredTours = useMemo(() => {
    const opt = COUNTRY_OPTIONS.find((o) => o.key === country);
    const q = search.trim().toLowerCase();
    return tours.filter((t) => {
      const hay = `${t.title} ${t.city} ${t.destinationCountry || ""} ${t.subtitle || ""} ${
        t.agency?.name || ""
      }`.toLowerCase();
      const countryOk = !opt || opt.key === "all" || opt.match.length === 0 || opt.match.some((m) => hay.includes(m));
      const searchOk = !q || hay.includes(q);
      return countryOk && searchOk;
    });
  }, [tours, country, search]);

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) =>
      `${p.name} ${p.city} ${p.description || ""}`.toLowerCase().includes(q)
    );
  }, [places, search]);

  function applySearch() {
    setSearch(searchDraft);
  }

  return (
    <>
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

          {/* Filtrlar */}
          <div className="tours-filter">
            <div className="tours-filter__search">
              <Search size={16} />
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Tur, shahar yoki agentlik bo‘yicha qidirish"
                aria-label="Turlarni qidirish"
              />
              <button type="button" onClick={applySearch}>
                Qidirish
              </button>
            </div>
            <div className="tours-filter__label">Qayerga</div>
            <div className="tours-filter__chips">
              {COUNTRY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={opt.key === country ? "is-active" : ""}
                  onClick={() => setCountry(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTours.length > 0 ? (
            <div className="landing-tour-grid">
              {filteredTours.map((tour) => (
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
            <div className="landing-empty">
              <strong>Bu filtr bo‘yicha tur topilmadi.</strong>
              <span>Boshqa yo‘nalish tanlang yoki qidiruvni o‘zgartiring.</span>
              <button
                type="button"
                className="tours-filter__reset"
                onClick={() => {
                  setCountry("all");
                  setSearch("");
                  setSearchDraft("");
                }}
              >
                Filtrlarni tozalash <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </section>

      {filteredPlaces.length > 0 ? (
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
              {filteredPlaces.map((item) => (
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
    </>
  );
}
