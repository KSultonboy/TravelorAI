"use client";

import { useState } from "react";
import { agencyApi, formatDateTime } from "@/lib/agency/api";
import { openExternal } from "@/lib/agency/external";
import { markTourPosted, useDistribution } from "./distributionStore";

type TourLike = { id: string; active?: boolean; approvalStatus?: string };

type PostResult = { posted: boolean; postedAt: string; messageUrl?: string | null; withPhoto?: boolean };

/**
 * Tur kartasidagi «Kanalga joylash» (egasi va menejer). Kanal ulanmagan yoki rol
 * mos kelmasa hech narsa ko'rsatilmaydi — sozlash Sozlamalar → Sotuv kanallarida.
 */
export default function ChannelPostButton({ tour, readOnly }: { tour: TourLike; readOnly?: boolean }) {
  const { settings, posts } = useDistribution();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmForce, setConfirmForce] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  if (!settings || !settings.canPost || !settings.channel || !settings.botConnected || !settings.telegramCapability) return null;
  const isPublic = tour.active !== false && tour.approvalStatus === "approved";
  const last = posts[tour.id]?.lastPostedAt || null;

  async function post(force: boolean) {
    if (busy) return;
    setBusy(true); setErr("");
    const res = await agencyApi<PostResult>(`/distribution/tours/${encodeURIComponent(tour.id)}/channel-post`, {
      method: "POST",
      body: JSON.stringify(force ? { force: true } : {}),
    });
    setBusy(false);
    if (res.success) {
      setConfirmForce(false);
      setLastUrl(res.data.messageUrl || null);
      markTourPosted(tour.id, res.data.postedAt);
      return;
    }
    if ((res as { code?: string }).code === "RECENTLY_POSTED") {
      setConfirmForce(true);
      return;
    }
    setErr(res.message || "Kanalga joylab bo‘lmadi.");
  }

  const disabled = busy || readOnly || !isPublic;
  const title = readOnly
    ? "Obuna tugagan — faqat o‘qish rejimi"
    : !isPublic
      ? "Avval turni saytda e‘lon qiling — tugma do‘kon sahifasiga olib boradi"
      : `«${settings.channel.title || settings.channel.username || "kanal"}» kanaliga joylash`;

  return (
    <div style={{ marginTop: 8 }}>
      {confirmForce ? (
        <div className="note" style={{ fontSize: 12.5, marginBottom: 6, padding: 10, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
          Bu tur so‘nggi 10 daqiqada joylangan. Qayta joylansinmi?
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void post(true)} disabled={busy}>{busy ? "Joylanmoqda…" : "Ha, qayta joylash"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmForce(false)} disabled={busy}>Bekor qilish</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={() => void post(false)} disabled={disabled} title={title}>
          {busy ? "Joylanmoqda…" : "Kanalga joylash"}
        </button>
      )}
      {last ? (
        <small style={{ display: "block", marginTop: 4, color: "#8aa398", fontSize: 11.5 }}>
          oxirgi marta joylangan: {formatDateTime(last)}
          {lastUrl ? (
            <>
              {" · "}
              <a href={lastUrl} onClick={(e) => { e.preventDefault(); openExternal(lastUrl); }} style={{ color: "var(--primary)" }}>ko‘rish</a>
            </>
          ) : null}
        </small>
      ) : null}
      {err ? <small style={{ display: "block", marginTop: 4, color: "#F43F5E", fontSize: 12 }}>{err}</small> : null}
    </div>
  );
}
