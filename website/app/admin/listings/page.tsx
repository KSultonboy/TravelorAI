"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/adminApi";
import { StatusBadge, Spinner, EmptyState, Toast, ConfirmButton } from "@/components/admin/ui";
import { publicImageSrc } from "@/lib/imageUrls";

type Listing = {
  id: string;
  title?: string;
  city?: string;
  approvalStatus?: string;
  status?: string;
  imageUrl?: string | null;
  agency?: { name?: string } | null;
  bookingsCount?: number;
};

/* eslint-disable @next/next/no-img-element */
export default function ListingsPage() {
  const [items, setItems] = useState<Listing[] | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api<{ items: Listing[] }>("/admin/tours?status=all").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setToast(e.message); });
  }, []);

  async function remove(id: string) {
    if (!items) return;
    const prev = items;
    setItems(items.filter((t) => t.id !== id));
    try { await api(`/admin/tours/${id}`, { method: "DELETE" }); }
    catch (e) { setItems(prev); setToast(e instanceof Error ? e.message : "O‘chirib bo‘lmadi"); }
  }

  if (!items) return <Spinner />;

  return (
    <>
      <h1 className="adm-h1">Turlar (listing)</h1>
      <p className="adm-sub">Platformadagi barcha turlar — egasi, holati va boshqaruv.</p>

      {items.length === 0 ? (
        <EmptyState title="Turlar yo‘q" hint="Agentliklar tur qo‘shganda shu yerda ko‘rinadi." />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Tur</th><th>Shahar</th><th>Agentlik</th><th>Holat</th><th>Amal</th></tr></thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", background: "linear-gradient(135deg,#1a6b3c,#06231a)", flexShrink: 0, display: "block" }}>
                        {t.imageUrl ? <img src={publicImageSrc(t.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                      </span>
                      <span className="adm-table__title">{t.title || "—"}</span>
                    </div>
                  </td>
                  <td>{t.city || "—"}</td>
                  <td>{t.agency?.name || "—"}</td>
                  <td><StatusBadge status={t.approvalStatus || t.status} /></td>
                  <td><ConfirmButton onConfirm={() => remove(t.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toast message={toast} />
    </>
  );
}
