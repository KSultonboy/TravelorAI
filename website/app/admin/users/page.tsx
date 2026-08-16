"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, KeyRound, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatusBadge, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type U = { id: string; name?: string; lastName?: string; email?: string; status?: string; blocked?: boolean; role?: string; createdAt?: string; _count?: { trips?: number } };

function fmt(d?: string) { try { return d ? new Date(d).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" }) : "—"; } catch { return "—"; } }

const actionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px",
  borderRadius: 8, border: "1px solid var(--line)", background: "#fff",
  fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};

export default function UsersPage() {
  const [items, setItems] = useState<U[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { api<{ items: U[] }>("/admin/users").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setErr(e.message); }); }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((u) => `${u.name || ""} ${u.lastName || ""} ${u.email || ""}`.toLowerCase().includes(t));
  }, [items, q]);

  async function sendReset(u: U) {
    setBusyId(u.id); setErr(""); setMsg("");
    try {
      const d = await api<{ message: string; devCode?: string }>(`/admin/users/${encodeURIComponent(u.id)}/send-password-reset`, { method: "POST" });
      setMsg(`${d.message}${d.devCode ? ` (dev kod: ${d.devCode})` : ""}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleBlock(u: U) {
    const nextBlocked = !(u.blocked || u.status === "blocked");
    setBusyId(u.id); setErr(""); setMsg("");
    try {
      const d = await api<{ blocked: boolean; status: string }>(`/admin/users/${encodeURIComponent(u.id)}/block`, { method: "PATCH", body: JSON.stringify({ blocked: nextBlocked }) });
      setItems((prev) => (prev || []).map((x) => (x.id === u.id ? { ...x, blocked: d.blocked, status: d.status } : x)));
      setMsg(d.blocked ? `${u.email || "Foydalanuvchi"} bloklandi.` : `${u.email || "Foydalanuvchi"} blokdan chiqarildi.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setBusyId(null);
    }
  }

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
            <thead><tr><th>Ism</th><th>Email</th><th>Rol</th><th>Holat</th><th>Safarlar</th><th>Qo‘shilgan</th><th>Amallar</th></tr></thead>
            <tbody>
              {filtered.map((u) => {
                const blocked = u.blocked || u.status === "blocked";
                return (
                  <tr key={u.id}>
                    <td className="adm-table__title">{[u.name, u.lastName].filter(Boolean).join(" ") || "—"}</td>
                    <td>{u.email || "—"}</td>
                    <td><StatusBadge role={u.role || "traveler"} /></td>
                    <td><StatusBadge status={blocked ? "blocked" : "active"} /></td>
                    <td>{u._count?.trips ?? 0}</td>
                    <td>{fmt(u.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" style={actionBtn} disabled={busyId === u.id} onClick={() => sendReset(u)} title="Parol tiklash kodini foydalanuvchi emailiga yuborish">
                          <KeyRound size={14} /> Parol tiklash
                        </button>
                        <button type="button" style={{ ...actionBtn, color: blocked ? "var(--ok, #15803d)" : "var(--danger, #b91c1c)" }} disabled={busyId === u.id} onClick={() => toggleBlock(u)}>
                          {blocked ? <ShieldCheck size={14} /> : <Ban size={14} />} {blocked ? "Blokdan chiqarish" : "Bloklash"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Toast message={msg || err} />
    </>
  );
}
