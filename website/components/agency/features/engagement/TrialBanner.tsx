"use client";

// Sinov muddati banneri (KvCabinet kontent tepasida). Ma'lumot /auth/me →
// access.accessState / access.trialEndsAt / access.daysLeft dan keladi.
import { requestSettingsTab } from "./settingsTab";

export type TrialAccess = {
  accessState?: string | null;
  trialEndsAt?: string | null;
  daysLeft?: number | null;
  readOnly?: boolean;
} | null | undefined;

export function isTrialExpired(access: TrialAccess) {
  return access?.accessState === "trial_expired";
}

function formatDay(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" });
}

const CLOCK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2";

export function TrialBanner({ access, go, canPay = true }: { access: TrialAccess; go: (view: string) => void; canPay?: boolean }) {
  const state = access?.accessState;
  if (state !== "trial" && state !== "trial_expired") return null;
  const expired = state === "trial_expired";
  const days = Math.max(0, Number(access?.daysLeft ?? 0));
  const until = formatDay(access?.trialEndsAt);

  const openPlans = () => {
    go("settings");
    requestSettingsTab("plan");
  };

  return (
    <div className="kv-lockbar" role="status" aria-live="polite" style={expired ? undefined : { background: "var(--surface)", borderColor: "var(--line, #e6cf92)" }}>
      <span className="kv-lockbar__ic" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={CLOCK} /></svg>
      </span>
      <div className="kv-lockbar__tx">
        {expired ? (
          <>
            <b>Sinov muddati tugadi — ma’lumotlaringiz saqlangan, davom etish uchun tarif tanlang</b>
            <span>Hozir kabinet faqat o‘qish rejimida: lidlar, mijozlar va hisobotlar ko‘rinadi, yangi o‘zgarishlar to‘lovdan keyin ochiladi.</span>
          </>
        ) : (
          <>
            <b>Sinov muddati: {days} kun qoldi</b>
            <span>{until ? `${until} gacha` : "Sinov davrida"} Pro tarifining barcha imkoniyatlari ochiq. Ishni to‘xtatmaslik uchun oldindan tarif tanlang.</span>
          </>
        )}
      </div>
      {canPay ? (
        <button type="button" className={`btn ${expired || days <= 3 ? "btn-primary" : "btn-ghost"}`} onClick={openPlans}>Tarif tanlash</button>
      ) : null}
    </div>
  );
}
