"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/adminApi";
import { Spinner, EmptyState, Toast, ConfirmButton } from "@/components/admin/ui";

type Review = { id: string; rating: number; comment: string; createdAt?: string; author?: string; authorEmail?: string; tourTitle?: string };

function fmt(d?: string) { try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; } }

export default function ReviewsPage() {
  const [items, setItems] = useState<Review[] | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => { api<{ items: Review[] }>("/admin/reviews").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setToast(e.message); }); }, []);

  async function remove(id: string) {
    if (!items) return;
    const prev = items;
    setItems(items.filter((r) => r.id !== id));
    try { await api(`/admin/reviews/${id}`, { method: "DELETE" }); }
    catch (e) { setItems(prev); setToast(e instanceof Error ? e.message : "O‘chirib bo‘lmadi"); }
  }

  if (!items) return <Spinner />;
  return (
    <>
      <h1 className="adm-h1">Sharhlar</h1>
      <p className="adm-sub">Foydalanuvchi sharhlari — nomaqbullarini o‘chiring.</p>
      {items.length === 0 ? (
        <EmptyState title="Sharhlar yo‘q" hint="Foydalanuvchilar sharh qoldirsa shu yerda ko‘rinadi." />
      ) : (
        <div className="adm-grid adm-grid--2">
          {items.map((r) => (
            <div key={r.id} className="adm-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="adm-side__avatar" style={{ width: 38, height: 38, background: "var(--primary-pale)", color: "var(--primary)" }}>{(r.author || "F").charAt(0).toUpperCase()}</span>
                  <div><b>{r.author || "Foydalanuvchi"}</b><div className="adm-table__sub">{r.authorEmail || ""}</div></div>
                </div>
                <span style={{ display: "inline-flex", gap: 2, color: "var(--star)" }}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill={i < r.rating ? "currentColor" : "none"} />)}</span>
              </div>
              <p style={{ color: "var(--ink)", margin: "12px 0 6px", lineHeight: 1.6 }}>{r.comment}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span className="adm-table__sub">{r.tourTitle} · {fmt(r.createdAt)}</span>
                <ConfirmButton onConfirm={() => remove(r.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <Toast message={toast} />
    </>
  );
}
