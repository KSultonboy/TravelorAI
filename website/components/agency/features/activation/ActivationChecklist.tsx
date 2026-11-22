"use client";

import { useCallback, useEffect, useState } from "react";
import { agencyApi } from "@/lib/agency/api";

type ActivationStep = {
  key: string;
  title: string;
  hint: string;
  section: string;
  done: boolean;
  skipped: boolean;
};

type ActivationState = {
  steps: ActivationStep[];
  done: number;
  total: number;
  percent: number;
  complete: boolean;
  next: { key: string; section: string; title: string } | null;
  dismissed: boolean;
};

// Sozlamalar ichidagi qaysi bo'limni ochish kerakligi — foydalanuvchiga yo'l-yo'riq.
const WHERE: Record<string, string> = {
  profile: "Sozlamalar → Agentlik ma’lumotlari",
  team: "Sozlamalar → Jamoa va rollar",
};

function isState(value: unknown): value is ActivationState {
  return !!value && typeof value === "object" && Array.isArray((value as ActivationState).steps);
}

/**
 * CRM bosh sahifasidagi «Ishga tushirish» ro'yxati (GET /agency/activation).
 * Endpoint yo'q yoki xato bo'lsa — hech narsa ko'rsatmaydi (CRM'ni to'smaydi).
 * 100% bo'lganda egasi yopishi mumkin — holat serverda saqlanadi.
 */
export default function ActivationChecklist({ show, go, canDismiss }: {
  show: boolean;
  go: (section: string) => void;
  canDismiss: boolean;
}) {
  const [state, setState] = useState<ActivationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await agencyApi<ActivationState>("/activation");
    setState(r.success && isState(r.data) ? r.data : null);
  }, []);

  // Bosh sahifaga har qaytilganda yangilanadi (masalan bot ulangandan keyin).
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [show, load]);

  async function dismiss() {
    setBusy(true);
    setError("");
    const r = await agencyApi<ActivationState>("/activation/dismiss", { method: "POST" });
    setBusy(false);
    if (r.success) setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
    else setError(r.message || "Yopib bo‘lmadi");
  }

  if (!show || !state || state.dismissed) return null;
  const steps = state.steps.filter((s) => !s.skipped);
  if (!steps.length) return null;

  return (
    <section className="card act-card" aria-labelledby="act-title">
      <div className="act-head">
        <div>
          <h2 id="act-title">{state.complete ? "Hammasi tayyor!" : "CRMni ishga tushiring"}</h2>
          <div className="sub">
            {state.complete
              ? "Barcha asosiy qadamlar bajarildi. Endi lidlar va takliflarga e’tibor qarating."
              : `${state.done} / ${state.total} qadam bajarildi — keyingisi: ${state.next?.title || ""}`}
          </div>
        </div>
        <div className="act-pct" aria-hidden="true">{state.percent}%</div>
      </div>
      <div className="act-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent} aria-label="Aktivatsiya jarayoni">
        <span style={{ width: `${state.percent}%` }} />
      </div>

      <ol className="act-list">
        {steps.map((step) => {
          const isNext = state.next?.key === step.key;
          return (
            <li key={step.key} className={`act-step${step.done ? " done" : ""}${isNext ? " next" : ""}`}>
              <span className="act-dot" aria-hidden="true">
                {step.done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : null}
              </span>
              <div className="act-tx">
                <b>{step.title}</b>
                {!step.done ? <small>{step.hint}{WHERE[step.key] ? ` (${WHERE[step.key]})` : ""}</small> : null}
              </div>
              {!step.done ? (
                <button type="button" className={`btn btn-sm ${isNext ? "btn-primary" : "btn-ghost"}`} onClick={() => go(step.section)}>
                  {isNext ? "Boshlash" : "Ochish"}
                </button>
              ) : <span className="sr-only">Bajarildi</span>}
            </li>
          );
        })}
      </ol>

      {state.complete && canDismiss ? (
        <div className="act-foot">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void dismiss()}>
            {busy ? "…" : "Ro‘yxatni yopish"}
          </button>
          {error ? <span className="act-err">{error}</span> : null}
        </div>
      ) : null}

      <style jsx>{`
        .act-card{padding:18px 20px;margin-bottom:16px}
        .act-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .act-head h2{margin:0;font-size:17px}
        .act-pct{font:700 24px/1 var(--disp, inherit);color:var(--primary)}
        .act-bar{height:8px;border-radius:999px;background:var(--border);overflow:hidden;margin:12px 0 6px}
        .act-bar span{display:block;height:100%;border-radius:999px;background:var(--primary);transition:width .4s ease}
        .act-list{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:2px}
        .act-step{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:10px;padding:9px 8px;border-radius:10px}
        .act-step.next{background:var(--primary-soft)}
        .act-dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--border);display:grid;place-items:center;color:#fff}
        .act-step.done .act-dot{background:var(--primary);border-color:var(--primary)}
        .act-step.done .act-tx b{color:var(--t3);text-decoration:line-through;font-weight:500}
        .act-tx{min-width:0;display:grid;gap:2px}
        .act-tx small{color:var(--t2);font-size:12.5px;line-height:1.45}
        .act-foot{display:flex;align-items:center;gap:10px;margin-top:10px}
        .act-err{color:#b42318;font-size:12.5px}
        @media(max-width:640px){.act-step{grid-template-columns:24px 1fr}.act-step :global(.btn){grid-column:2;justify-self:start}}
      `}</style>
    </section>
  );
}
