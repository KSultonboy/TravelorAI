"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, Users, CheckCircle2, Plus, ShieldAlert, Star, Zap } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatCard, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type Stats = { totalRevenue: number; last30: number; mrr: number; activeCount: number; agencyCount: number; paymentsCount: number; byStatus: Record<string, number> };
type Sub = { id: string; name: string; city?: string; phone?: string; tariffId?: string | null; subscriptionStatus: string; subscriptionUntil?: string | null; tariff?: { id: string; name: string; priceMonthly: number } | null; totalPaid: number };
type Tariff = { id: string; name: string; priceMonthly: number };
type PayDraft = { agencyId: string; agencyName: string; tariffId: string; amount: string; periodMonths: string; paidAt: string; method: string; note: string };

type Overview = {
  totalClickUzs: number; last7ClickUzs: number; last30ClickUzs: number;
  agencyClickUzs: number; userClickUzs: number; agencyManualUsd: number;
  activePremiumUsers: number; paidClickTxCount: number;
  staleOpenClickTxCount: number;
  failedActivations: { merchantTransId: string; payerType: string; amount: number; errorNote: string; paidAt: string }[];
};
type ClickTx = {
  id: string; merchantTransId: string; payerType: string; agencyId?: string | null; userId?: string | null;
  planSlug?: string | null; tariffSlug?: string | null; amount: number; months: number; state: string;
  errorNote?: string | null; createdAt: string; paidAt?: string | null; payerName?: string | null;
};
type UserPay = { id: string; userEmail?: string | null; planSlug?: string | null; amount: number; currency: string; periodMonths: number; method?: string | null; paidAt: string };

const CLICK_STATE_LABEL: Record<string, string> = { created: "Yaratilgan", prepared: "Tayyorlangan", paid: "To‘langan", cancelled: "Bekor qilingan" };
const CLICK_STATE_STYLE: Record<string, { background: string; color: string }> = {
  created: { background: "var(--canvas)", color: "var(--muted)" },
  prepared: { background: "var(--gold-soft)", color: "#9a6a00" },
  paid: { background: "#e9f9f1", color: "var(--success)" },
  cancelled: { background: "#fff1f3", color: "var(--danger)" },
};
function somUzs(n: number) { return Math.round(n || 0).toLocaleString("uz-UZ") + " so‘m"; }

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

  const [overview, setOverview] = useState<Overview | null>(null);
  const [clickTx, setClickTx] = useState<ClickTx[] | null>(null);
  const [clickFilter, setClickFilter] = useState<"" | "agency" | "user">("");
  const [userPays, setUserPays] = useState<UserPay[] | null>(null);

  async function load() {
    try {
      const [s, sub, trf] = await Promise.all([
        api<Stats>("/admin/billing/stats"),
        api<{ items: Sub[] }>("/admin/subscriptions"),
        api<{ items: Tariff[] }>("/admin/tariffs"),
      ]);
      setStats(s); setSubs(sub.items || []); setTariffs(trf.items || []);
    } catch (e) { setSubs([]); setToast(e instanceof Error ? e.message : "Xato"); }

    try {
      const [ov, up] = await Promise.all([
        api<Overview>("/admin/payments-overview"),
        api<{ items: UserPay[] }>("/admin/user-payments"),
      ]);
      setOverview(ov); setUserPays(up.items || []);
    } catch (e) { setToast(e instanceof Error ? e.message : "Xato"); }
  }

  async function loadClickTx(payerType: "" | "agency" | "user") {
    try {
      const qs = payerType ? `?payerType=${payerType}&take=100` : "?take=100";
      const res = await api<{ items: ClickTx[] }>(`/admin/click-transactions${qs}`);
      setClickTx(res.items || []);
    } catch (e) { setToast(e instanceof Error ? e.message : "Xato"); }
  }

  useEffect(() => { void load(); void loadClickTx(""); }, []);

  function openPay(a: Sub) {
    const t = tariffs.find((x) => x.id === a.tariffId);
    setPay({ agencyId: a.id, agencyName: a.name, tariffId: a.tariffId || "", amount: t ? String(t.priceMonthly) : "", periodMonths: "1", paidAt: new Date().toISOString().slice(0, 10), method: "", note: "" });
  }

  async function submitPay() {
    if (!pay) return;
    if (!Number(pay.amount)) { setToast("Summani kiriting"); return; }
    setBusy(true);
    try {
      await api("/admin/payments", { method: "POST", body: JSON.stringify({
        agencyId: pay.agencyId, tariffId: pay.tariffId || undefined,
        amount: Number(pay.amount), periodMonths: Number(pay.periodMonths) || 1,
        paidAt: pay.paidAt || undefined,
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
        <StatCard icon={<Wallet size={18} />} num={money(stats?.totalRevenue || 0)} label="Jami daromad (qo‘lda + agentlik)" />
        <StatCard icon={<TrendingUp size={18} />} num={money(stats?.mrr || 0)} label="MRR (oylik takror)" />
        <StatCard icon={<CheckCircle2 size={18} />} num={stats?.activeCount ?? 0} label="Faol obuna (agentlik)" />
        <StatCard icon={<Users size={18} />} num={stats?.agencyCount ?? 0} label="Jami agentlik" />
      </div>

      <div style={{ margin: "26px 0 10px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>CLICK aylanmasi</h2>
        <p className="adm-sub" style={{ margin: "2px 0 0" }}>Real onlayn to‘lovlar — agentlik tariflari + traveler Premium, ilova va sayt birga.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 18 }}>
        <StatCard icon={<Zap size={18} />} num={somUzs(overview?.totalClickUzs || 0)} label="Jami CLICK aylanma" />
        <StatCard icon={<TrendingUp size={18} />} num={somUzs(overview?.last30ClickUzs || 0)} label="Oxirgi 30 kun" />
        <StatCard icon={<Star size={18} />} num={somUzs(overview?.userClickUzs || 0)} label="— shundan Premium (user)" />
        <StatCard icon={<Users size={18} />} num={somUzs(overview?.agencyClickUzs || 0)} label="— shundan agentlik" />
        <StatCard icon={<CheckCircle2 size={18} />} num={overview?.activePremiumUsers ?? 0} label="Faol Premium foydalanuvchi" />
        <StatCard icon={<ShieldAlert size={18} />} num={overview?.failedActivations.length ?? 0} label="Faollashtirish xatoligi" />
      </div>

      {overview && overview.failedActivations.length > 0 ? (
        <div className="adm-card" style={{ padding: 16, marginBottom: 18, border: "1px solid #ffd0d6", background: "#fff8f8" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: "var(--danger)", marginBottom: 8 }}>
            <ShieldAlert size={18} /> Diqqat: pul olingan, lekin xizmat ochilmagan ({overview.failedActivations.length})
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
            Bu tranzaksiyalarda CLICK to‘lovni tasdiqlagan, lekin obunani faollashtirishda server xatosi bo‘lgan.
            Pulni qaytarib berish shart emas — qo‘lda faollashtiring (Tarif/Premium bo‘limidan) va sababini tekshiring.
          </p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Buyurtma</th><th>Turi</th><th style={{ textAlign: "right" }}>Summa</th><th>Xato</th><th>Sana</th></tr></thead>
              <tbody>
                {overview.failedActivations.map((f) => (
                  <tr key={f.merchantTransId}>
                    <td><code>{f.merchantTransId}</code></td>
                    <td>{f.payerType === "user" ? "Premium" : "Agentlik"}</td>
                    <td style={{ textAlign: "right" }}>{somUzs(f.amount)}</td>
                    <td style={{ fontSize: 12, color: "var(--danger)" }}>{f.errorNote}</td>
                    <td>{fmt(f.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {overview && overview.staleOpenClickTxCount > 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 18px" }}>
          {overview.staleOpenClickTxCount} ta tranzaksiya 30 daqiqadan beri &quot;yaratilgan/tayyorlangan&quot; holatda qolgan
          (foydalanuvchi to‘lovni tashlab ketgan bo‘lishi mumkin — normal holat, kuzatish uchun).
        </p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "26px 0 10px", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>CLICK tranzaksiyalari</h2>
          <p className="adm-sub" style={{ margin: "2px 0 0" }}>Barcha urinishlar (audit) — muvaffaqiyatsizlarni ham ko‘rsatadi.</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["", "agency", "user"] as const).map((f) => (
            <button
              key={f || "all"}
              type="button"
              className={`adm-btn adm-btn--sm ${clickFilter === f ? "adm-btn--primary" : ""}`}
              onClick={() => { setClickFilter(f); void loadClickTx(f); }}
            >
              {f === "" ? "Barchasi" : f === "agency" ? "Agentlik" : "Premium"}
            </button>
          ))}
        </div>
      </div>

      {!clickTx ? <Spinner /> : clickTx.length === 0 ? (
        <EmptyState title="Tranzaksiya yo‘q" hint="CLICK orqali hali to‘lov bo‘lmagan." />
      ) : (
        <div className="adm-table-wrap" style={{ marginBottom: 26 }}>
          <table className="adm-table">
            <thead><tr><th>Buyurtma</th><th>Kim</th><th>Turi</th><th style={R}>Summa</th><th>Holat</th><th>Sana</th></tr></thead>
            <tbody>
              {clickTx.map((t) => (
                <tr key={t.id}>
                  <td><code style={{ fontSize: 12 }}>{t.merchantTransId}</code></td>
                  <td>{t.payerName || "—"}</td>
                  <td>{t.payerType === "user" ? "Premium" : "Agentlik"}</td>
                  <td style={R}>{somUzs(t.amount)} · {t.months} oy</td>
                  <td><span className="adm-badge" style={CLICK_STATE_STYLE[t.state] || CLICK_STATE_STYLE.created}>{CLICK_STATE_LABEL[t.state] || t.state}</span></td>
                  <td>{fmt(t.paidAt || t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ margin: "0 0 10px" }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Premium to‘lovlar (foydalanuvchilar)</h2>
        <p className="adm-sub" style={{ margin: "2px 0 0" }}>Ilovada yoki saytda to‘langan — akkaunt bitta, qayerdan to‘lansa ham shu yerda ko‘rinadi.</p>
      </div>
      {!userPays ? <Spinner /> : userPays.length === 0 ? (
        <EmptyState title="Premium to‘lov yo‘q" hint="Foydalanuvchi hali obuna bo‘lmagan." />
      ) : (
        <div className="adm-table-wrap" style={{ marginBottom: 26 }}>
          <table className="adm-table">
            <thead><tr><th>Foydalanuvchi</th><th>Plan</th><th style={R}>Summa</th><th>Davr</th><th>Usul</th><th>Sana</th></tr></thead>
            <tbody>
              {userPays.map((p) => (
                <tr key={p.id}>
                  <td>{p.userEmail || "—"}</td>
                  <td>{p.planSlug || "premium"}</td>
                  <td style={R}><b>{somUzs(p.amount)}</b></td>
                  <td>{p.periodMonths} oy</td>
                  <td>{(p.method || "click").toUpperCase()}</td>
                  <td>{fmt(p.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
          <div className="adm-card" style={{ width: "min(440px,100%)", padding: 22, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
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
            <div className="adm-field"><label>To‘lov sanasi</label><input type="date" value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} /></div>
            <p style={{ margin: "-6px 0 14px", fontSize: 12, color: "var(--muted)" }}>Obuna shu sanadan {pay.periodMonths || 1} oyga hisoblanadi. Muddat tugagach agentlik avtomatik faqat o‘qish rejimiga o‘tadi, keyingi to‘lovda o‘zi qayta ochiladi — qo‘lда hech narsa qilish shart emas.</p>
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
