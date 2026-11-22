"use client";

import { useEffect, useState } from "react";
import { agencyApi, agencyRoleOf } from "@/lib/agency/api";
import { saveFile } from "@/lib/agency/external";
import { useAgencySession } from "@/lib/agency/session";
import { DANGER, ERR_STYLE, fmtDay, type GroupListData } from "./api";
import { useAgencyData } from "./useAgencyData";

type TourLike = { id: string; title: string };

/**
 * Tur kartasidagi «Guruh ro‘yxati»: kelishilgan lidlar + pasport OCR ma’lumoti,
 * ogohlantirishlar (pasport yo‘q, 6 oydan kam amal qiladi, ism mos emas) va
 * Excel uchun CSV. Buxgalterga yopiq (pasport — lid fayllari qoidasi).
 */
export function GroupListButton({ tour }: { tour: TourLike }) {
  const { me } = useAgencySession();
  const [open, setOpen] = useState(false);
  const role = agencyRoleOf(me?.access);
  if (role === "accountant") return null;
  const canExport = me?.access?.caps?.csvExport !== false;
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: "100%" }} onClick={() => setOpen(true)}>Guruh ro‘yxati</button>
      {open ? <GroupListModal tour={tour} canExport={canExport} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GroupListModal({ tour, canExport, onClose }: { tour: TourLike; canExport: boolean; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [actionErr, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const query = `tourId=${encodeURIComponent(tour.id)}${date ? `&date=${encodeURIComponent(date)}` : ""}`;
  const { data, error: loadErr } = useAgencyData<GroupListData>(`/crm/group-list?${query}`, "Ro‘yxatni yuklab bo‘lmadi.");
  const err = actionErr || loadErr;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function download() {
    setBusy(true); setErr(""); setSaved("");
    const res = await agencyApi<{ filename: string; csv: string }>(`/crm/group-list/export?${query}`);
    if (!res.success) { setBusy(false); setErr(res.message || "Eksport qilinmadi."); return; }
    try {
      const path = await saveFile(res.data.filename, res.data.csv, "text/csv;charset=utf-8;");
      setSaved(path ? `Saqlandi: ${path}` : "Fayl yuklab olindi.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Faylni saqlab bo‘lmadi."); }
    setBusy(false);
  }

  const departures = data?.departures || [];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 70, display: "grid", placeItems: "center", padding: 16 }} onClick={onClose}>
      <div className="card" role="dialog" aria-modal="true" aria-label="Guruh ro‘yxati" style={{ width: "min(1100px,100%)", padding: 22, maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 12px", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2>Guruh ro‘yxati</h2>
            <div className="sub">{tour.title}{data?.tour.durationDays ? ` · ${data.tour.durationDays} kun` : ""} — kelishilgan lidlar va pasport ma’lumotlari</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Jo‘nash sanasi">
              <option value="">Barcha sanalar</option>
              {departures.filter((d) => d.date).map((d) => <option key={d.date!} value={d.date!}>{fmtDay(d.date)} · {d.count} ta lid</option>)}
            </select>
            {canExport ? <button type="button" className="btn btn-primary btn-sm" disabled={busy || !data?.rows.length} onClick={() => void download()}>{busy ? "Tayyorlanmoqda…" : "CSV (Excel) yuklab olish"}</button> : null}
          </div>
        </div>
        {err ? <div className="note" style={{ marginBottom: 12, ...ERR_STYLE }}>{err}</div> : null}
        {saved ? <div className="note" style={{ marginBottom: 12 }}>{saved}</div> : null}
        {data ? (
          <div className="sub" style={{ marginBottom: 10 }}>
            {data.summary.bookings} ta lid · {data.summary.travelers} sayyoh · {data.summary.passports} ta pasport o‘qilgan
            {data.summary.rowsWithWarnings ? <b style={{ color: DANGER }}> · {data.summary.rowsWithWarnings} qatorda ogohlantirish</b> : null}
          </div>
        ) : null}
        {!data ? <div className="sub">Yuklanmoqda…</div> : !data.rows.length ? (
          <div className="sub" style={{ padding: "16px 0", textAlign: "center" }}>Bu tur{date ? " va sana" : ""} bo‘yicha kelishilgan lid yo‘q. Lid «Kelishildi» bosqichida va shu turga bog‘langan bo‘lishi kerak.</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>№</th><th>F.I.Sh (pasport)</th><th>Pasport raqami</th><th>Fuqaroligi</th><th>Tug‘ilgan sana</th><th>Amal qilish muddati</th><th>Telefon</th><th>Jo‘nash</th><th>Ogohlantirish</th></tr></thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={`${row.bookingId}-${row.no}`} style={row.warnings.length ? { background: "var(--rose-soft)" } : undefined}>
                    <td>{row.no}</td>
                    <td><b>{row.fullName}</b>{row.note ? <div className="sub" style={{ fontSize: 11 }}>{row.note}</div> : null}</td>
                    <td>{row.passportNumber || "—"}</td>
                    <td>{row.nationality || "—"}</td>
                    <td>{fmtDay(row.birthDate)}</td>
                    <td>{fmtDay(row.expiryDate)}</td>
                    <td>{row.phone || "—"}</td>
                    <td>{fmtDay(row.departureDate)}</td>
                    <td style={{ color: row.warnings.length ? DANGER : undefined, fontSize: 12, minWidth: 180 }}>{row.warnings.length ? row.warnings.map((w) => <div key={w.code}>{w.message}</div>) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="sub" style={{ fontSize: 12, marginTop: 10 }}>Pasport ma’lumoti lid fayllaridagi OCR natijasidan olinadi; skanlar eksportga kirmaydi. Ism mosligi — maslahat xarakterida, qo‘lda tekshiring.</div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
}
