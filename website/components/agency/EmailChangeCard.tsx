"use client";

import { useState } from "react";
import { BadgeCheck, Clock3, Loader2, Mail, RefreshCw } from "lucide-react";
import { agencyApi, codeCountdown, EMAIL_CODE_TTL_MS } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { Account } from "@/lib/agency/types";

type Busy = "" | "request" | "resend" | "confirm";

export default function EmailChangeCard() {
  const { me, refresh } = useAgencySession();
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!me) return null;
  const account = me.account;
  const countdown = codeCountdown(expiresAt);

  async function call(path: string, body: object | null, busyKind: Busy, onOk: (msg: string) => void) {
    setBusy(busyKind);
    setError("");
    setMessage("");
    try {
      const result = await agencyApi<{ account: Account; message: string; delivery?: { devCode?: string } }>(path, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!result.success) throw new Error(result.message);
      onOk(
        result.data.delivery?.devCode ? `${result.data.message} Kod: ${result.data.delivery.devCode}` : result.data.message
      );
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Amal bajarilmadi");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="agency-email-change">
      <div>
        <h4>Login emailini almashtirish</h4>
        <p>
          Hozirgi email: <b>{account.email}</b>. Tasdiqlash kodi aynan shu eski emailga yuboriladi.
        </p>
      </div>

      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}
      {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}

      {!account.pendingEmail ? (
        <div className="agency-email-change__row">
          <input
            type="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="Yangi email"
          />
          <button
            disabled={Boolean(busy) || !newEmail.trim()}
            onClick={() =>
              call("/auth/email-change/request", { newEmail }, "request", (msg) => {
                setExpiresAt(Date.now() + EMAIL_CODE_TTL_MS);
                setMessage(msg);
              })
            }
            type="button"
          >
            {busy === "request" ? <Loader2 className="agency-spin" size={17} /> : <Mail size={17} />} Kod yuborish
          </button>
        </div>
      ) : (
        <>
          <p>
            Yangi email: <b>{account.pendingEmail}</b>
          </p>
          {countdown ? (
            <p className={`agency-code-timer${countdown === "expired" ? " agency-code-timer--expired" : ""}`}>
              <Clock3 size={15} />
              {countdown === "expired" ? (
                "Kod muddati tugadi — qayta yuboring"
              ) : (
                <>
                  Kod amal qiladi: <b>{countdown}</b>
                </>
              )}
            </p>
          ) : null}
          <div className="agency-email-change__row">
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="6 xonali kod"
            />
            <button
              disabled={Boolean(busy) || code.length !== 6}
              onClick={() =>
                call("/auth/email-change/confirm", { code }, "confirm", (msg) => {
                  setNewEmail("");
                  setCode("");
                  setExpiresAt(null);
                  setMessage(msg);
                })
              }
              type="button"
            >
              {busy === "confirm" ? <Loader2 className="agency-spin" size={17} /> : <BadgeCheck size={17} />} Tasdiqlash
            </button>
            <button
              disabled={Boolean(busy) || (account.emailChangeResendsRemaining || 0) <= 0}
              onClick={() =>
                call("/auth/email-change/resend", null, "resend", (msg) => {
                  setExpiresAt(Date.now() + EMAIL_CODE_TTL_MS);
                  setMessage(msg);
                })
              }
              type="button"
            >
              {busy === "resend" ? <Loader2 className="agency-spin" size={17} /> : <RefreshCw size={17} />} Qayta yuborish (
              {account.emailChangeResendsRemaining ?? 3})
            </button>
          </div>
          {(account.emailChangeResendsRemaining || 0) <= 0 ? (
            <p className="agency-email-support">
              Kod yetib kelmasa supportga murojaat qiling:{" "}
              <a href={`mailto:${me.supportEmail || "support@travelorai.local"}`}>
                {me.supportEmail || "support@travelorai.local"}
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
