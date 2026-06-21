"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Lock, Mail, ShieldCheck } from "lucide-react";
import { adminLogin, adminVerify, ApiError } from "@/lib/adminApi";

export default function AdminLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"login" | "code">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const res = await adminLogin(email.trim().toLowerCase(), password);
      if (res?.requiresEmailCode) setStep("code");
      else setErr("Kutilmagan javob. Qaytadan urinib ko‘ring.");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Kirib bo‘lmadi.");
    } finally { setBusy(false); }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await adminVerify(email.trim().toLowerCase(), code.trim());
      router.replace("/admin");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Kod noto‘g‘ri.");
    } finally { setBusy(false); }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__card">
        <span style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#1a6b3c,#0f5132)", color: "#fff", display: "grid", placeItems: "center" }}>
          <LayoutDashboard size={22} />
        </span>
        {step === "login" ? (
          <>
            <h1>Admin panel</h1>
            <p>Davom etish uchun admin hisobingizga kiring. Tasdiqlash uchun emailga kod yuboriladi.</p>
            {err ? <div className="adm-inline-err">{err}</div> : null}
            <form onSubmit={submitLogin}>
              <div className="adm-field"><label>Email</label><div style={{ position: "relative" }}><Mail size={16} style={{ position: "absolute", left: 13, top: 13, color: "var(--subtle)" }} /><input style={{ paddingLeft: 38 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@travelorai.com" required /></div></div>
              <div className="adm-field"><label>Parol</label><div style={{ position: "relative" }}><Lock size={16} style={{ position: "absolute", left: 13, top: 13, color: "var(--subtle)" }} /><input style={{ paddingLeft: 38 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div></div>
              <button className="adm-btn adm-btn--primary" style={{ width: "100%", padding: 13 }} type="submit" disabled={busy}>{busy ? "Tekshirilmoqda..." : "Davom etish"}</button>
            </form>
          </>
        ) : (
          <>
            <h1>Tasdiqlash kodi</h1>
            <p>{email} manziliga yuborilgan 6 xonali kodni kiriting.</p>
            {err ? <div className="adm-inline-err">{err}</div> : null}
            <form onSubmit={submitCode}>
              <div className="adm-field"><label>Kod</label><div style={{ position: "relative" }}><ShieldCheck size={16} style={{ position: "absolute", left: 13, top: 13, color: "var(--subtle)" }} /><input style={{ paddingLeft: 38, letterSpacing: "0.3em" }} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" required /></div></div>
              <button className="adm-btn adm-btn--primary" style={{ width: "100%", padding: 13 }} type="submit" disabled={busy}>{busy ? "Kirilyapti..." : "Kirish"}</button>
              <button className="adm-btn" style={{ width: "100%", padding: 11, marginTop: 8 }} type="button" onClick={() => { setStep("login"); setCode(""); setErr(""); }}>Orqaga</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
