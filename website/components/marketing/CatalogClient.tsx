"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { REGIONS, SORT_OPTIONS, regionByKey, matchRegion, type SortKey } from "@/lib/travelData";
import { type Tour } from "@/lib/marketingApi";
import TourCard from "./TourCard";
import Reveal from "./Reveal";

function priceValue(t: Tour): number {
  if (typeof t.priceMin === "number" && t.priceMin > 0) return t.priceMin;
  const m = (t.price || "").replace(/[^\d]/g, "");
  return m ? Number(m) : Number.MAX_SAFE_INTEGER;
}

export default function CatalogClient({ tours, initialRegion = "" }: { tours: Tour[]; initialRegion?: string }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState(initialRegion);
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<SortKey>("rating");

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

  return (
    <>
      <div className="mkt-catalog-bar">
        <div className="mkt-wrap mkt-catalog-bar__inner">
          <div className="mkt-input mkt-catalog-bar__search">
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tur, shahar yoki agentlik bo‘yicha qidirish" aria-label="Qidirish" />
          </div>
          <div className="mkt-catalog-bar__filters">
            <div className="mkt-input">
              <SlidersHorizontal size={16} />
              <select value={region} onChange={(e) => { setRegion(e.target.value); setCity(""); }} aria-label="Yo‘nalish">
                <option value="">Barcha yo‘nalishlar</option>
                {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div className="mkt-input">
              <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!region} aria-label="Shahar">
                <option value="">{region ? "Barcha shaharlar" : "Avval yo‘nalish"}</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="mkt-input">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Saralash">
                {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <section className="mkt-section">
        <div className="mkt-wrap">
          <p className="mkt-catalog-count"><strong>{results.length}</strong> ta natija topildi</p>
          {results.length > 0 ? (
            <div className="tgrid">
              {results.map((t, i) => (
                <Reveal key={t.id} delay={Math.min(i, 8) * 60} as="div"><TourCard tour={t} /></Reveal>
              ))}
            </div>
          ) : (
            <div className="mkt-vcard" style={{ textAlign: "center", maxWidth: 520, margin: "20px auto" }}>
              <h3 style={{ marginTop: 0 }}>Tur topilmadi</h3>
              <p style={{ color: "var(--muted)" }}>Filtrlarni o‘zgartiring yoki boshqa yo‘nalish tanlang.</p>
              <button className="btn btn--ghost btn--md" type="button" onClick={() => { setQ(""); setRegion(""); setCity(""); setSort("rating"); }}>Filtrlarni tozalash</button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
