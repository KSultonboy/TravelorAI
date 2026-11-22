"use client";

import { useState } from "react";
import { agencyApi } from "@/lib/agency/api";
import { openExternal } from "@/lib/agency/external";
import { patchDistribution, reloadDistribution, useDistribution, type DistributionChannel } from "./distributionStore";

const OWNER_ONLY = "Bu sozlamani faqat agentlik egasi o‘zgartira oladi.";
const READ_ONLY = "Obuna tugagan — faqat o‘qish rejimi";
const REQUISITES_MAX = 500;

function withUtm(url: string, source: string, medium: string) {
  return `${url}?utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(medium)}`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard yopiq — havola maydonda ko'rinib turibdi */
    }
  }
  return (
    <div className="fld" style={{ marginBottom: 10 }}>
      <label>{label}</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 260px", minWidth: 0, width: "auto" }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy()}>{copied ? "Nusxalandi ✓" : "Nusxalash"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openExternal(value)}>Ochish</button>
      </div>
    </div>
  );
}

function StorefrontCard({ url }: { url: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 4px" }}>Do‘kon sahifasi</h3>
      <p style={{ margin: "0 0 14px", color: "var(--t2)", fontSize: 13.5, lineHeight: 1.6 }}>
        Agentligingizning ommaviy sahifasi: barcha e‘lon qilingan turlar va so‘rov shakli. Instagram bio, Telegram kanal
        tavsifi yoki xabarlarda ulashing — kelgan so‘rovlar «Lidlar»ga manbasi bilan tushadi.
      </p>
      <CopyRow label="Asosiy havola" value={url} />
      <CopyRow label="Instagram bio uchun (manba avtomatik belgilanadi)" value={withUtm(url, "instagram", "bio")} />
    </div>
  );
}

function ChannelCard({ readOnly }: { readOnly?: boolean }) {
  const { settings } = useDistribution();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  if (!settings) return null;
  const channel = settings.channel;
  const canManage = settings.canManage && !readOnly;

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) { setErr("Kanal manzilini kiriting: @kanal_nomi yoki -100… id."); return; }
    setBusy(true); setErr(""); setMsg("");
    const res = await agencyApi<{ channel: DistributionChannel }>("/distribution/channel", {
      method: "PUT",
      body: JSON.stringify({ channel: input.trim() }),
    });
    setBusy(false);
    if (res.success) {
      patchDistribution({ channel: res.data.channel });
      setInput("");
      setMsg("Kanal ulandi ✓");
    } else setErr(res.message || "Kanalni ulab bo‘lmadi.");
  }

  async function disconnect() {
    setBusy(true); setErr(""); setMsg("");
    const res = await agencyApi("/distribution/channel", { method: "DELETE" });
    setBusy(false);
    if (res.success) patchDistribution({ channel: null });
    else setErr(res.message || "Kanalni uzib bo‘lmadi.");
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 4px" }}>Telegram kanal</h3>
      <p style={{ margin: "0 0 14px", color: "var(--t2)", fontSize: 13.5, lineHeight: 1.6 }}>
        Kanal ulansa, «Turlar» bo‘limidagi har bir turda <b>«Kanalga joylash»</b> tugmasi paydo bo‘ladi: rasm, narx va
        «Batafsil va bron» tugmasi bilan post bir bosishda chiqadi.
      </p>
      {!settings.telegramCapability ? (
        <div className="note">Telegram imkoniyatlari tarifingizda yo‘q. Yuqoriroq tarifga o‘ting.</div>
      ) : !settings.botConnected ? (
        <div className="note">Avval agentlik Telegram botini ulang (Sozlamalar → Ulanishlar → Telegram). Kanalga post shu bot nomidan chiqadi.</div>
      ) : channel ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="badge2 b-green">Ulangan</span>
          <b>{channel.title || channel.id}</b>
          {channel.username ? (
            <a href={`https://t.me/${channel.username}`} onClick={(e) => { e.preventDefault(); openExternal(`https://t.me/${channel.username}`); }} style={{ color: "var(--primary)" }}>
              @{channel.username}
            </a>
          ) : null}
          {canManage ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void disconnect()} disabled={busy}>Uzish</button>
          ) : null}
        </div>
      ) : canManage ? (
        <form onSubmit={connect}>
          <ol style={{ margin: "0 0 12px", paddingLeft: 18, color: "var(--t2)", fontSize: 13.5, lineHeight: 1.7 }}>
            <li>Botingizni{settings.botUsername ? <> (<b>@{settings.botUsername}</b>)</> : null} kanalga <b>administrator</b> qilib qo‘shing va «Xabar joylash» huquqini bering.</li>
            <li>Kanal manzilini kiriting: <code>@kanal_nomi</code> yoki yopiq kanal uchun <code>-100…</code> id.</li>
          </ol>
          <div className="fld" style={{ marginBottom: 0 }}>
            <label htmlFor="dist-channel">Kanal</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input id="dist-channel" value={input} onChange={(e) => setInput(e.target.value)} placeholder="@kanal_nomi" maxLength={100} style={{ flex: "1 1 220px", minWidth: 0, width: "auto" }} />
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Tekshirilmoqda…" : "Ulash"}</button>
            </div>
          </div>
        </form>
      ) : (
        <div className="note">Kanal hali ulanmagan. {readOnly ? READ_ONLY : OWNER_ONLY}</div>
      )}
      {err ? <div className="note note-err" style={{ marginTop: 10 }}>{err}</div> : null}
      {msg ? <div style={{ marginTop: 10, color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</div> : null}
    </div>
  );
}

function PaymentCard({ readOnly }: { readOnly?: boolean }) {
  const { settings } = useDistribution();
  // Karta faqat sozlamalar yuklangach chiziladi (DistributionSettings) — boshlang'ich
  // qiymat shu yerdan olinadi, saqlangach mahalliy holat allaqachon saqlanganga teng.
  const [url, setUrl] = useState(settings?.payment.url || "");
  const [requisites, setRequisites] = useState(settings?.payment.requisites || "");
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  if (!settings) return null;
  const canManage = settings.canManage && !readOnly;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg("");
    const res = await agencyApi<{ payment: { url: string | null; requisites: string | null } }>("/distribution/payment", {
      method: "PUT",
      body: JSON.stringify({ paymentLinkUrl: url.trim(), paymentRequisitesText: requisites, allowCustomHost: custom }),
    });
    setBusy(false);
    if (res.success) {
      patchDistribution({ payment: { ...settings!.payment, ...res.data.payment } });
      setMsg("Saqlandi ✓");
    } else setErr(res.message || "Saqlab bo‘lmadi.");
  }

  return (
    <form className="card" style={{ padding: 18 }} onSubmit={save}>
      <h3 style={{ margin: "0 0 4px" }}>Taklif sahifasida to‘lov</h3>
      <p style={{ margin: "0 0 14px", color: "var(--t2)", fontSize: 13.5, lineHeight: 1.6 }}>
        Mijozga yuborilgan taklif sahifasida «To‘lash» tugmasi va/yoki bank rekvizitlaringiz ko‘rinadi. Pul to‘g‘ridan-to‘g‘ri
        sizga tushadi; tugma bosilgani «Takliflar» bo‘limida ko‘rinadi.
      </p>
      <div className="fld">
        <label>To‘lov havolasi (https)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://my.click.uz/… yoki https://payme.uz/…" maxLength={500} disabled={!canManage} />
        <small style={{ color: "var(--t3, #8aa398)" }}>Ruxsat etilgan: {settings.payment.allowlist.join(", ")}</small>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, margin: "8px 0 12px", color: "var(--t2)" }}>
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} disabled={!canManage} style={{ marginTop: 3 }} />
        <span>Ro‘yxatda yo‘q boshqa sayt (faqat https) — bu havola o‘zimizniki ekanini tasdiqlayman</span>
      </label>
      <div className="fld">
        <label>Bank rekvizitlari (ixtiyoriy)</label>
        <textarea value={requisites} onChange={(e) => setRequisites(e.target.value.slice(0, REQUISITES_MAX))} rows={4} placeholder={"MCHJ «…»\nH/r: 2020 8000 …\nBank: … MFO: …\nSTIR: …"} disabled={!canManage} />
        <small style={{ color: "var(--t3, #8aa398)" }}>{requisites.length}/{REQUISITES_MAX}</small>
      </div>
      {err ? <div className="note note-err" style={{ marginBottom: 10 }}>{err}</div> : null}
      {canManage ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
          {msg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</span> : null}
        </div>
      ) : (
        <div className="note">{readOnly ? READ_ONLY : OWNER_ONLY}</div>
      )}
    </form>
  );
}

/** Sozlamalar → «Sotuv kanallari»: storefront havolasi, Telegram kanal, to'lov havolasi. */
export default function DistributionSettings({ readOnly }: { readOnly?: boolean }) {
  const { status, error, settings } = useDistribution();

  if (!settings) {
    return (
      <div className="card" style={{ padding: 18 }}>
        {status === "error" ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="note note-err" style={{ margin: 0 }}>{error}</div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reloadDistribution()}>Qayta urinish</button>
          </div>
        ) : (
          <span style={{ color: "var(--t2)" }}>Yuklanmoqda…</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <StorefrontCard url={settings.storefrontUrl} />
      <ChannelCard readOnly={readOnly} />
      <PaymentCard readOnly={readOnly} />
    </div>
  );
}
