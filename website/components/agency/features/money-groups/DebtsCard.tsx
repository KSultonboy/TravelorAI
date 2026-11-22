"use client";

import { DANGER, fmtAmount, type DebtsData } from "./api";
import { requestOpenLead } from "./openLead";
import { useAgencyData } from "./useAgencyData";

/**
 * Boshqaruv panelidagi «Qarzdorlik» kartasi: muddati o‘tgan summa, shu hafta
 * kutilayotgan to‘lovlar va eng ko‘p kechikkan 5 ta lid (bosilsa lid kartasi ochiladi).
 */
export function DebtsCard({ show, go }: { show: boolean; go: (view: string) => void }) {
  // Panel ko'ringan har safar yangilanadi (path null → so'rov yo'q).
  const { data, error } = useAgencyData<DebtsData>(show ? "/crm/debts" : null);

  if (error || !data) return null;
  const hasAny = data.totals.some((t) => t.outstanding > 0);
  const overdue = data.totals.filter((t) => t.overdue > 0);
  const week = data.totals.filter((t) => t.dueWeek > 0);
  const open = (id: string) => { go("leads"); requestOpenLead(id); };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="section-head" style={{ margin: "16px 18px 6px" }}>
        <div><h2>Qarzdorlik</h2><div className="sub">Mijozlarning to‘lov jadvali bo‘yicha</div></div>
      </div>
      {!hasAny ? (
        <div className="sub" style={{ padding: "0 18px 16px" }}>Ochiq qarzdorlik yo‘q. To‘lov jadvali lid kartasida («To‘lov jadvali») tuziladi.</div>
      ) : (
        <div style={{ padding: "0 18px 16px" }}>
          <div className="grid g3" style={{ gap: 10 }}>
            <div style={{ border: "1px solid #f3c9c4", background: "var(--rose-soft)", borderRadius: 12, padding: 12 }}>
              <div className="sub" style={{ fontSize: 12 }}>Muddati o‘tgan</div>
              {overdue.length ? overdue.map((t) => <div key={t.currency} style={{ fontWeight: 700, color: DANGER }}>{fmtAmount(t.overdue, t.currency)} <small style={{ fontWeight: 500 }}>· {t.overdueCount} ta</small></div>) : <b>0</b>}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div className="sub" style={{ fontSize: 12 }}>7 kun ichida kutilmoqda</div>
              {week.length ? week.map((t) => <div key={t.currency} style={{ fontWeight: 700 }}>{fmtAmount(t.dueWeek, t.currency)} <small style={{ fontWeight: 500 }}>· {t.dueWeekCount} ta</small></div>) : <b>0</b>}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
              <div className="sub" style={{ fontSize: 12 }}>Jami qoldiq</div>
              {data.totals.filter((t) => t.outstanding > 0).map((t) => <div key={t.currency} style={{ fontWeight: 700 }}>{fmtAmount(t.outstanding, t.currency)}</div>)}
            </div>
          </div>
          {data.topOverdueLeads.length ? (
            <div className="mini" style={{ marginTop: 10 }}>
              {data.topOverdueLeads.map((lead) => (
                <button type="button" key={lead.bookingId} className="r" onClick={() => open(lead.bookingId)}
                  style={{ width: "100%", textAlign: "left", background: "none", border: 0, cursor: "pointer", font: "inherit", color: "inherit" }}
                  title="Lid kartasini ochish">
                  <div><b>{lead.customerName}</b><small>{lead.count} ta bo‘lak · {lead.daysOverdue} kun kechikdi</small></div>
                  <div className="end money" style={{ color: DANGER }}>{Object.entries(lead.amounts).map(([cur, sum]) => fmtAmount(sum, cur)).join(" · ")}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
