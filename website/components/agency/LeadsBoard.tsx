"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { useAgencySession } from "@/lib/agency/session";
import LeadCard from "./LeadCard";

type TabKey = "new" | "active" | "archive";

const TABS: { key: TabKey; label: string; statuses: string[] }[] = [
  { key: "new", label: "Yangi", statuses: ["pending"] },
  { key: "active", label: "Qabul qilingan", statuses: ["confirmed"] },
  { key: "archive", label: "Arxiv", statuses: ["completed", "rejected", "cancelled"] },
];

export default function LeadsBoard() {
  const { bookings } = useAgencySession();
  const [tab, setTab] = useState<TabKey>("new");

  const counts = useMemo(() => {
    const map: Record<TabKey, number> = { new: 0, active: 0, archive: 0 };
    for (const booking of bookings) {
      const target = TABS.find((item) => item.statuses.includes(booking.status));
      if (target) map[target.key] += 1;
    }
    return map;
  }, [bookings]);

  const visible = useMemo(() => {
    const statuses = TABS.find((item) => item.key === tab)?.statuses || [];
    return bookings.filter((booking) => statuses.includes(booking.status));
  }, [bookings, tab]);

  return (
    <section className="agency-dashboard-section">
      <header className="agency-section-head">
        <div>
          <p className="agency-eyebrow">Lead boshqaruvi</p>
          <h2>Mijoz so&apos;rovlari</h2>
          <p className="agency-muted">
            Har bir lead — sizga to&apos;g&apos;ridan-to&apos;g&apos;ri kelgan mijoz. Tezroq javob bersangiz, ishonch oshadi.
          </p>
        </div>
      </header>

      <div className="agency-tabs" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            aria-selected={tab === key}
            className={tab === key ? "agency-tab agency-tab--active" : "agency-tab"}
            key={key}
            onClick={() => setTab(key)}
            role="tab"
            type="button"
          >
            {label}
            <span className="agency-tab__count">{counts[key]}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="agency-lead-list">
          {visible.map((booking) => (
            <LeadCard booking={booking} key={booking.id} />
          ))}
        </div>
      ) : (
        <div className="agency-empty-state">
          <Inbox size={28} />
          <p>
            {tab === "new"
              ? "Hozircha yangi lead yo'q. Tourlaringiz public bo'lsa, mijoz so'rovlari shu yerga tushadi."
              : "Bu bo'limda hozircha lead yo'q."}
          </p>
        </div>
      )}
    </section>
  );
}
