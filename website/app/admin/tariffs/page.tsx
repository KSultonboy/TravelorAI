"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { api } from "@/lib/adminApi";
import { Spinner, EmptyState, Toast, ConfirmButton } from "@/components/admin/ui";

type Tariff = {
  id: string; name: string; slug: string; priceMonthly: number; commissionPct: number;
  features?: string | null; sortOrder: number; active: boolean; agencyCount?: number;
};
type Draft = { id?: string; name: string; priceMonthly: string; commissionPct: string; features: string; sortOrder: string; active: boolean };

const EMPTY: Draft = { name: "", priceMonthly: "0", commissionPct: "15", features: "", sortOrder: "0", active: true };

export default function TariffsPage() {
  const [items, setItems] = useState<Tariff[] | null>(null);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { const d = await api<{ items: Tariff[] }>("/admin/tariffs"); setItems(d.items || []); }
    catch (e) { setItems([]); setToast(e instanceof Error ? e.message : "Xato"); }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) { setToast("Nomini kiriting"); return; }
    setBusy(true);
    const body = JSON.stringify({
      name: editing.name.trim(),
      priceMonthly: Number(editing.priceMonthly) || 0,
      commissionPct: Number(editing.commissionPct) || 0,
      features: editing.features,
      sortOrder: Number(editing.sortOrder) || 0,
      active: editing.active,
    });
    try {
      if (editing.id) await api(`/admin/tariffs/${editing.id}`, { method: "PUT", body });
      else await api("/admin/tariffs", { method: "POST", body });
      setEditing(null); await load();
    } catch (e) { setToast(e instanceof Error ? e.message : "Saqlab bo‘lmadi"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await api(`/admin/tariffs/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setToast(e instanceof Error ? e.message : "O‘chirib bo‘lmadi"); }
  }

  if (!items) return <Spinner />;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><h1 className="adm-h1">Tariflar</h1><p className="adm-sub">Agentliklar uchun obuna rejalari.</p></div>
        <button className="adm-btn adm-btn--primary" onClick={() => setEditing({ ...EMPTY })}><Plus size={16} /> Yangi tarif</button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Tarif yo‘q" hint="Birinchi tarif rejasini qo‘shing." />
      ) : (
        <div className="adm-grid adm-grid--3" style={{ marginTop: 18 }}>
          {items.map((t) => (
            <div key={t.id} className="adm-card" style={{ padding: 20, opacity: t.active ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <b style={{ fontSize: 16 }}>{t.name}{!t.active ? " (nofaol)" : ""}</b>
                <span className="adm-badge">{t.agencyCount ?? 0} agentlik</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--primary)" }}>
                {t.priceMonthly > 0 ? `$${t.priceMonthly}` : "Kelishiladi"}
                {t.priceMonthly > 0 ? <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400 }}> /oy</span> : null}
              </div>
              <div className="adm-table__sub" style={{ margin: "4px 0 10px" }}>Komissiya: {t.commissionPct}% (sof foyda)</div>
              {t.features ? (
                <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", fontSize: 13, color: "var(--ink)" }}>
                  {t.features.split("|").filter(Boolean).map((f, i) => <li key={i} style={{ padding: "2px 0" }}>• {f.trim()}</li>)}
                </ul>
              ) : null}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="adm-btn adm-btn--sm" onClick={() => setEditing({ id: t.id, name: t.name, priceMonthly: String(t.priceMonthly), commissionPct: String(t.commissionPct), features: t.features || "", sortOrder: String(t.sortOrder), active: t.active })}><Pencil size={13} /> Tahrir</button>
                <ConfirmButton label="O‘chirish" onConfirm={() => remove(t.id)} className="adm-btn adm-btn--danger adm-btn--sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setEditing(null)}>
          <div className="adm-card" style={{ width: "min(440px,100%)", padding: 22 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>{editing.id ? "Tarifni tahrirlash" : "Yangi tarif"}</h2>
            <div className="adm-field"><label>Nomi</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Masalan: Pro" /></div>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Narx/oy ($)</label><input type="number" value={editing.priceMonthly} onChange={(e) => setEditing({ ...editing, priceMonthly: e.target.value })} /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Komissiya (%)</label><input type="number" value={editing.commissionPct} onChange={(e) => setEditing({ ...editing, commissionPct: e.target.value })} /></div>
            </div>
            <div className="adm-field"><label>Imkoniyatlar ( | belgisi bilan ajrating)</label><input value={editing.features} onChange={(e) => setEditing({ ...editing, features: e.target.value })} placeholder="Leadlar|Pipeline|Analitika" /></div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
              <div className="adm-field" style={{ width: 110, marginBottom: 0 }}><label>Tartib</label><input type="number" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value })} /></div>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, paddingBottom: 12 }}><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Faol</label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="adm-btn" onClick={() => setEditing(null)}>Bekor</button>
              <button className="adm-btn adm-btn--primary" disabled={busy} onClick={() => void save()}>{busy ? "..." : "Saqlash"}</button>
            </div>
          </div>
        </div>
      ) : null}
      <Toast message={toast} />
    </>
  );
}
