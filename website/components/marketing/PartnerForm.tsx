"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Lock, Mail, Phone, User } from "lucide-react";

export default function PartnerForm() {
  const [business, setBusiness] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!business.trim() || !email.trim() || password.length < 8) {
      setErr("Biznes nomi, email va kamida 8 belgili parol majburiy.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/agency-proxy/agency/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok || j?.success) { setOk(true); return; }
      setErr(j?.message || "Ariza yuborilmadi. Email avval ro‘yxatdan o‘tgan bo‘lishi mumkin.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="mkt-form-card" style={{ textAlign: "center" }}>
        <div className="mkt-vcard__icon" style={{ margin: "0 auto", background: "var(--gold-soft)", color: "#9a6a00" }}><CheckCircle2 size={24} /></div>
        <h3 style={{ margin: 0 }}>Arizangiz qabul qilindi 🎉</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Emailingizga tasdiqlash kodi yuborildi. Hisobni tasdiqlagach, ariza admin tomonidan ko‘rib chiqiladi (holat: <b>kutilmoqda</b>) va tasdiqlangach agentlik portaliga kirasiz.
        </p>
        <a className="btn btn--navy btn--md" href="/signin?role=partner&next=/agency">Kirish sahifasiga o‘tish</a>
      </div>
    );
  }

  return (
    <form className="mkt-form-card" onSubmit={submit}>
      <h3 style={{ margin: "0 0 4px" }}>Hamkorlik arizasi</h3>
      <p style={{ color: "var(--muted)", margin: "0 0 6px", fontSize: "0.9rem" }}>To‘ldiring — jamoamiz 1 ish kuni ichida bog‘lanadi.</p>
      {err ? <div className="mkt-alert mkt-alert--error">{err}</div> : null}
      <div className="mkt-field"><label>Biznes nomi *</label><div className="mkt-input"><Building2 size={16} /><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Masalan: Guli Travel" required /></div></div>
      <div className="mkt-field"><label>Mas’ul shaxs</label><div className="mkt-input"><User size={16} /><input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ism familiya" /></div></div>
      <div className="mkt-field"><label>Email *</label><div className="mkt-input"><Mail size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agentlik@email.com" required /></div></div>
      <div className="mkt-field"><label>Telefon</label><div className="mkt-input"><Phone size={16} /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 .." /></div></div>
      <div className="mkt-field"><label>Parol *</label><div className="mkt-input"><Lock size={16} /><input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 8 belgi" required /></div></div>
      <button className="btn btn--gold btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Yuborilmoqda..." : "Ariza yuborish"}</button>
    </form>
  );
}
