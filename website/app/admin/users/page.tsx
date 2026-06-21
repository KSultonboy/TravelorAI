"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatusBadge, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type U = { id: string; name?: string; lastName?: string; email?: string; status?: string; role?: string; createdAt?: string; _count?: { trips?: number } };

function fmt(d?: string) { try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; } }

export default function UsersPage() {
  const [items, setItems] = useState<U[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { api<{ items: U[] }>("/admin/users").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setErr(e.message); }); }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((u) => `${u.name || ""} ${u.lastName || ""} ${u.email || ""}`.toLowerCase().includes(t));
  }, [items, q]);

  if (!items) return <Spinner />;
  return (
    <>
      <h1 className="adm-h1">Foydalanuvchilar</h1>
      <p className="adm-sub">Ro‘yxatdan o‘tgan foydalanuvchilar — {items.length} ta.</p>

      <div className="adm-top__search" style={{ maxWidth: 360, marginBottom: 18, background: "#fff", border: "1px solid var(--line)" }}>
        <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki email bo‘yicha qidirish" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Topilmadi" hint="Qidiruvni o‘zgartiring." />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Ism</th><th>Email</th><th>Rol</th><th>Holat</th><th>Safarlar</th><th>Qo‘shilgan</th></tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="adm-table__title">{[u.name, u.lastName].filter(Boolean).join(" ") || "—"}</td>
                  <td>{u.email || "—"}</td>
                  <td><StatusBadge role={u.role || "traveler"} /></td>
                  <td><StatusBadge status={u.status || "active"} /></td>
                  <td>{u._count?.trips ?? 0}</td>
                  <td>{fmt(u.createdAt)}</td>
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
