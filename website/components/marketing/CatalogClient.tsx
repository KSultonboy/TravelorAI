"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { REGIONS, SORT_OPTIONS, regionByKey, matchRegion, type SortKey } from "@/lib/travelData";
import { type Tour } from "@/lib/marketingApi";
import TourCard from "./TourCard";
import Reveal from "./Reveal";

function priceValue(t: Tour): number {
  if (typeof t.priceMin === "number" && t.priceMin > 0) return t.priceMin;
  const m = (t.price || "").replace(/[^\d]/g, "");
  return m ? Number(m) : Number.MAX_SAFE_INTEGER;
}

const QUICK: { label: string; sort: SortKey }[] = [
  { label: "Mashhur", sort: "rating" },
  { label: "Arzon", sort: "price_asc" },
  { label: "Qimmat", sort: "price_desc" },
];

export default function CatalogClient({ tours, initialRegion = "" }: { tours: Tour[]; initialRegion?: string }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState(initialRegion);
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");
  const [open, setOpen] = useState(false);

  const cities = useMemo(() => (region ? regionByKey(region)?.cities ?? [] : []), [region]);

  const results = useMemo(() => {
    const text = q.trim().toLowerCase();
    let list = tours.filter((t) => {
      const hay = `${t.title} ${t.city} ${t.destinationCountry || ""} ${t.subtitle || ""} ${t.agency?.name || ""}`;
      const regionOk = matchRegion(hay, region);
      const cityOk = !city || hay.toLowerCase().includes(city.toLowerCase());
      const textOk = !text || hay.toLowerCase().includes(text);
      return regionOk && cityOk && textOk;
    });
    list = [...list].sort((a, b) => {
      if (sort === "price_asc") return priceValue(a) - priceValue(b);
      if (sort === "price_desc") return priceValue(b) - priceValue(a);
      return (b.rating || 0) - (a.rating || 0);
    });
    return list;
  }, [tours, q, region, city, sort]);

  const reset = () => { setQ(""); setRegion(""); setCity(""); setSort("rating"); };

  return (
    <section className="mkt-section">
      <div className="mkt-wrap">
        <div className="mkt-catalog-layout">
          {open ? <div className="mkt-filters-backdrop" onClick={() => setOpen(false)} /> : null}

          {/* ===== LEFT FILTER SIDEBAR ===== */}
          <aside className={`mkt-filters${open ? " is-open" : ""}`} aria-label="Filtrlar">
            <div className="mkt-filters__head">
              <h3><SlidersHorizontal size={18} /> Filtrlar</h3>
              <button className="mkt-filters__close" type="button" onClick={() => setOpen(false)} aria-label="Yopish"><X size={18} /></button>
            </div>

            <div className="mkt-input">
              <Search size={17} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tur, shahar yoki agentlik..." aria-label="Qidirish" />
            </div>

            <div className="mkt-filters__group">
              <div className="mkt-filters__label">Tez tanlov</div>
              <div className="mkt-chips-wrap">
                {QUICK.map((qk) => (
                  <button key={qk.label} type="button" className={`mkt-chip-btn${sort === qk.sort ? " is-active" : ""}`} onClick={() => setSort(qk.sort)}>{qk.label}</button>
                ))}
              </div>
            </div>

            <div className="mkt-filters__group">
              <div className="mkt-filters__label">Yo‘nalish</div>
              <div className="mkt-filters__radios">
                <label className={`mkt-radio${region === "" ? " is-active" : ""}`}>
                  <input type="radio" name="region" checked={region === ""} onChange={() => { setRegion(""); setCity(""); }} />
                  <span>Barcha yo‘nalishlar</span>
                </label>
                {REGIONS.map((r) => (
                  <label key={r.key} className={`mkt-radio${region === r.key ? " is-active" : ""}`}>
                    <input type="radio" name="region" checked={region === r.key} onChange={() => { setRegion(r.key); setCity(""); }} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mkt-filters__group">
              <div className="mkt-filters__label">Shahar</div>
              <div className="mkt-input">
                <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!region} aria-label="Shahar">
                  <option value="">{region ? "Barcha shaharlar" : "Avval yo‘nalish tanlang"}</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <button className="btn btn--ghost btn--md btn--block" type="button" onClick={reset}>Filtrlarni tozalash</button>
          </aside>

          {/* ===== MAIN RESULTS ===== */}
          <div className="mkt-catalog-main">
            <div className="mkt-catalog-head">
              <p className="mkt-catalog-count"><strong>{results.length}</strong> ta natija topildi</p>
              <div className="mkt-catalog-head__actions">
                <button className="mkt-filters-toggle" type="button" onClick={() => setOpen(true)}><SlidersHorizontal size={16} /> Filtrlar</button>
                <div className="mkt-input mkt-catalog-sort">
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Saralash">
                    {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {results.length > 0 ? (
              <div className="mkt-catalog-grid">
                {results.map((t, i) => (
                  <Reveal key={t.id} delay={Math.min(i, 8) * 60} as="div"><TourCard tour={t} /></Reveal>
                ))}
              </div>
            ) : (
              <div className="mkt-vcard" style={{ textAlign: "center", maxWidth: 520, margin: "20px auto" }}>
                <h3 style={{ marginTop: 0 }}>Tur topilmadi</h3>
                <p style={{ color: "var(--muted)" }}>Filtrlarni o‘zgartiring yoki boshqa yo‘nalish tanlang.</p>
                <button className="btn btn--ghost btn--md" type="button" onClick={reset}>Filtrlarni tozalash</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
