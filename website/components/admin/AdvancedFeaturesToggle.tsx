"use client";

import { useState } from "react";
import { api } from "@/lib/adminApi";

/**
 * Agentlik uchun «kengaytirilgan modullar» (API/webhook, avtomatizatsiya, bank
 * solishtirish, payroll, filiallar, hujjat tasdiq/e-imzo, WhatsApp, AI izoh).
 * Backend: PATCH /admin/agencies/:id/advanced-features { enabled }.
 */
export default function AdvancedFeaturesToggle({ agencyId, initial, onError }: {
  agencyId?: string | null;
  initial?: boolean | null;
  onError?: (message: string) => void;
}) {
  const [enabled, setEnabled] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  if (!agencyId) return <span style={{ color: "var(--muted)" }}>—</span>;

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    setEnabled(next);
    try {
      await api(`/admin/agencies/${encodeURIComponent(agencyId as string)}/advanced-features`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: next }),
      });
    } catch (e) {
      setEnabled(!next);
      onError?.(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Kengaytirilgan modullar"
      title="API/webhook, avtomatizatsiya, bank solishtirish, payroll, filiallar, hujjat tasdiq/e-imzo, WhatsApp, AI izoh"
      disabled={busy}
      onClick={() => void toggle()}
      className={`adm-btn adm-btn--sm${enabled ? " adm-btn--primary" : ""}`}
    >
      {enabled ? "Yoqilgan" : "O‘chiq"}
    </button>
  );
}
