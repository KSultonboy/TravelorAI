"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Search, Users } from "lucide-react";
import { REGION_GROUPS } from "@/lib/travelData";

export default function HeroSearch() {
  const router = useRouter();
  const [region, setRegion] = useState("");
  const [date, setDate] = useState("");
  const [travelers, setTravelers] = useState("2");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (date) params.set("date", date);
    if (travelers) params.set("travelers", travelers);
    router.push(`/tours${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form className="mkt-search" onSubmit={submit} aria-label="Sayohat qidirish">
      <div className="mkt-search__field">
        <MapPin size={18} />
        <div style={{ flex: 1 }}>
          <label htmlFor="hs-region">Qayerga</label>
          <select id="hs-region" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Yo‘nalish tanlang</option>
            {REGION_GROUPS.filter((g) => g.regions.length > 0).map((g) => (
              <optgroup key={g.group} label={g.label}>
                {g.regions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="mkt-search__field">
        <CalendarDays size={18} />
        <div style={{ flex: 1 }}>
          <label htmlFor="hs-date">Sana</label>
          <input id="hs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="mkt-search__field">
        <Users size={18} />
        <div style={{ flex: 1 }}>
          <label htmlFor="hs-travelers">Sayohatchilar</label>
          <select id="hs-travelers" value={travelers} onChange={(e) => setTravelers(e.target.value)}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} kishi</option>)}
          </select>
        </div>
      </div>
      <button className="btn btn--gold btn--lg" type="submit"><Search size={18} /> Qidirish</button>
    </form>
  );
}
