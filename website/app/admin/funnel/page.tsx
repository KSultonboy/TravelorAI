"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CreditCard, Rocket, UserPlus } from "lucide-react";
import { api } from "@/lib/adminApi";
import { EmptyState, Spinner, StatCard, Toast } from "@/components/admin/ui";

type Step = { key: string; label: string; index: number; count: number; unique: number; conversionFromPrev: number | null };
type Headline = { windowDays: number; cohort: number; matured: number; converted: number; pct: number | null };
type Funnel = {
  days: number;
  from: string;
  to: string;
  steps: Step[];
  headline: { firstLeadWithin7d: Headline; paidWithin30d: Headline };
};

const RANGES = [7, 30, 90];

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${v}%`;
}

export default function FunnelPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setErr("");
    try {
      const res = await api<Funnel>(`/admin/funnel?days=${d}`);
      // Eski backend (endpoint yo'q) yoki kutilmagan javob — sahifa yiqilmasin.
      setData(res && Array.isArray(res.steps) ? res : null);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Voronkani yuklab bo‘lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(days), 0);
    return () => window.clearTimeout(timer);
  }, [days, load]);

  const maxUnique = Math.max(1, ...(data?.steps || []).map((s) => s.unique));
  const lead = data?.headline.firstLeadWithin7d;
  const paid = data?.headline.paidWithin30d;
  const registered = data?.steps.find((s) => s.key === "agency_registered");
  const paidStep = data?.steps.find((s) => s.key === "subscription_paid");

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="adm-h1">Mahsulot voronkasi</h1>
          <p className="adm-sub">Server tomonidagi hodisalar: landing → ro‘yxatdan o‘tish → aktivatsiya → to‘lov. Uchinchi tomon trekeri yo‘q.</p>
        </div>
        <div className="adm-actions" role="group" aria-label="Davr">
          {RANGES.map((d) => (
            <button key={d} type="button" className={`adm-btn adm-btn--sm${d === days ? " adm-btn--primary" : ""}`} aria-pressed={d === days} onClick={() => setDays(d)}>
              {d} kun
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? <Spinner /> : null}

      {!loading && !data && !err ? <EmptyState title="Ma’lumot yo‘q" hint="Backend voronka endpointini hali qo‘llab-quvvatlamaydi." /> : null}

      {data ? (
        <>
          <div className="adm-stats">
            <StatCard icon={<UserPlus size={20} />} num={registered?.unique ?? 0} label={`Yangi akkauntlar (${data.days} kun)`} />
            <StatCard icon={<Rocket size={20} />} num={pct(lead?.pct)} label="7 kun ichida birinchi lid" />
            <StatCard icon={<CalendarClock size={20} />} num={pct(paid?.pct)} label="30 kun ichida to‘lov" />
            <StatCard icon={<CreditCard size={20} />} num={paidStep?.count ?? 0} label="To‘langan obunalar" />
          </div>
          <p className="adm-sub" style={{ marginTop: 8 }}>
            Kohorta: shu davrda ro‘yxatdan o‘tgan {lead?.cohort ?? 0} ta akkaunt
            {lead ? ` (7 kundan eskisi: ${lead.matured}, 30 kundan eskisi: ${paid?.matured ?? 0})` : ""}.
            Yangi akkauntlar uchun foiz hali o‘sishi mumkin.
          </p>

          <div className="adm-card" style={{ padding: 22, marginTop: 16 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.05rem", fontWeight: 800 }}>Qadamlar</h2>
            {data.steps.map((s) => (
              <div key={s.key} className="adm-funnel-row">
                <span className="adm-funnel-row__label" title={s.key}>{s.label}</span>
                <span className="adm-bar" aria-hidden="true"><span style={{ width: `${(s.unique / maxUnique) * 100}%` }} /></span>
                <b style={{ textAlign: "right" }}>{s.unique}</b>
                <span className="adm-funnel-row__conv">{s.index === 0 ? "" : pct(s.conversionFromPrev)}</span>
              </div>
            ))}
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "12px 0 0" }}>
              Raqam — noyob agentlik/akkaunt (landing va ro‘yxatdan o‘tish boshlanishi uchun — sessiyalar). Foiz — oldingi qadamga nisbatan.
            </p>
          </div>
        </>
      ) : null}

      <style>{`
        .adm-funnel-row{display:grid;grid-template-columns:minmax(140px,220px) 1fr 56px 56px;align-items:center;gap:12px;margin-bottom:10px;font-size:.86rem}
        .adm-funnel-row__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .adm-funnel-row__conv{color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
        @media(max-width:640px){.adm-funnel-row{grid-template-columns:1fr 48px 48px}.adm-funnel-row .adm-bar{display:none}}
      `}</style>
      <Toast message={err} />
    </>
  );
}
