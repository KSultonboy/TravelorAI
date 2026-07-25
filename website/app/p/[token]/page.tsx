import type { Metadata } from "next";
import { Check, Clock3, MapPin, Moon, Phone, Send, X } from "lucide-react";
import PresentationActions from "@/components/marketing/PresentationActions";
import RouteMap, { type RouteStop } from "@/components/marketing/RouteMap";
import { fetchPresentation, type Presentation } from "@/lib/marketingApi";
import { publicImageSrc } from "@/lib/imageUrls";
import "../../../styles/presentation.scss";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Shaxsiy taklif — qidiruv tizimlariga tushmasin.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const p = await fetchPresentation(token);
  if (!p) return { title: "Taklif topilmadi", robots: { index: false, follow: false } };

  const agencyName = p.agency?.name || "Agentlik";
  const img = p.tour?.imageUrl ? publicImageSrc(p.tour.imageUrl) : undefined;
  return {
    title: p.title,
    description: `${agencyName} sizga shaxsiy sayohat taklifini tayyorladi.`,
    robots: { index: false, follow: false },
    openGraph: {
      title: p.title,
      description: `${agencyName} — shaxsiy sayohat taklifi`,
      images: img ? [img] : undefined,
      type: "website",
    },
  };
}

type DayPlan = { day: number; title: string; places: RouteStop[] };

function itineraryDays(itinerary: unknown): DayPlan[] {
  if (!Array.isArray(itinerary)) return [];
  const out: DayPlan[] = [];
  itinerary.forEach((row, i) => {
    if (typeof row === "string") {
      if (row.trim()) out.push({ day: i + 1, title: row.trim(), places: [] });
      return;
    }
    if (row && typeof row === "object") {
      const r = row as Record<string, unknown>;
      const title = String(r.title || r.text || r.description || "").trim();
      if (title) out.push({ day: Number(r.day) || i + 1, title, places: parseStops(r.places) });
    }
  });
  return out;
}

function parseStops(value: unknown): RouteStop[] {
  if (!Array.isArray(value)) return [];
  const out: RouteStop[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name || "").trim();
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (name && Number.isFinite(lat) && Number.isFinite(lng)) out.push({ name, lat, lng });
  }
  return out.slice(0, 12);
}

function telHref(phone?: string | null) {
  const v = String(phone || "").replace(/[^\d+]/g, "");
  return v.length >= 7 ? `tel:${v}` : null;
}

function waHref(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 9 ? `https://wa.me/${digits}` : null;
}

function tgHref(handle?: string | null) {
  const v = String(handle || "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://t.me/${v.replace(/^@/, "")}`;
}

function ContactButtons({ agency }: { agency: Presentation["agency"] }) {
  const tel = telHref(agency?.phone);
  const wa = waHref(agency?.phone);
  const tg = tgHref(agency?.telegram);
  if (!tel && !wa && !tg) return null;

  return (
    <div className="pres-actions">
      {tel ? (
        <a className="pres-btn pres-btn--call" href={tel}>
          <Phone size={17} /> Qo‘ng‘iroq qilish
        </a>
      ) : null}
      {tg ? (
        <a className="pres-btn pres-btn--tg" href={tg} target="_blank" rel="noopener noreferrer">
          <Send size={17} /> Telegram
        </a>
      ) : null}
      {wa ? (
        <a className="pres-btn pres-btn--wa" href={wa} target="_blank" rel="noopener noreferrer">
          <Phone size={17} /> WhatsApp
        </a>
      ) : null}
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */
export default async function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await fetchPresentation(token);

  if (!p) {
    return (
      <main className="pres-missing">
        <div>
          <h1>Taklif topilmadi</h1>
          <p>Bu havola eskirgan yoki o‘chirilgan bo‘lishi mumkin. Agentligingizga murojaat qiling.</p>
        </div>
      </main>
    );
  }

  const tour = p.tour;
  const agency = p.agency;
  // Asosiy rasm bo'lmasa galereyaning birinchisini olamiz — istalgan foto hero'ni jonlantiradi
  const heroImg = publicImageSrc(tour?.imageUrl || tour?.images?.[0] || "");
  const days = itineraryDays(tour?.itinerary);
  const highlights = (tour?.highlights || []).filter(Boolean);
  const includes = (tour?.priceIncludes || []).filter(Boolean);
  const excludes = (tour?.priceExcludes || []).filter(Boolean);
  const price = p.priceText || tour?.price || "";
  const location = [tour?.city, tour?.destinationCountry].filter(Boolean).join(", ");
  const about = tour?.description || tour?.subtitle || "";

  // Galereya — asosiy rasm birinchi, keyin qolganlari (takrorlanmasin)
  const gallery = [heroImg, ...(tour?.images || []).map(publicImageSrc)]
    .filter(Boolean)
    .filter((src, i, all) => all.indexOf(src) === i);

  // Xarita so'rovi: aniq manzil → mehmonxona+shahar → shahar+davlat.
  // Google matn so'rovini o'zi topadi — geokodlash ham, API kalit ham kerak emas.
  const mapQuery =
    tour?.mapAddress?.trim() ||
    (tour?.hotelName ? [tour.hotelName, tour.city].filter(Boolean).join(", ") : "") ||
    location;

  // Marshrut bo'lsa — u asosiy xarita. Nuqta xaritasi faqat agent manzilni ATAYLAB
  // kiritgan bo'lsa (mehmonxona), yoki marshrut umuman yo'q bo'lsa ko'rsatiladi.
  const routeStops = parseStops(tour?.routeStops);
  const hasRoute = routeStops.length > 0;
  const showPlaceMap = tour?.mapAddress?.trim() ? true : !hasRoute && !!mapQuery;

  const specs: { label: string; value: string }[] = [];
  if (tour?.duration) specs.push({ label: "Davomiyligi", value: tour.duration });
  if (tour?.nights) specs.push({ label: "Kechalar", value: `${tour.nights} kecha` });
  if (tour?.hotelName) {
    specs.push({
      label: "Mehmonxona",
      value: tour.hotelCategory ? `${tour.hotelName} (${tour.hotelCategory})` : tour.hotelName,
    });
  }
  if (tour?.mealPlanLabel) specs.push({ label: "Ovqatlanish", value: tour.mealPlanLabel });

  return (
    <main className="pres">
      <header className={`pres-hero ${heroImg ? "pres-hero--photo" : "pres-hero--plain"}`}>
        {heroImg ? <img className="pres-hero__photo" src={heroImg} alt={tour?.title || p.title} /> : null}
        <div className="pres-hero__inner pres-wrap">
          {agency ? (
            <div className="pres-brand">
              {agency.imageUrl ? (
                <img className="pres-brand__logo" src={publicImageSrc(agency.imageUrl)} alt="" />
              ) : (
                <span className="pres-brand__fallback" aria-hidden="true">
                  {agency.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="pres-brand__name">{agency.name}</span>
            </div>
          ) : null}

          {p.customerName ? <p className="pres-greeting">Hurmatli {p.customerName}!</p> : null}
          <h1 className="pres-title">{p.title}</h1>

          {location || tour?.duration || tour?.nights ? (
            <div className="pres-meta">
              {location ? (
                <span>
                  <MapPin size={15} /> {location}
                </span>
              ) : null}
              {tour?.duration ? (
                <span>
                  <Clock3 size={15} /> {tour.duration}
                </span>
              ) : null}
              {tour?.nights ? (
                <span>
                  <Moon size={15} /> {tour.nights} kecha
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div className="pres-wrap">
        <section className="pres-deal">
          <div>
            <div className="pres-deal__label">Siz uchun taklif narxi</div>
            <div className="pres-deal__value">{price || "Kelishilgan holda"}</div>
          </div>
          <ContactButtons agency={agency} />
        </section>

        {p.note ? (
          <section className="pres-note">
            <span className="pres-note__quote" aria-hidden="true">
              “
            </span>
            <p className="pres-note__text">{p.note}</p>
            {agency?.name ? <span className="pres-note__by">— {agency.name}</span> : null}
          </section>
        ) : null}

        {gallery.length > 1 ? (
          <section className="pres-section">
            <h2>Suratlar</h2>
            <div className="pres-gallery">
              {gallery.map((src, i) => (
                <figure key={src}>
                  <img src={src} alt={`${tour?.title || p.title} — ${i + 1}-surat`} loading="lazy" />
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        {about ? (
          <section className="pres-section">
            <h2>Sayohat haqida</h2>
            <p>{about}</p>
          </section>
        ) : null}

        {specs.length > 0 ? (
          <section className="pres-section">
            <h2>Asosiy ma‘lumotlar</h2>
            <dl className="pres-specs">
              {specs.map((s) => (
                <div className="pres-spec" key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {hasRoute ? (
          <section className="pres-section">
            <h2>Sayohat marshruti</h2>
            <RouteMap stops={routeStops} />
            <ol className="pres-route__list">
              {routeStops.map((s, i) => (
                <li key={`${s.name}-${i}`}>
                  <span className="pres-route__num">{i + 1}</span>
                  <span>{s.name}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {showPlaceMap ? (
          <section className="pres-section">
            <h2>{hasRoute ? "Mehmonxona joylashuvi" : "Joylashuv"}</h2>
            {tour?.mapAddress || tour?.hotelName ? (
              <p className="pres-map__addr">{tour?.mapAddress || tour?.hotelName}</p>
            ) : null}
            <div className="pres-map">
              <iframe
                src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&hl=uz&output=embed`}
                title={`${mapQuery} — xarita`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <a
              className="pres-map__link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={15} /> Xaritada ochish
            </a>
          </section>
        ) : null}

        {highlights.length > 0 ? (
          <section className="pres-section">
            <h2>Nimalar sizni kutmoqda</h2>
            <div className="pres-chips">
              {highlights.map((h) => (
                <span key={h}>
                  <Check size={15} /> {h}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {days.length > 0 ? (
          <section className="pres-section">
            <h2>Kun bo‘yicha reja</h2>
            <div className="pres-days">
              {days.map((d, i) => (
                <article className="pres-daycard" key={`${d.day}-${i}`}>
                  <header className="pres-daycard__head">
                    <span className="pres-daycard__num">{d.day}-kun</span>
                    <p>{d.title}</p>
                  </header>
                  {d.places.length ? (
                    <>
                      <RouteMap stops={d.places} compact />
                      <div className="pres-daycard__places">
                        {d.places.map((pl, pi) => (
                          <span key={`${pl.lat}-${pl.lng}-${pi}`}>
                            <MapPin size={13} /> {pl.name}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {includes.length > 0 ? (
          <section className="pres-section">
            <h2>Narxga kiritilgan</h2>
            <ul className="pres-list pres-list--yes">
              {includes.map((x) => (
                <li key={x}>
                  <Check size={16} /> {x}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {excludes.length > 0 ? (
          <section className="pres-section">
            <h2>Narxga kirmagan</h2>
            <ul className="pres-list pres-list--no">
              {excludes.map((x) => (
                <li key={x}>
                  <X size={16} /> {x}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="pres-cta">
          <h2>Ushbu taklif sizga mosmi?</h2>
          <p>Bir bosishda bildiring — {agency?.name || "agentlik"} siz bilan bog‘lanadi.</p>
          <PresentationActions token={token} interested={p.interested} tel={telHref(agency?.phone)} />
          <ContactButtons agency={agency} />
        </section>

        <p className="pres-foot">
          {agency?.name ? `${agency.name} tomonidan tayyorlandi · ` : ""}
          <a href="https://travelorai.com" target="_blank" rel="noopener noreferrer">
            TravelorAI
          </a>{" "}
          platformasi orqali
        </p>
      </div>
    </main>
  );
}
