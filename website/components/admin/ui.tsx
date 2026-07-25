"use client";

import { useState, type ReactNode } from "react";
import { Inbox } from "lucide-react";

const LABELS: Record<string, string> = {
  pending: "Kutilmoqda", approved: "Tasdiqlangan", blocked: "Bloklangan",
  confirmed: "Tasdiqlangan", cancelled: "Bekor qilingan", rejected: "Rad etilgan",
  completed: "Yakunlangan", active: "Faol", new: "Yangi", resolved: "Hal qilingan",
  admin: "Admin", partner: "Hamkor", traveler: "Sayohatchi",
};

export function StatusBadge({ status, role }: { status?: string; role?: string }) {
  if (role) return <span className={`adm-badge adm-badge--role-${role}`}>{LABELS[role] || role}</span>;
  const s = (status || "").toLowerCase();
  return <span className={`adm-badge adm-badge--${s || "navy"}`}>{LABELS[s] || status || "—"}</span>;
}

export function StatCard({ icon, num, label }: { icon: ReactNode; num: ReactNode; label: string }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat__top"><span className="adm-stat__icon">{icon}</span></div>
      <div className="adm-stat__num">{num}</div>
      <div className="adm-stat__label">{label}</div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty__icon"><Inbox size={26} /></div>
      <div style={{ fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>{title}</div>
      {hint ? <div style={{ fontSize: "0.88rem" }}>{hint}</div> : null}
    </div>
  );
}

export function Spinner() {
  return <div className="adm-spin" role="status" aria-label="Yuklanmoqda" />;
}

export function Toast({ message, type = "error" }: { message: string; type?: "error" | "ok" }) {
  if (!message) return null;
  return <div className={`adm-toast adm-toast--${type}`} role="status">{message}</div>;
}

/** Tasdiqlovchi (destructive) tugma — bosilganda "Aniqmi?" holatiga o'tadi */
export function ConfirmButton({
  label = "O‘chirish",
  confirmLabel = "Aniqmi? Bosing",
  onConfirm,
  className = "adm-btn adm-btn--danger adm-btn--sm",
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
      }}
    >
      {busy ? "..." : armed ? confirmLabel : label}
    </button>
  );
}
