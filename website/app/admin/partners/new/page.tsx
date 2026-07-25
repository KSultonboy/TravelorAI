"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/adminApi";

export default function NewPartnerPage() {
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!email.trim() || password.length < 8) { setErr("Email va kamida 8 belgili parol majburiy."); return; }
    setBusy(true);
    try {
      await api("/admin/business", { method: "POST", body: JSON.stringify({ name: business.trim(), email: email.trim().toLowerCase(), password, role: "PARTNER" }) });
      setOk(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Yaratib bo‘lmadi.");
    } finally { setBusy(false); }
  }

  return (
    <>
      <Link href="/admin/partners" className="adm-btn adm-btn--sm" style={{ marginBottom: 16 }}><ArrowLeft size={15} /> Hamkorlar</Link>
      <h1 className="adm-h1">Yangi hamkor</h1>
      <p className="adm-sub">To‘g‘ridan-to‘g‘ri tasdiqlangan hamkor hisobi yaratiladi.</p>

      <div className="adm-card" style={{ maxWidth: 460, padding: 26 }}>
        {ok ? (
          <div style={{ textAlign: "center" }}>
            <span className="adm-stat__icon" style={{ margin: "0 auto 12px", background: "#e9f9f1", color: "var(--success)" }}><CheckCircle2 size={22} /></span>
            <h3 style={{ margin: "0 0 6px" }}>Hamkor yaratildi ✅</h3>
            <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>Hisob tasdiqlangan holatda. Hamkor agentlik portaliga kira oladi.</p>
            <Link className="adm-btn adm-btn--primary" href="/admin/partners">Hamkorlarga qaytish</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {err ? <div className="adm-inline-err">{err}</div> : null}
            <div className="adm-field"><label>Biznes nomi</label><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Masalan: Guli Travel" /></div>
            <div className="adm-field"><label>Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agentlik@email.com" required /></div>
            <div className="adm-field"><label>Parol *</label><input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 8 belgi" required /></div>
            <button className="adm-btn adm-btn--primary" style={{ width: "100%", padding: 13 }} type="submit" disabled={busy}>{busy ? "Yaratilmoqda..." : "Hamkor yaratish"}</button>
          </form>
        )}
      </div>
    </>
  );
}
