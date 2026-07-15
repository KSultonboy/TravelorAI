"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatusBadge, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type Partner = {
  id: string;
  status: string;
  companyName?: string;
  city?: string;
  phone?: string;
  submittedAt?: string;
  account?: { email?: string } | null;
};

function fmt(d?: string) { try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; } }

export default function PartnersPage() {
  const [items, setItems] = useState<Partner[] | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api<{ items: Partner[] }>("/admin/agency-applications").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setToast(e.message); });
  }, []);

  async function review(id: string, action: "approve" | "reject", nextStatus: string) {
    if (!items) return;
    const prev = items;
    setItems(items.map((p) => (p.id === id ? { ...p, status: nextStatus } : p)));
    try {
      await api(`/admin/agency-applications/${id}/${action}`, { method: "PATCH", body: JSON.stringify({ adminNote: "" }) });
    } catch (e) {
      setItems(prev);
      setToast(e instanceof Error ? e.message : "Amal bajarilmadi");
    }
  }

  async function sendReset(email?: string | null) {
    if (!email) { setToast("Bu arizada email yo‘q."); return; }
    try {
      const d = await api<{ message: string }>("/admin/agencies/send-password-reset", { method: "POST", body: JSON.stringify({ email }) });
      setToast(d.message || "Parol yangilash havolasi yuborildi.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Yuborilmadi");
    }
  }

  if (!items) return <Spinner />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="adm-h1">Hamkorlar</h1>
          <p className="adm-sub">Agentlik arizalari va hisoblari. Kutilayotganlar birinchi.</p>
        </div>
        <Link href="/admin/partners/new" className="adm-btn adm-btn--gold"><Plus size={16} /> Hamkor qo‘shish</Link>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Hozircha hamkor arizasi yo‘q" hint="Yangi arizalar shu yerda ko‘rinadi." />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Agentlik</th><th>Email</th><th>Shahar</th><th>Holat</th><th>Sana</th><th>Amallar</th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="adm-table__title">{p.companyName || "—"}</td>
                  <td>{p.account?.email || "—"}</td>
                  <td>{p.city || "—"}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{fmt(p.submittedAt)}</td>
                  <td>
                    <div className="adm-actions">
                      {p.status !== "approved" ? <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => review(p.id, "approve", "approved")}>Tasdiqlash</button> : null}
                      {p.status !== "rejected" ? <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => review(p.id, "reject", "rejected")}>Bloklash</button> : null}
                      {p.account?.email ? <button className="adm-btn adm-btn--sm" onClick={() => sendReset(p.account?.email)}>Parol tiklash</button> : null}
                    </div>
                  </td>
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
