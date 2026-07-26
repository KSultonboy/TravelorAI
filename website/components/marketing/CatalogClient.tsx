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

function dayCount(t: Tour): number {
  if (typeof t.days === "number" && t.days > 0) return t.days;
  const m = (t.duration || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}
function durBucket(d: number): "1-3" | "4-7" | "7+" {
  return d <= 3 ? "1-3" : d <= 7 ? "4-7" : "7+";
}
const DURATIONS: { key: string; label: string }[] = [
  { key: "1-3", label: "1–3 kun" },
  { key: "4-7", label: "4–7 kun" },
  { key: "7+", label: "7+ kun" },
];

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
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [durs, setDurs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [allRegions, setAllRegions] = useState(false);

  const cities = useMemo(() => (region ? regionByKey(region)?.cities ?? [] : []), [region]);

  /* Yo'nalish ro'yxati uzun (60+). Filtrda faqat KERAKLISI ko'rinadi:
     turi bor yo'nalishlar + mashhurlar. Qolganini «Barchasini ko'rsatish» ochadi. */
  const regionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tours) {
      const hay = `${t.title} ${t.city} ${t.destinationCountry || ""} ${t.subtitle || ""} ${t.agency?.name || ""}`;
      for (const r of REGIONS) if (matchRegion(hay, r.key)) map.set(r.key, (map.get(r.key) || 0) + 1);
    }
    return map;
  }, [tours]);

  const shownRegions = useMemo(() => {
    if (allRegions) return REGIONS;
    return REGIONS.filter((r) => r.popular || (regionCounts.get(r.key) || 0) > 0 || r.key === region);
  }, [allRegions, regionCounts, region]);

  const bounds = useMemo(() => {
    const vals = tours.map(priceValue).filter((v) => v > 0 && v < Number.MAX_SAFE_INTEGER);
    return { min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 5000 };
  }, [tours]);
  const effMax = maxPrice ?? bounds.max;

  const results = useMemo(() => {
    const text = q.trim().toLowerCase();
    let list = tours.filter((t) => {
      const hay = `${t.title} ${t.city} ${t.destinationCountry || ""} ${t.subtitle || ""} ${t.agency?.name || ""}`;
      const regionOk = matchRegion(hay, region);
      const cityOk = !city || hay.toLowerCase().includes(city.toLowerCase());
      const textOk = !text || hay.toLowerCase().includes(text);
      const pv = priceValue(t);
      const priceOk = pv === Number.MAX_SAFE_INTEGER || pv <= effMax;
      const dc = dayCount(t);
      const durOk = durs.length === 0 || (dc > 0 && durs.includes(durBucket(dc)));
      return regionOk && cityOk && textOk && priceOk && durOk;
    });
    list = [...list].sort((a, b) => {
      if (sort === "price_asc") return priceValue(a) - priceValue(b);
      if (sort === "price_desc") return priceValue(b) - priceValue(a);
      return (b.rating || 0) - (a.rating || 0);
    });
    return list;
  }, [tours, q, region, city, sort, effMax, durs]);

  const reset = () => { setQ(""); setRegion(""); setCity(""); setSort("rating"); setMaxPrice(null); setDurs([]); };

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
                {shownRegions.map((r) => {
                  const n = regionCounts.get(r.key) || 0;
                  return (
                    <label key={r.key} className={`mkt-radio${region === r.key ? " is-active" : ""}`}>
                      <input type="radio" name="region" checked={region === r.key} onChange={() => { setRegion(r.key); setCity(""); }} />
                      <span>{r.label}</span>
                      {n > 0 ? <em className="mkt-radio__n">{n}</em> : null}
                    </label>
                  );
                })}
              </div>
              {REGIONS.length > shownRegions.length || allRegions ? (
                <button type="button" className="mkt-more-btn" onClick={() => setAllRegions((v) => !v)}>
                  {allRegions ? "Kamroq ko‘rsatish" : `Barcha yo‘nalishlar (${REGIONS.length})`}
                </button>
              ) : null}
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

            <div className="mkt-filters__group">
              <div className="mkt-filters__label">Byudjet</div>
              <div className="mkt-range-labels">
                <span>${bounds.min.toLocaleString()}</span>
                <span className="mkt-range-val">${effMax.toLocaleString()}{effMax >= bounds.max ? "+" : ""}</span>
              </div>
              <input
                type="range"
                className="mkt-range"
                min={bounds.min}
                max={bounds.max}
                step={50}
                value={effMax}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                aria-label="Maksimal narx"
              />
            </div>

            <div className="mkt-filters__group">
              <div className="mkt-filters__label">Davomiylik</div>
              {DURATIONS.map((d) => (
                <label key={d.key} className="mkt-check">
                  <input
                    type="checkbox"
                    checked={durs.includes(d.key)}
                    onChange={() => setDurs((p) => (p.includes(d.key) ? p.filter((x) => x !== d.key) : [...p, d.key]))}
                  />
                  <span>{d.label}</span>
                </label>
              ))}
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
