"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Users, CheckCircle2, Plus } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatCard, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type Stats = { totalRevenue: number; last30: number; mrr: number; activeCount: number; agencyCount: number; paymentsCount: number; byStatus: Record<string, number> };
type Sub = { id: string; name: string; city?: string; phone?: string; tariffId?: string | null; subscriptionStatus: string; subscriptionUntil?: string | null; tariff?: { id: string; name: string; priceMonthly: number } | null; totalPaid: number };
type Tariff = { id: string; name: string; priceMonthly: number };
type PayDraft = { agencyId: string; agencyName: string; tariffId: string; amount: string; periodMonths: string; method: string; note: string };

const STATUS_LABEL: Record<string, string> = { none: "Yo‘q", trial: "Sinov", active: "Faol", expired: "Muddati o‘tgan" };
const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  active: { background: "var(--primary-soft, #e7f1eb)", color: "var(--primary)" },
  trial: { background: "var(--gold-soft)", color: "#9a6a00" },
  expired: { background: "#fff1f3", color: "var(--danger)" },
  none: { background: "var(--canvas)", color: "var(--muted)" },
};
function money(n: number) { return "$" + (n || 0).toLocaleString("en-US"); }
function fmt(d?: string | null) { try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; } }

export default function BillingPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [toast, setToast] = useState("");
  const [pay, setPay] = useState<PayDraft | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, sub, trf] = await Promise.all([
        api<Stats>("/admin/billing/stats"),
        api<{ items: Sub[] }>("/admin/subscriptions"),
        api<{ items: Tariff[] }>("/admin/tariffs"),
      ]);
      setStats(s); setSubs(sub.items || []); setTariffs(trf.items || []);
    } catch (e) { setSubs([]); setToast(e instanceof Error ? e.message : "Xato"); }
  }
  useEffect(() => { void load(); }, []);

  function openPay(a: Sub) {
    const t = tariffs.find((x) => x.id === a.tariffId);
    setPay({ agencyId: a.id, agencyName: a.name, tariffId: a.tariffId || "", amount: t ? String(t.priceMonthly) : "", periodMonths: "1", method: "", note: "" });
  }

  async function submitPay() {
    if (!pay) return;
    if (!Number(pay.amount)) { setToast("Summani kiriting"); return; }
    setBusy(true);
    try {
      await api("/admin/payments", { method: "POST", body: JSON.stringify({
        agencyId: pay.agencyId, tariffId: pay.tariffId || undefined,
        amount: Number(pay.amount), periodMonths: Number(pay.periodMonths) || 1,
        method: pay.method || undefined, note: pay.note || undefined,
      }) });
      setPay(null); await load();
    } catch (e) { setToast(e instanceof Error ? e.message : "Saqlab bo‘lmadi"); }
    finally { setBusy(false); }
  }

  async function changeTariff(a: Sub, tariffId: string) {
    try { await api(`/admin/agencies/${a.id}/subscription`, { method: "PUT", body: JSON.stringify({ tariffId: tariffId || null }) }); await load(); }
    catch (e) { setToast(e instanceof Error ? e.message : "Xato"); }
  }

  const R: React.CSSProperties = { textAlign: "right" };
  if (!subs) return <Spinner />;

  return (
    <>
      <div><h1 className="adm-h1">To‘lovlar &amp; obuna</h1><p className="adm-sub">Agentliklar obunasi, tariflari va to‘lov tarixi.</p></div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, margin: "18px 0" }}>
        <StatCard icon={<Wallet size={18} />} num={money(stats?.totalRevenue || 0)} label="Jami daromad" />
        <StatCard icon={<TrendingUp size={18} />} num={money(stats?.mrr || 0)} label="MRR (oylik takror)" />
        <StatCard icon={<CheckCircle2 size={18} />} num={stats?.activeCount ?? 0} label="Faol obuna" />
        <StatCard icon={<Users size={18} />} num={stats?.agencyCount ?? 0} label="Jami agentlik" />
      </div>

      {subs.length === 0 ? <EmptyState title="Agentlik yo‘q" hint="Hamkorlar qo‘shilganda shu yerda ko‘rinadi." /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Agentlik</th><th>Tarif</th><th>Holat</th><th>Muddat</th><th style={R}>Jami to‘langan</th><th></th></tr></thead>
            <tbody>
              {subs.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.name}</b><div className="adm-table__sub">{a.city || "—"}{a.phone ? ` · ${a.phone}` : ""}</div></td>
                  <td>
                    <select value={a.tariffId || ""} onChange={(e) => void changeTariff(a, e.target.value)}
                      style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 13, background: "#fff", fontFamily: "inherit" }}>
                      <option value="">— tarifsiz —</option>
                      {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name}{t.priceMonthly ? ` ($${t.priceMonthly})` : ""}</option>)}
                    </select>
                  </td>
                  <td><span className="adm-badge" style={STATUS_STYLE[a.subscriptionStatus] || STATUS_STYLE.none}>{STATUS_LABEL[a.subscriptionStatus] || a.subscriptionStatus}</span></td>
                  <td>{fmt(a.subscriptionUntil)}</td>
                  <td style={R}><b>{money(a.totalPaid)}</b></td>
                  <td style={R}><button className="adm-btn adm-btn--sm adm-btn--gold" onClick={() => openPay(a)}><Plus size={13} /> To‘lov</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pay ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setPay(null)}>
          <div className="adm-card" style={{ width: "min(440px,100%)", padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>To‘lov qo‘shish</h2>
            <p className="adm-sub" style={{ marginBottom: 16 }}>{pay.agencyName}</p>
            <div className="adm-field"><label>Tarif</label>
              <select value={pay.tariffId} onChange={(e) => { const t = tariffs.find((x) => x.id === e.target.value); setPay({ ...pay, tariffId: e.target.value, amount: t && t.priceMonthly ? String(t.priceMonthly) : pay.amount }); }}>
                <option value="">— tanlang —</option>
                {tariffs.map((t) => <option key={t.id} value={t.id}>{t.name}{t.priceMonthly ? ` ($${t.priceMonthly}/oy)` : ""}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Summa ($)</label><input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Oy (davr)</label><input type="number" value={pay.periodMonths} onChange={(e) => setPay({ ...pay, periodMonths: e.target.value })} /></div>
            </div>
            <div className="adm-field"><label>Usul (ixtiyoriy)</label><input value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} placeholder="Payme / Click / naqd" /></div>
            <div className="adm-field"><label>Izoh (ixtiyoriy)</label><input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="adm-btn" onClick={() => setPay(null)}>Bekor</button>
              <button className="adm-btn adm-btn--primary" disabled={busy} onClick={() => void submitPay()}>{busy ? "..." : "To‘lovni qayd etish"}</button>
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={toast} />
    </>
  );
}
