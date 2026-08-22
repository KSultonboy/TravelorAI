"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agencyApi } from "@/lib/agency/api";

type Branch = { id: string; name: string; city?: string | null; address?: string | null; active: boolean };
type Member = { id: string; name: string; role: string; status: string; branchId?: string | null; payrollProfile?: PayrollProfile | null };
type PayrollProfile = { baseSalary: number; bonusPerWon: number; currency: string; payoutDay: number; active: boolean };
type Payload = {
  period: { from: string; to: string; currency: string; weeks: number };
  pnl: {
    income: number; costOfSales: number; grossProfit: number; payroll: number; operatingExpenses: number; expenses: number; netProfit: number;
    grossMarginPct: number; netMarginPct: number;
    monthly: { key: string; income: number; costOfSales: number; payroll: number; operatingExpenses: number; netProfit: number }[];
    categories: { name: string; direction: string; amount: number }[];
  };
  cashflow: {
    openingBalance: number; overdueIncome: number; overdueExpense: number; unscheduled: number;
    accounts: { id: string; name: string; branchId?: string | null; balance: number }[];
    weeks: { index: number; from: string; to: string; income: number; expense: number; net: number; closingBalance: number; atRisk: boolean }[];
  };
  payroll: {
    totals: { accrued: number; paid: number; payable: number };
    items: { memberId: string; name: string; role: string; branchId?: string | null; branchName: string; profile?: PayrollProfile | null; wonDeals: number; baseSalary: number; dealBonus: number; commission: number; accrued: number; paid: number; payable: number }[];
  };
  branches: { items: { id: string | null; name: string; city?: string | null; members: number; leads: number; won: number; conversionPct: number; income: number; expense: number; profit: number }[] };
  directory: { branches: Branch[]; members: Member[] };
};

type Tab = "pnl" | "cashflow" | "payroll" | "branches";
const TAB_LABEL: Record<Tab, string> = { pnl: "P&L", cashflow: "Cashflow prognozi", payroll: "Menejer payroll", branches: "Filiallar" };

function monthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function monthBounds(value: string) {
  const [year, month] = value.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
function money(value: number | null | undefined, currency: string) {
  return new Intl.NumberFormat("uz-UZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}
function shortDate(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function ExecutiveReportsPage({ show, readOnly }: { show: boolean; readOnly: boolean }) {
  const [tab, setTab] = useState<Tab>("pnl");
  const [month, setMonth] = useState(monthValue());
  const [currency, setCurrency] = useState("USD");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const bounds = monthBounds(month);
    const query = new URLSearchParams({ currency, from: bounds.from, to: bounds.to, weeks: "12" });
    const result = await agencyApi<Payload>(`/crm/executive-report?${query}`);
    setLoading(false);
    if (result.success) setData(result.data);
    else setError(result.message || "Hisobotni yuklab bo‘lmadi");
  }, [currency, month]);
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [show, load]);

  const maxMonth = useMemo(() => Math.max(1, ...(data?.pnl.monthly || []).map((row) => Math.max(row.income, row.costOfSales + row.payroll + row.operatingExpenses))), [data]);
  async function mutate(path: string, init: RequestInit, ok: string) {
    setNotice(""); setError("");
    const result = await agencyApi(path, init);
    if (!result.success) { setError(result.message || "Saqlab bo‘lmadi"); return false; }
    setNotice(ok); await load(); return true;
  }

  return (
    <section className={`view executive-reports${show ? " active" : ""}`}>
      <div className="section-head exec-head">
        <div><h2>Rahbar moliya paneli</h2><div className="sub">Haqiqiy pul harakati asosidagi P&amp;L, prognoz, payroll va filiallar</div></div>
        <div className="exec-filters"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option>USD</option><option>UZS</option><option>EUR</option></select><button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>{loading ? "..." : "Yangilash"}</button></div>
      </div>
      {error ? <div className="note note-err">{error}</div> : null}
      {notice ? <div className="note" style={{ color: "var(--primary)" }}>{notice}</div> : null}
      <div className="exec-tabs">{(Object.keys(TAB_LABEL) as Tab[]).map((key) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{TAB_LABEL[key]}</button>)}</div>
      {!data && loading ? <div className="card exec-empty">Hisobot hisoblanmoqda…</div> : null}
      {data && tab === "pnl" ? <Pnl data={data} currency={currency} maxMonth={maxMonth} /> : null}
      {data && tab === "cashflow" ? <Cashflow data={data} currency={currency} /> : null}
      {data && tab === "payroll" ? <Payroll data={data} currency={currency} readOnly={readOnly} mutate={mutate} /> : null}
      {data && tab === "branches" ? <Branches data={data} currency={currency} readOnly={readOnly} mutate={mutate} /> : null}
      <style jsx>{`
        .exec-head{gap:16px;align-items:flex-end}.exec-filters{display:flex;gap:8px;flex-wrap:wrap}.exec-filters input,.exec-filters select{height:38px;width:auto;min-width:100px}
        .exec-tabs{display:flex;gap:6px;padding:5px;background:var(--surface,#fff);border:1px solid var(--border);border-radius:13px;margin:14px 0;overflow:auto}.exec-tabs button{border:0;background:transparent;padding:9px 14px;border-radius:9px;font:inherit;font-weight:600;color:var(--muted);white-space:nowrap;cursor:pointer}.exec-tabs button.active{background:var(--primary);color:#fff}
        .exec-empty{padding:32px;text-align:center;color:var(--muted)}
        @media(max-width:760px){.exec-head{align-items:stretch;flex-direction:column}.exec-filters>*{flex:1}.exec-tabs{border-radius:10px}}
      `}</style>
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <div className="card exec-kpi"><span>{label}</span><b className={tone || ""}>{value}</b><style jsx>{`.exec-kpi{padding:16px}.exec-kpi span{display:block;color:var(--muted);font-size:12px;margin-bottom:7px}.exec-kpi b{font:700 22px/1.15 'Space Grotesk',sans-serif}.exec-kpi b.good{color:var(--primary)}.exec-kpi b.bad{color:#d92d20}`}</style></div>;
}
function Grid({ children }: { children: React.ReactNode }) { return <div className="exec-grid">{children}<style jsx>{`.exec-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}@media(max-width:1000px){.exec-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:540px){.exec-grid{grid-template-columns:1fr}}`}</style></div>; }

function Pnl({ data, currency, maxMonth }: { data: Payload; currency: string; maxMonth: number }) {
  const p = data.pnl;
  return <>
    <Grid><Kpi label="Tushum" value={money(p.income, currency)} tone="good" /><Kpi label="Yalpi foyda" value={money(p.grossProfit, currency)} /><Kpi label="Jami xarajat" value={money(p.expenses, currency)} /><Kpi label={`Sof foyda · ${p.netMarginPct}%`} value={money(p.netProfit, currency)} tone={p.netProfit >= 0 ? "good" : "bad"} /></Grid>
    <div className="exec-two">
      <div className="card exec-card"><h3>P&amp;L tuzilmasi</h3><Line label="Tushum" value={p.income} currency={currency} good /><Line label="− Tur tannarxi / supplier" value={p.costOfSales} currency={currency} /><Line label={`= Yalpi foyda (${p.grossMarginPct}%)`} value={p.grossProfit} currency={currency} strong /><Line label="− Menejer va payroll" value={p.payroll} currency={currency} /><Line label="− Operatsion xarajat" value={p.operatingExpenses} currency={currency} /><Line label="= Sof foyda" value={p.netProfit} currency={currency} strong good={p.netProfit >= 0} /></div>
      <div className="card exec-card"><h3>Oylar dinamikasi</h3><div className="month-bars">{p.monthly.map((row) => { const exp = row.costOfSales + row.payroll + row.operatingExpenses; return <div key={row.key} className="month-row"><span>{row.key}</span><div><i style={{ width: `${Math.max(2, row.income / maxMonth * 100)}%` }} /><em style={{ width: `${Math.max(2, exp / maxMonth * 100)}%` }} /></div><b className={row.netProfit < 0 ? "bad" : ""}>{money(row.netProfit, currency)}</b></div>; })}</div></div>
    </div>
    <div className="card exec-card" style={{ marginTop: 12 }}><h3>Kategoriya bo‘yicha</h3><div className="tbl-wrap"><table><thead><tr><th>Kategoriya</th><th>Tur</th><th className="r">Summa</th></tr></thead><tbody>{p.categories.map((row, index) => <tr key={`${row.name}-${index}`}><td>{row.name}</td><td>{row.direction === "income" ? "Kirim" : "Chiqim"}</td><td className="r money">{money(row.amount, currency)}</td></tr>)}</tbody></table></div></div>
    <style jsx>{`.exec-two{display:grid;grid-template-columns:1fr 1.4fr;gap:12px}.exec-card{padding:16px}.exec-card h3{font-size:15px;margin:0 0 12px}.month-row{display:grid;grid-template-columns:62px 1fr 110px;align-items:center;gap:9px;margin:10px 0;font-size:12px}.month-row>div{display:flex;flex-direction:column;gap:3px}.month-row i,.month-row em{display:block;height:6px;border-radius:8px;background:var(--primary)}.month-row em{background:#fda29b}.month-row b{text-align:right}.bad{color:#d92d20}@media(max-width:850px){.exec-two{grid-template-columns:1fr}.month-row{grid-template-columns:55px 1fr 90px}}`}</style>
  </>;
}
function Line({ label, value, currency, strong, good }: { label: string; value: number; currency: string; strong?: boolean; good?: boolean }) { return <div className={`pnl-line${strong ? " strong" : ""}${good ? " good" : ""}`}><span>{label}</span><b>{money(value, currency)}</b><style jsx>{`.pnl-line{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}.pnl-line.strong{font-size:14px;border-top:1px solid var(--border);font-weight:700}.pnl-line.good b{color:var(--primary)}`}</style></div>; }

function Cashflow({ data, currency }: { data: Payload; currency: string }) {
  const c = data.cashflow; const risk = c.weeks.find((row) => row.atRisk);
  return <><Grid><Kpi label="Bugungi balans" value={money(c.openingBalance, currency)} /><Kpi label="Kechikkan kirim" value={money(c.overdueIncome, currency)} /><Kpi label="Kechikkan chiqim" value={money(c.overdueExpense, currency)} tone={c.overdueExpense ? "bad" : undefined} /><Kpi label="Likvidlik xavfi" value={risk ? `${risk.index}-hafta` : "Xavf yo‘q"} tone={risk ? "bad" : "good"} /></Grid>
    <div className="card exec-cash"><h3>12 haftalik pul oqimi</h3><div className="tbl-wrap"><table><thead><tr><th>Hafta</th><th className="r">Kirim</th><th className="r">Chiqim</th><th className="r">Netto</th><th className="r">Yakuniy balans</th></tr></thead><tbody>{c.weeks.map((row) => <tr key={row.index}><td>{shortDate(row.from)} — {shortDate(row.to)}</td><td className="r" style={{ color: "var(--primary)" }}>+{money(row.income, currency)}</td><td className="r" style={{ color: "#d92d20" }}>−{money(row.expense, currency)}</td><td className="r money">{money(row.net, currency)}</td><td className="r money" style={{ color: row.atRisk ? "#d92d20" : undefined }}>{money(row.closingBalance, currency)}</td></tr>)}</tbody></table></div></div>
    <div className="exec-accounts">{c.accounts.map((a) => <span key={a.id}>{a.name}: <b>{money(a.balance, currency)}</b></span>)}{c.unscheduled ? <span>Sanasi belgilanmagan: <b>{c.unscheduled} ta</b></span> : null}</div>
    <style jsx>{`.exec-cash{padding:16px}.exec-cash h3{margin:0 0 12px;font-size:15px}.exec-accounts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.exec-accounts span{padding:8px 11px;border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff);font-size:12px}`}</style></>;
}

function Payroll({ data, currency, readOnly, mutate }: { data: Payload; currency: string; readOnly: boolean; mutate: (path: string, init: RequestInit, ok: string) => Promise<boolean> }) {
  return <><Grid><Kpi label="Hisoblandi" value={money(data.payroll.totals.accrued, currency)} /><Kpi label="To‘langan" value={money(data.payroll.totals.paid, currency)} tone="good" /><Kpi label="To‘lanadi" value={money(data.payroll.totals.payable, currency)} /><Kpi label="Xodimlar" value={`${data.payroll.items.length} nafar`} /></Grid>
    <div className="pay-grid">{data.payroll.items.map((row) => <PayrollCard key={`${row.memberId}-${currency}`} row={row} currency={currency} branches={data.directory.branches} readOnly={readOnly} mutate={mutate} />)}</div>
    {!data.payroll.items.length ? <div className="card exec-empty">Payroll hisoblash uchun avval xodim qo‘shing.</div> : null}
    <style jsx>{`.pay-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:850px){.pay-grid{grid-template-columns:1fr}}`}</style></>;
}
function PayrollCard({ row, currency, branches, readOnly, mutate }: { row: Payload["payroll"]["items"][number]; currency: string; branches: Branch[]; readOnly: boolean; mutate: (path: string, init: RequestInit, ok: string) => Promise<boolean> }) {
  const [baseSalary, setBaseSalary] = useState(row.profile?.baseSalary || 0); const [bonusPerWon, setBonus] = useState(row.profile?.bonusPerWon || 0); const [payoutDay, setDay] = useState(row.profile?.payoutDay || 5); const [branchId, setBranch] = useState(row.branchId || "");
  async function save() {
    if (branchId !== (row.branchId || "")) await mutate(`/crm/branches/members/${row.memberId}`, { method: "PUT", body: JSON.stringify({ branchId: branchId || null }) }, "Xodim filiali saqlandi");
    await mutate(`/crm/payroll/${row.memberId}`, { method: "PUT", body: JSON.stringify({ baseSalary, bonusPerWon, payoutDay, currency, active: true }) }, "Payroll sozlamasi saqlandi");
  }
  return <div className="card pay-card"><div className="pay-title"><div><b>{row.name}</b><small>{row.branchName} · {row.wonDeals} ta yopilgan bitim</small></div><strong>{money(row.payable, currency)}</strong></div><div className="pay-break"><span>Baza <b>{money(row.baseSalary, currency)}</b></span><span>Bonus <b>{money(row.dealBonus, currency)}</b></span><span>Komissiya <b>{money(row.commission, currency)}</b></span><span>To‘landi <b>{money(row.paid, currency)}</b></span></div>{!readOnly ? <div className="pay-form"><label>Oylik<input type="number" min="0" value={baseSalary} onChange={(e) => setBaseSalary(Number(e.target.value))} /></label><label>1 bitim bonusi<input type="number" min="0" value={bonusPerWon} onChange={(e) => setBonus(Number(e.target.value))} /></label><label>To‘lov kuni<input type="number" min="1" max="28" value={payoutDay} onChange={(e) => setDay(Number(e.target.value))} /></label><label>Filial<select value={branchId} onChange={(e) => setBranch(e.target.value)}><option value="">Biriktirilmagan</option>{branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className="btn btn-primary btn-sm" onClick={() => void save()}>Saqlash</button></div> : null}<style jsx>{`.pay-card{padding:16px}.pay-title{display:flex;justify-content:space-between;gap:12px}.pay-title small{display:block;color:var(--muted);margin-top:3px}.pay-title strong{color:var(--primary);white-space:nowrap}.pay-break{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:14px 0;font-size:12px}.pay-break span{display:flex;justify-content:space-between;padding:7px;background:var(--soft,#f5f7f6);border-radius:7px}.pay-form{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.pay-form label{font-size:11px;color:var(--muted)}.pay-form input,.pay-form select{width:100%;margin-top:4px}.pay-form button{align-self:end}@media(max-width:500px){.pay-form{grid-template-columns:1fr}}`}</style></div>;
}

function Branches({ data, currency, readOnly, mutate }: { data: Payload; currency: string; readOnly: boolean; mutate: (path: string, init: RequestInit, ok: string) => Promise<boolean> }) {
  const [name, setName] = useState(""); const [city, setCity] = useState("");
  async function add() { if (!name.trim()) return; const ok = await mutate("/crm/branches", { method: "POST", body: JSON.stringify({ name, city }) }, "Yangi filial qo‘shildi"); if (ok) { setName(""); setCity(""); } }
  return <><div className="branch-grid">{data.branches.items.map((row) => <div className="card branch-card" key={row.id || "none"}><div className="branch-title"><div><b>{row.name}</b><small>{row.city || "Hudud belgilanmagan"} · {row.members} xodim</small></div>{row.id && !readOnly ? <button className="act-btn" onClick={() => void mutate(`/crm/branches/${row.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) }, "Filial arxivlandi")}>Arxiv</button> : null}</div><div className="branch-metrics"><span>Lidlar<b>{row.leads}</b></span><span>Yopildi<b>{row.won}</b></span><span>Konversiya<b>{row.conversionPct}%</b></span><span>Tushum<b>{money(row.income, currency)}</b></span><span>Xarajat<b>{money(row.expense, currency)}</b></span><span>Foyda<b className={row.profit < 0 ? "bad" : "good"}>{money(row.profit, currency)}</b></span></div></div>)}</div>
    {!readOnly ? <div className="card add-branch"><b>Yangi filial</b><input placeholder="Filial nomi" value={name} onChange={(e) => setName(e.target.value)} /><input placeholder="Shahar" value={city} onChange={(e) => setCity(e.target.value)} /><button className="btn btn-primary btn-sm" onClick={() => void add()}>+ Qo‘shish</button></div> : null}
    <style jsx>{`.branch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.branch-card{padding:16px}.branch-title{display:flex;justify-content:space-between;gap:10px}.branch-title small{display:block;color:var(--muted);margin-top:3px}.branch-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.branch-metrics span{font-size:11px;color:var(--muted);padding:8px;background:var(--soft,#f5f7f6);border-radius:8px}.branch-metrics b{display:block;color:var(--text);margin-top:4px;font-size:13px}.branch-metrics b.good{color:var(--primary)}.branch-metrics b.bad{color:#d92d20}.add-branch{display:flex;align-items:end;gap:8px;margin-top:12px;padding:14px}.add-branch b{margin-right:auto}.add-branch input{width:180px}@media(max-width:850px){.branch-grid{grid-template-columns:1fr}.add-branch{align-items:stretch;flex-direction:column}.add-branch input{width:100%}}`}</style></>;
}
