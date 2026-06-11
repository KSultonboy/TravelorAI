"use client";

import { FormEvent, useCallback, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import GoogleContinueButton from "@/components/GoogleContinueButton";
import { agencyApi } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { Account } from "@/lib/agency/types";

type AuthMode = "login" | "register" | "verify";

export default function AuthScreen() {
  const { refresh } = useAgencySession();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const result = await agencyApi<{ requiresVerification: boolean; delivery?: { devCode?: string } }>(
          "/auth/register",
          { method: "POST", body: JSON.stringify({ email, password }) }
        );
        if (!result.success) throw new Error(result.message);
        setPassword("");
        setMode("verify");
        setMessage(
          result.data.delivery?.devCode
            ? `Tasdiqlash kodi: ${result.data.delivery.devCode}`
            : "Tasdiqlash kodi emailingizga yuborildi."
        );
        return;
      }

      if (mode === "verify") {
        const result = await agencyApi<{ account: Account }>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ email, code }),
        });
        if (!result.success) throw new Error(result.message);
        setPassword("");
        setCode("");
        await refresh();
        return;
      }

      const result = await agencyApi<{ account: Account }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!result.success) {
        if (result.code === "EMAIL_NOT_VERIFIED") setMode("verify");
        throw new Error(result.message);
      }
      setPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleCredential = useCallback(
    async (idToken: string) => {
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const result = await agencyApi<{ account: Account }>("/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken }),
        });
        if (!result.success) throw new Error(result.message);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google orqali kirib bo'lmadi");
      } finally {
        setLoading(false);
      }
    },
    [refresh]
  );

  return (
    <div className="agency-shell agency-shell--auth">
      <aside className="agency-hero">
        <div className="agency-brand">
          <span><Sparkles size={20} /></span>
          <span>TravelorAI Agency</span>
        </div>
        <h1>Tourlaringizni dunyo sayohatchilariga chiqaring.</h1>
        <p>
          Agency profilingizni yuboring, admin tekshiruvidan o&apos;ting va tasdiqlangan tourlarni TravelorAI
          platformalarida ko&apos;rsating.
        </p>
        <ul className="agency-hero-points">
          <li><ShieldCheck size={16} /> Bepul ro&apos;yxatdan o&apos;tish — komissiya yo&apos;q</li>
          <li><ShieldCheck size={16} /> Leadlar to&apos;g&apos;ridan-to&apos;g&apos;ri sizga keladi</li>
          <li><ShieldCheck size={16} /> Mobil ilova va webda bir vaqtda ko&apos;rinasiz</li>
        </ul>
      </aside>

      <div className="agency-auth-pane">
      <form className="agency-card agency-auth" onSubmit={handleSubmit}>
        <span className="agency-eyebrow">
          {mode === "register" ? "YANGI AGENCY" : mode === "verify" ? "EMAIL TASDIQLASH" : "QAYTGAN AGENCY"}
        </span>
        <h2>{mode === "register" ? "Agency ro'yxatdan o'tishi" : mode === "verify" ? "Emailni tasdiqlang" : "Agency login"}</h2>

        {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}
        {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}

        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>

        {mode !== "verify" ? (
          <label>
            Parol
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </label>
        ) : (
          <label>
            Tasdiqlash kodi
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6 xonali kod"
              required
            />
          </label>
        )}

        <button disabled={loading} type="submit">
          {loading ? <Loader2 className="agency-spin" size={18} /> : <ArrowRight size={18} />}
          {mode === "register" ? "Ro'yxatdan o'tish" : mode === "verify" ? "Tasdiqlash" : "Kirish"}
        </button>

        {mode !== "verify" ? (
          <>
            <div className="agency-auth-divider"><span>yoki</span></div>
            <GoogleContinueButton onCredential={handleGoogleCredential} onError={setError} disabled={loading} />
          </>
        ) : null}

        <button
          className="agency-link-button"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
            setMessage("");
          }}
        >
          {mode === "login" ? "Yangi agency akkaunt ochish" : "Login sahifasiga qaytish"}
        </button>
      </form>
      </div>
    </div>
  );
}
