"use client";

// Admin → To'lovlar & obuna: sinov muddatidagi (yangi) agentliklar ro'yxati va
// sinovni N kunga uzaytirish. Backend: GET /admin/engagement/trials,
// POST /admin/engagement/agencies/:id/extend-trial { days }.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/adminApi";

type TrialRow = {
  id: string;
  name: string;
  city?: string | null;
  trialEndsAt: string;
  accessState: string;
  daysLeft: number | null;
  tariff?: { name: string } | null;
  subscriptionUntil?: string | null;
};

const STATE_LABEL: Record<string, { text: string; style: React.CSSProperties }> = {
  trial: { text: "Sinovda", style: { background: "var(--gold-soft)", color: "#9a6a00" } },
  trial_expired: { text: "Sinov tugagan", style: { background: "#fff1f3", color: "var(--danger)" } },
  active: { text: "To‘lagan", style: { background: "var(--primary-soft, #e7f1eb)", color: "var(--primary)" } },
  expired: { text: "Obuna tugagan", style: { background: "#fff1f3", color: "var(--danger)" } },
};

function fmt(d?: string | null) {
  try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; }
}

export function TrialAdminPanel() {
  const [rows, setRows] = useState<TrialRow[] | null>(null);
  const [days, setDays] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => api<{ items: TrialRow[] }>("/admin/engagement/trials")
    .then((res) => setRows(res.items || []))
    .catch((e: unknown) => { setRows([]); setMsg(e instanceof Error ? e.message : "Yuklab bo‘lmadi"); }), []);

  useEffect(() => {
    let alive = true;
    api<{ items: TrialRow[] }>("/admin/engagement/trials")
      .then((res) => { if (alive) setRows(res.items || []); })
      .catch((e: unknown) => { if (alive) { setRows([]); setMsg(e instanceof Error ? e.message : "Yuklab bo‘lmadi"); } });
    return () => { alive = false; };
  }, []);

  async function extend(row: TrialRow) {
    const n = Number(days[row.id] || 7);
    if (!Number.isInteger(n) || n < 1 || n > 90) { setMsg("Kun soni 1 dan 90 gacha bo‘lishi kerak"); return; }
    setBusy(row.id); setMsg("");
    try {
      await api(`/admin/engagement/agencies/${row.id}/extend-trial`, { method: "POST", body: JSON.stringify({ days: n }) });
      setMsg(`${row.name}: sinov ${n} kunga uzaytirildi`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Uzaytirib bo‘lmadi"); }
    finally { setBusy(""); }
  }

  if (!rows) return null;
  return (
    <section style={{ marginTop: 28 }}>
      <h2 className="adm-h1" style={{ fontSize: 18 }}>Sinov muddatlari</h2>
      <p className="adm-sub">Yangi agentliklar bepul sinov bilan boshlaydi (TRIAL_DAYS, standart 14 kun). Eski agentliklar (sinovsiz) bu ro‘yxatda yo‘q.</p>
      {msg ? <p className="adm-sub" role="status" style={{ marginTop: 8 }}>{msg}</p> : null}
      {rows.length === 0 ? <p className="adm-sub" style={{ marginTop: 10 }}>Hozircha sinovdagi agentlik yo‘q.</p> : (
        <div className="adm-table-wrap" style={{ marginTop: 12 }}>
          <table className="adm-table">
            <thead><tr><th>Agentlik</th><th>Holat</th><th>Sinov tugashi</th><th>Qolgan</th><th style={{ textAlign: "right" }}>Uzaytirish</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const state = STATE_LABEL[row.accessState] || { text: row.accessState, style: {} };
                return (
                  <tr key={row.id}>
                    <td><b>{row.name}</b><div className="adm-table__sub">{row.city || "—"}{row.tariff ? ` · ${row.tariff.name}` : ""}</div></td>
                    <td><span className="adm-badge" style={state.style}>{state.text}</span></td>
                    <td>{fmt(row.trialEndsAt)}</td>
                    <td>{row.daysLeft == null ? "—" : `${row.daysLeft} kun`}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <input type="number" min={1} max={90} aria-label={`${row.name} uchun kun soni`} value={days[row.id] ?? "7"}
                        onChange={(e) => setDays({ ...days, [row.id]: e.target.value })}
                        style={{ width: 64, border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 13, marginRight: 6, fontFamily: "inherit" }} />
                      <button className="adm-btn adm-btn--sm" disabled={busy === row.id} onClick={() => void extend(row)}>{busy === row.id ? "..." : "+ kun"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
