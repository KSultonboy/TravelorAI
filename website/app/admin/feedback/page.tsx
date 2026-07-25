"use client";

import { useEffect, useMemo, useState } from "react";
import { Lightbulb, MessageSquareWarning } from "lucide-react";
import { api } from "@/lib/adminApi";
import { StatusBadge, Spinner, EmptyState, Toast } from "@/components/admin/ui";

type Item = {
  id: string; category: string; subject?: string; message: string; status?: string;
  contactEmail?: string; createdAt?: string; user?: { name?: string; email?: string } | null;
};
type Tab = "all" | "complaint" | "suggestion";

function fmt(d?: string) { try { return d ? new Date(d).toLocaleString("uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"; } catch { return "—"; } }

export default function FeedbackPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [toast, setToast] = useState("");

  useEffect(() => { api<{ items: Item[] }>("/admin/feedback?limit=100").then((d) => setItems(d.items || [])).catch((e) => { setItems([]); setToast(e.message); }); }, []);

  const newCount = useMemo(() => (items || []).filter((i) => (i.status || "new") === "new").length, [items]);
  const shown = useMemo(() => (items || []).filter((i) => tab === "all" || i.category === tab), [items, tab]);

  async function toggle(id: string, current: string) {
    if (!items) return;
    const next = current === "resolved" ? "new" : "resolved";
    const prev = items;
    setItems(items.map((i) => (i.id === id ? { ...i, status: next } : i)));
    try { await api(`/admin/feedback/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); }
    catch (e) { setItems(prev); setToast(e instanceof Error ? e.message : "O‘zgartirib bo‘lmadi"); }
  }

  if (!items) return <Spinner />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Barchasi" }, { key: "complaint", label: "Shikoyatlar" }, { key: "suggestion", label: "Takliflar" },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><h1 className="adm-h1">Fikr & shikoyat</h1><p className="adm-sub">Saytdagi aloqa formasidan kelgan murojaatlar.</p></div>
        {newCount > 0 ? <span className="adm-badge adm-badge--new">{newCount} ta yangi</span> : null}
      </div>

      <div style={{ display: "inline-flex", gap: 6, background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: 999, padding: 4, marginBottom: 18 }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className="adm-btn adm-btn--sm" style={{ border: 0, background: tab === t.key ? "var(--primary)" : "transparent", color: tab === t.key ? "#fff" : "var(--muted)" }}>{t.label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Murojaatlar yo‘q" hint="Yangi fikr va shikoyatlar shu yerda ko‘rinadi." />
      ) : (
        <div className="adm-grid adm-grid--2">
          {shown.map((i) => {
            const isComplaint = i.category === "complaint";
            return (
              <div key={i.id} className="adm-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <span className="adm-badge" style={{ background: isComplaint ? "#fff1f3" : "var(--gold-soft)", color: isComplaint ? "var(--danger)" : "#9a6a00" }}>
                    {isComplaint ? <MessageSquareWarning size={13} /> : <Lightbulb size={13} />} {isComplaint ? "Shikoyat" : "Taklif"}
                  </span>
                  <StatusBadge status={i.status || "new"} />
                </div>
                {i.subject ? <b style={{ display: "block", marginBottom: 4 }}>{i.subject}</b> : null}
                <p style={{ color: "var(--ink)", margin: "0 0 12px", lineHeight: 1.6 }}>{i.message}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span className="adm-table__sub">{i.user?.name || "Mehmon"} · {i.contactEmail || i.user?.email || "—"} · {fmt(i.createdAt)}</span>
                  <button className="adm-btn adm-btn--sm" onClick={() => toggle(i.id, i.status || "new")}>{(i.status || "new") === "resolved" ? "Qayta ochish" : "Hal qilindi"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Toast message={toast} />
    </>
  );
}
