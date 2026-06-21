"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/adminApi";
import { StatusBadge, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type Booking = {
  id: string; status: string; customerName?: string; customerEmail?: string;
  travelers?: number; totalEstimate?: number; currency?: string; travelDate?: string | null; createdAt?: string;
  tour?: { title?: string; city?: string } | null;
};

function fmt(d?: string | null) { try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; } }

export default function BookingsPage() {
  const [items, setItems] = useState<Booking[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ items: Booking[] }>("/admin/bookings").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setErr(e.message); }); }, []);

  if (!items) return <Spinner />;
  return (
    <>
      <h1 className="adm-h1">Bronlar</h1>
      <p className="adm-sub">So‘nggi bronlar — faqat kuzatuv (read-only).</p>
      {items.length === 0 ? (
        <EmptyState title="Bronlar yo‘q" hint="Yangi bronlar shu yerda ko‘rinadi." />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Tur</th><th>Mijoz</th><th>Sana</th><th>Kishi</th><th>Jami</th><th>Holat</th><th>Yaratilgan</th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id}>
                  <td><span className="adm-table__title">{b.tour?.title || "Tur"}</span><div className="adm-table__sub">{b.tour?.city || ""}</div></td>
                  <td>{b.customerName || "—"}<div className="adm-table__sub">{b.customerEmail || ""}</div></td>
                  <td>{fmt(b.travelDate)}</td>
                  <td>{b.travelers || 1}</td>
                  <td><b>{b.totalEstimate ? `${b.totalEstimate.toLocaleString("uz-UZ")} ${b.currency || "USD"}` : "—"}</b></td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>{fmt(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toast message={err} />
    </>
  );
}
