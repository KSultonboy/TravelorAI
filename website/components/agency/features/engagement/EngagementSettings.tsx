"use client";

// CRM → Sozlamalar → «Xabarnomalar»: yangi lid Telegram xabarnomasi va
// dushanba kungi haftalik hisobot uchun almashtirgichlar + sinov yuborish.
import { useEffect, useState } from "react";
import { agencyApi } from "@/lib/agency/api";

type EngagementSettingsData = {
  leadAlertsEnabled: boolean;
  weeklyDigestEnabled: boolean;
  botConnected: boolean;
  notifyConnected: boolean;
  digestTestsLeft: number;
};

type ToggleKey = "leadAlertsEnabled" | "weeklyDigestEnabled";

function Toggle({ on, disabled, label, hint, onChange }: { on: boolean; disabled?: boolean; label: string; hint: string; onChange: (next: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "space-between" }}>
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 14 }}>{label}</b>
        <div className="sub" style={{ marginTop: 2, fontSize: 12.5 }}>{hint}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`}
        disabled={disabled} onClick={() => onChange(!on)} style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined} />
    </div>
  );
}

export function EngagementSettings({ canEdit = true, go }: { canEdit?: boolean; go?: (view: string) => void }) {
  const [data, setData] = useState<EngagementSettingsData | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ToggleKey | "test" | "">("");

  useEffect(() => {
    let alive = true;
    void agencyApi<EngagementSettingsData>("/engagement/settings").then((res) => {
      if (!alive) return;
      if (res.success) { setData(res.data); setError(""); } else setError(res.message || "Sozlamalarni yuklab bo‘lmadi");
    });
    return () => { alive = false; };
  }, []);

  async function toggle(key: ToggleKey, next: boolean) {
    if (!data) return;
    setBusy(key); setNote("");
    const prev = data;
    setData({ ...data, [key]: next });
    const res = await agencyApi<EngagementSettingsData>("/engagement/settings", { method: "PUT", body: JSON.stringify({ [key]: next }) });
    setBusy("");
    if (res.success) setData(res.data);
    else { setData(prev); setNote(res.message || "Saqlab bo‘lmadi"); }
  }

  async function sendTest() {
    setBusy("test"); setNote("");
    const res = await agencyApi<{ digestTestsLeft: number }>("/engagement/digest/test", { method: "POST" });
    setBusy("");
    if (res.success) {
      setNote("Hisobot Telegram xabarnoma chatingizga yuborildi.");
      if (data) setData({ ...data, digestTestsLeft: res.data.digestTestsLeft });
    } else setNote(res.message || "Yuborib bo‘lmadi");
  }

  if (error) return <div className="card" style={{ padding: 18 }}><b>Xatolik</b><p className="sub" style={{ margin: "6px 0 0" }}>{error}</p></div>;
  if (!data) return <div className="card" style={{ padding: 18 }}><span className="sub">Yuklanmoqda…</span></div>;

  const disabled = !canEdit || !!busy;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {!data.notifyConnected ? (
        <div className="kv-lockbar" role="note">
          <div className="kv-lockbar__tx">
            <b>Telegram xabarnoma chati ulanmagan</b>
            <span>{data.botConnected
              ? "Telegram bo‘limidagi /xabarnoma kodini botingizga yuboring — shundan keyin yangi lidlar telefoningizga darhol keladi."
              : "Avval Telegram bo‘limida agentlik botini ulang, so‘ng /xabarnoma kodini botga yuboring."}</span>
          </div>
          {go ? <button type="button" className="btn btn-primary" onClick={() => go("telegram")}>Telegram</button> : null}
        </div>
      ) : null}

      <div className="card" style={{ padding: 18, display: "grid", gap: 16 }}>
        <Toggle on={data.leadAlertsEnabled} disabled={disabled} label="Yangi lid haqida darhol xabar"
          hint="Sayt, mobil ilova, Telegram, Instagram, WhatsApp va qo‘lda qo‘shilgan har bir lid — «✅ Qabul qildim» tugmasi bilan. Javob vaqti avtomatik o‘lchanadi."
          onChange={(next) => void toggle("leadAlertsEnabled", next)} />
        <Toggle on={data.weeklyDigestEnabled} disabled={disabled} label="Haftalik hisobot (dushanba 09:00)"
          hint="Oxirgi 7 kun: yangi lidlar manbalar bo‘yicha, birinchi javob vaqti, yopilgan bitimlar va tushum, muddati o‘tgan vazifalar."
          onChange={(next) => void toggle("weeklyDigestEnabled", next)} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" disabled={disabled || !data.notifyConnected || data.digestTestsLeft <= 0} onClick={() => void sendTest()}>
            {busy === "test" ? "Yuborilmoqda…" : "Hozir yuborish (sinov)"}
          </button>
          <span className="sub" style={{ fontSize: 12.5 }}>Bugun yana {data.digestTestsLeft} marta yuborish mumkin.</span>
        </div>
        {!canEdit ? <span className="sub" style={{ fontSize: 12.5 }}>Bu sozlamalarni faqat agentlik egasi o‘zgartira oladi.</span> : null}
        {note ? <div className="sub" role="status" style={{ fontSize: 13 }}>{note}</div> : null}
      </div>
    </div>
  );
}
