"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Coins, Percent, Wallet } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatCard, StatusBadge, Spinner, Toast } from "@/components/admin/ui";

type Reports = {
  totalRevenue: number; commission: number; paidBookings: number; last30Days: number;
  byStatus: { status: string; count: number }[];
  topTours: { title: string; city: string; bookings: number; revenue: number }[];
  currency: string;
};

export default function ReportsPage() {
  const [r, setR] = useState<Reports | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<Reports>("/admin/reports").then(setR).catch((e) => setErr(e.message)); }, []);

  if (err) return <Toast message={err} />;
  if (!r) return <Spinner />;

  const money = (v: number) => `${(v || 0).toLocaleString("uz-UZ")} ${r.currency}`;
  const maxStatus = Math.max(1, ...r.byStatus.map((s) => s.count));

  return (
    <>
      <h1 className="adm-h1">Hisobotlar</h1>
      <p className="adm-sub">Daromad, komissiya va bron statistikasi.</p>

      <div className="adm-stats">
        <StatCard icon={<Wallet size={20} />} num={money(r.totalRevenue)} label="Umumiy daromad" />
        <StatCard icon={<Percent size={20} />} num={money(r.commission)} label="Platforma komissiyasi (5%)" />
        <StatCard icon={<Coins size={20} />} num={r.paidBookings} label="To‘langan bronlar" />
        <StatCard icon={<CalendarRange size={20} />} num={r.last30Days} label="So‘nggi 30 kun bronlari" />
      </div>

      <div className="adm-grid adm-grid--2" style={{ marginTop: 16 }}>
        <div className="adm-card" style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 800 }}>Bronlar holati bo‘yicha</h2>
          {r.byStatus.length === 0 ? <p style={{ color: "var(--muted)" }}>Ma’lumot yo‘q.</p> : r.byStatus.map((s) => (
            <div key={s.status} className="adm-bar-row">
              <StatusBadge status={s.status} />
              <span className="adm-bar"><span style={{ width: `${(s.count / maxStatus) * 100}%` }} /></span>
              <b style={{ textAlign: "right" }}>{s.count}</b>
            </div>
          ))}
        </div>

        <div className="adm-card" style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 800 }}>Top turlar</h2>
          {r.topTours.length === 0 ? <p style={{ color: "var(--muted)" }}>Hali to‘langan bron yo‘q.</p> : r.topTours.map((t, i) => (
            <div key={i} className="adm-rank">
              <span className="adm-rank__n">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block" }}>{t.title}</b>
                <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{t.city} · {t.bookings} bron</span>
              </div>
              <b style={{ color: "var(--primary)" }}>{money(t.revenue)}</b>
            </div>
          ))}
        </div>
      </div>
      <Toast message={err} />
    </>
  );
}
