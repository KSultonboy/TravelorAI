"use client";

import { useState } from "react";
import { agencyApi } from "@/lib/agency/api";
import { useAgencyData } from "./useAgencyData";
import {
  CURRENCIES, DANGER, ERR_STYLE, PAYMENT_METHODS, fmtAmount, fmtDay, todayIso,
  type Instalment, type InstalmentListData, type PlanPreviewRow,
} from "./api";

type LeadLike = { id: string; customerName: string; totalEstimate?: number | null; currency?: string | null };

const box: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginTop: 10 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 };
const fld: React.CSSProperties = { marginBottom: 0 };

function statusBadge(row: Instalment) {
  if (row.status === "paid") return <span className="badge2 b-green">To‘landi{row.paidAt ? ` · ${fmtDay(row.paidAt)}` : ""}</span>;
  if (row.status === "cancelled") return <span className="badge2 b-grey">Bekor qilingan</span>;
  if (row.overdue) return <span className="badge2 b-rose">{-row.daysUntilDue} kun kechikdi</span>;
  if (row.daysUntilDue === 0) return <span className="badge2 b-amber">Bugun</span>;
  if (row.daysUntilDue <= 7) return <span className="badge2 b-amber">{row.daysUntilDue} kundan keyin</span>;
  return <span className="badge2 b-grey">Rejada</span>;
}

/**
 * Lid kartasidagi «To‘lov jadvali»: avans + bo‘laklar, muddati o‘tganlar qizil,
 * «To‘landi» → moliya bo‘limida kirim (FinanceTransaction) yaratiladi.
 * Yozish huquqi backend `canWrite` bayrog‘idan olinadi (agent faqat ko‘radi).
 */
export function PaymentSchedulePanel({ lead, readOnly }: { lead: LeadLike; readOnly?: boolean }) {
  const { data, error: loadErr, reload: load } = useAgencyData<InstalmentListData>(`/crm/bookings/${lead.id}/instalments`, "To‘lov jadvalini yuklab bo‘lmadi.");
  const [actionErr, setErr] = useState("");
  const err = actionErr || loadErr;
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"" | "plan" | "add">("");
  const [payId, setPayId] = useState("");

  const canWrite = !!data?.canWrite && !readOnly;
  const currency = data?.booking.currency || lead.currency || "USD";

  async function act(path: string, init: RequestInit) {
    setBusy(true); setErr("");
    const res = await agencyApi(path, init);
    setBusy(false);
    if (!res.success) { setErr(res.message || "Amal bajarilmadi."); return false; }
    await load();
    return true;
  }

  return (
    <div className="ld-note" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="ld-k" style={{ marginRight: "auto" }}>To‘lov jadvali</span>
        {canWrite ? <>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMode(mode === "plan" ? "" : "plan")}>Reja tuzish</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setMode(mode === "add" ? "" : "add")}>+ Bo‘lak</button>
        </> : null}
      </div>
      {err ? <div className="note" style={{ margin: "8px 0 0", ...ERR_STYLE }}>{err}</div> : null}
      {data?.summary.length ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {data.summary.map((s) => (
            <span key={s.currency} style={{ display: "contents" }}>
              <span className="badge2 b-green">To‘langan: {fmtAmount(s.paid, s.currency)}</span>
              <span className="badge2 b-grey">Qoldiq: {fmtAmount(s.planned, s.currency)}</span>
              {s.overdue ? <span className="badge2 b-rose">Muddati o‘tgan: {fmtAmount(s.overdue, s.currency)}</span> : null}
            </span>
          ))}
          {data.booking.hasTelegram ? <span className="badge2 b-grey" title="Muddatdan 2 kun oldin soat 10:00 da">Telegram eslatma yoqilgan</span> : null}
        </div>
      ) : null}

      {mode === "plan" && canWrite ? <PlanForm lead={lead} currency={currency} onDone={async () => { setMode(""); await load(); }} /> : null}
      {mode === "add" && canWrite ? <AddForm leadId={lead.id} currency={currency} onDone={async () => { setMode(""); await load(); }} /> : null}

      {!data ? <div className="sub" style={{ marginTop: 8 }}>Yuklanmoqda…</div>
        : !data.instalments.length ? <div className="sub" style={{ marginTop: 8 }}>To‘lov jadvali tuzilmagan.{canWrite ? " «Reja tuzish» orqali avans va bo‘laklarni qo‘shing." : ""}</div>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {data.instalments.map((row) => (
              <div key={row.id} style={{
                border: `1px solid ${row.overdue ? "#f3c9c4" : "var(--border)"}`, borderRadius: 10, padding: "8px 10px",
                background: row.overdue ? "var(--rose-soft)" : undefined, opacity: row.status === "cancelled" ? 0.6 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <b style={{ color: row.overdue ? DANGER : undefined }}>{row.title}</b>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Muddat: {fmtDay(row.dueDate)}
                      {row.status === "paid" && row.paidAmount != null && row.paidAmount !== row.amount ? ` · to‘landi ${fmtAmount(row.paidAmount, row.currency)}` : ""}
                      {row.note ? ` · ${row.note}` : ""}
                    </div>
                  </div>
                  <b className="money" style={{ color: row.overdue ? DANGER : undefined, textDecoration: row.status === "cancelled" ? "line-through" : undefined }}>{fmtAmount(row.amount, row.currency)}</b>
                  {statusBadge(row)}
                  {canWrite && row.status === "planned" ? <>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => setPayId(payId === row.id ? "" : row.id)}>To‘landi</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} title="Bekor qilish"
                      onClick={() => void act(`/crm/instalments/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) })}>Bekor</button>
                  </> : null}
                  {canWrite && row.status === "cancelled" ? <>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                      onClick={() => void act(`/crm/instalments/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "planned" }) })}>Tiklash</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: DANGER }} disabled={busy}
                      onClick={() => { if (window.confirm(`«${row.title}» o‘chirilsinmi?`)) void act(`/crm/instalments/${row.id}`, { method: "DELETE" }); }}>O‘chirish</button>
                  </> : null}
                </div>
                {payId === row.id && canWrite && row.status === "planned" ? (
                  <PayForm row={row} accounts={(data.accounts || []).filter((a) => a.currency === row.currency)}
                    onCancel={() => setPayId("")} onDone={async () => { setPayId(""); await load(); }} />
                ) : null}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function PlanForm({ lead, currency, onDone }: { lead: LeadLike; currency: string; onDone: () => Promise<void> }) {
  const [f, setF] = useState({
    total: lead.totalEstimate ? String(lead.totalEstimate) : "", currency, depositPercent: "30", instalments: "2",
    depositDueDate: todayIso(), firstDueDate: todayIso(30), intervalDays: "30",
  });
  const [preview, setPreview] = useState<PlanPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setPreview(null); };
  const body = (extra: Record<string, unknown>) => JSON.stringify({
    total: f.total, currency: f.currency, depositPercent: Number(f.depositPercent || 0), instalments: Number(f.instalments || 0),
    depositDueDate: f.depositDueDate || undefined, firstDueDate: f.firstDueDate, intervalDays: Number(f.intervalDays || 30), ...extra,
  });
  async function submit(dryRun: boolean, replace = false) {
    setBusy(true); setErr("");
    const res = await agencyApi<{ instalments: PlanPreviewRow[] }>(`/crm/bookings/${lead.id}/instalments/plan`, { method: "POST", body: body({ dryRun, replace }) });
    setBusy(false);
    if (res.success) { if (dryRun) setPreview(res.data.instalments); else await onDone(); return; }
    if (res.code === "PLAN_EXISTS" && window.confirm("Bu lid uchun jadval bor. To‘lanmagan bo‘laklar yangi reja bilan almashtirilsinmi?")) { await submit(false, true); return; }
    setErr(res.message || "Reja tuzilmadi.");
  }
  return (
    <div style={box}>
      <div style={grid}>
        <div className="fld" style={fld}><label>Umumiy summa</label><input inputMode="numeric" value={f.total} onChange={(e) => set("total", e.target.value)} placeholder="1500" /></div>
        <div className="fld" style={fld}><label>Valyuta</label><select value={f.currency} onChange={(e) => set("currency", e.target.value)}>{[...new Set([currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="fld" style={fld}><label>Avans, %</label><input type="number" min={0} max={100} value={f.depositPercent} onChange={(e) => set("depositPercent", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Avans sanasi</label><input type="date" value={f.depositDueDate} onChange={(e) => set("depositDueDate", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Qolgan bo‘laklar soni</label><input type="number" min={0} max={36} value={f.instalments} onChange={(e) => set("instalments", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Birinchi bo‘lak sanasi</label><input type="date" value={f.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Oraliq (kun)</label><input type="number" min={1} max={365} value={f.intervalDays} onChange={(e) => set("intervalDays", e.target.value)} /></div>
      </div>
      {err ? <div className="note" style={{ margin: "10px 0 0", ...ERR_STYLE }}>{err}</div> : null}
      {preview ? (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {preview.map((p) => <div key={p.position} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed var(--border)" }}><span>{p.title} · {fmtDay(p.dueDate)}</span><b>{fmtAmount(p.amount, p.currency)}</b></div>)}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void submit(true)}>Ko‘rib chiqish</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit(false)}>{busy ? "Saqlanmoqda…" : "Rejani saqlash"}</button>
      </div>
    </div>
  );
}

function AddForm({ leadId, currency, onDone }: { leadId: string; currency: string; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ title: "Avans", amount: "", currency, dueDate: todayIso(7), note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit() {
    setBusy(true); setErr("");
    const res = await agencyApi(`/crm/bookings/${leadId}/instalments`, { method: "POST", body: JSON.stringify(f) });
    setBusy(false);
    if (res.success) await onDone(); else setErr(res.message || "Bo‘lak qo‘shilmadi.");
  }
  return (
    <div style={box}>
      <div style={grid}>
        <div className="fld" style={fld}><label>Nomi</label><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Avans, Qoldiq…" /></div>
        <div className="fld" style={fld}><label>Summa</label><input inputMode="numeric" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Valyuta</label><select value={f.currency} onChange={(e) => set("currency", e.target.value)}>{[...new Set([currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="fld" style={fld}><label>Muddat</label><input type="date" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
        <div className="fld" style={{ ...fld, gridColumn: "1 / -1" }}><label>Izoh</label><input value={f.note} onChange={(e) => set("note", e.target.value)} /></div>
      </div>
      {err ? <div className="note" style={{ margin: "10px 0 0", ...ERR_STYLE }}>{err}</div> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit()}>{busy ? "Saqlanmoqda…" : "Qo‘shish"}</button>
      </div>
    </div>
  );
}

function PayForm({ row, accounts, onCancel, onDone }: { row: Instalment; accounts: InstalmentListData["accounts"]; onCancel: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ paidAmount: String(row.amount), paidAt: todayIso(), accountId: accounts[0]?.id || "", paymentMethod: PAYMENT_METHODS[0] as string });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit() {
    if (busy) return; // ikki marta bosishdan himoya (backend ham idempotent)
    setBusy(true); setErr("");
    const res = await agencyApi(`/crm/instalments/${row.id}/pay`, { method: "POST", body: JSON.stringify({ ...f, accountId: f.accountId || undefined }) });
    setBusy(false);
    if (res.success) await onDone(); else setErr(res.message || "To‘lov qayd etilmadi.");
  }
  return (
    <div style={{ ...box, background: "var(--card, #fff)" }}>
      <div style={grid}>
        <div className="fld" style={fld}><label>Olingan summa ({row.currency})</label><input inputMode="numeric" value={f.paidAmount} onChange={(e) => set("paidAmount", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Sana</label><input type="date" value={f.paidAt} onChange={(e) => set("paidAt", e.target.value)} /></div>
        <div className="fld" style={fld}><label>Kassa / hisob</label>
          <select value={f.accountId} onChange={(e) => set("accountId", e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            <option value="">Hisobsiz</option>
          </select>
        </div>
        <div className="fld" style={fld}><label>Usul</label><select value={f.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>
      </div>
      {!accounts.length ? <div className="sub" style={{ marginTop: 8, fontSize: 12 }}>{row.currency} valyutasidagi kassa yo‘q — kirim hisobsiz yoziladi (Moliya bo‘limida hisob qo‘shish mumkin).</div> : null}
      <div className="sub" style={{ marginTop: 6, fontSize: 12 }}>Summa bo‘lakdan kam bo‘lsa, qoldiq uchun yangi bo‘lak avtomatik yaratiladi.</div>
      {err ? <div className="note" style={{ margin: "10px 0 0", ...ERR_STYLE }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>Bekor</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit()}>{busy ? "Saqlanmoqda…" : "To‘lovni qayd etish"}</button>
      </div>
    </div>
  );
}
