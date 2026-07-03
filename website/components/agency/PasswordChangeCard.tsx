"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2, Save } from "lucide-react";
import { agencyApi } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { Account } from "@/lib/agency/types";

type PasswordChangeCardProps = {
  forced?: boolean;
};

export default function PasswordChangeCard({ forced = false }: PasswordChangeCardProps) {
  const { refresh } = useAgencySession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("Yangi parol kamida 8 belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Yangi parol va takroriy parol bir xil emas.");
      return;
    }

    setBusy(true);
    const result = await agencyApi<{ account: Account; message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: forced ? "" : currentPassword,
        newPassword,
      }),
    });

    if (result.success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(result.data.message || "Parol yangilandi.");
      await refresh(true);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  return (
    <form className={`agency-card agency-password-card${forced ? " agency-password-card--forced" : ""}`} onSubmit={handleSubmit}>
      <div className="agency-password-head">
        <span><KeyRound size={18} /></span>
        <div>
          <p className="agency-eyebrow">{forced ? "Majburiy xavfsizlik" : "Xavfsizlik"}</p>
          <h3>{forced ? "O'zingizga qulay parol qo'ying" : "Parolni almashtirish"}</h3>
          <p className="agency-muted">
            {forced
              ? "Siz vaqtinchalik parol bilan kirdingiz. Kabinetga kirishdan oldin yangi parol tanlang."
              : "Keyingi loginlarda yangi paroldan foydalanasiz."}
          </p>
        </div>
      </div>

      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}
      {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}

      <div className="agency-form-grid agency-form-grid--single">
        {!forced ? (
          <label>
            <span>Joriy parol</span>
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        ) : null}

        <label>
          <span>Yangi parol</span>
          <input
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label>
          <span>Yangi parolni takrorlang</span>
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      </div>

      <div className="agency-actions">
        <button disabled={busy} type="submit">
          {busy ? <Loader2 className="agency-spin" size={17} /> : forced ? <KeyRound size={17} /> : <Save size={17} />}
          {forced ? "Parolni qo'yish va davom etish" : "Parolni yangilash"}
        </button>
      </div>
    </form>
  );
}
