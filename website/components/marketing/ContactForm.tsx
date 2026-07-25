"use client";

import { useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";

type Category = "suggestion" | "complaint";

export default function ContactForm() {
  const [category, setCategory] = useState<Category>("suggestion");
  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 8) { setErr("Xabar kamida 8 ta belgidan iborat bo‘lsin."); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/backend/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ category, subject: subject.trim() || null, message: message.trim(), contactEmail: email.trim() || null, platform: "web" }),
      });
      if (res.ok) { setOk(true); setSubject(""); setMessage(""); setEmail(""); return; }
      if (res.status === 401) { setErr("Xabar yuborish uchun tizimga kiring yoki quyidagi email/Telegram orqali murojaat qiling."); return; }
      const j = await res.json().catch(() => ({}));
      setErr(j?.message || "Xabar yuborilmadi. Keyinroq urinib ko‘ring.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <div className="mkt-form-card" style={{ textAlign: "center" }}>
        <div className="mkt-vcard__icon" style={{ margin: "0 auto" }}><Send size={22} /></div>
        <h3 style={{ margin: 0 }}>Rahmat! Xabaringiz yuborildi</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>Tez orada jamoamiz ko‘rib chiqadi.</p>
        <button className="btn btn--ghost btn--md" type="button" onClick={() => setOk(false)}>Yana xabar yozish</button>
      </div>
    );
  }

  return (
    <form className="mkt-form-card" onSubmit={submit}>
      <div className="mkt-toggle" role="tablist" aria-label="Xabar turi">
        <button type="button" role="tab" aria-selected={category === "suggestion"} className={category === "suggestion" ? "is-active" : ""} onClick={() => setCategory("suggestion")}>Taklif</button>
        <button type="button" role="tab" aria-selected={category === "complaint"} className={category === "complaint" ? "is-active" : ""} onClick={() => setCategory("complaint")}>Shikoyat</button>
      </div>
      {err ? <div className="mkt-alert mkt-alert--error">{err}</div> : null}
      <div className="mkt-field">
        <label htmlFor="c-subject">Mavzu</label>
        <div className="mkt-input"><MessageSquare size={16} /><input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Qisqacha mavzu" maxLength={120} /></div>
      </div>
      <div className="mkt-field">
        <label htmlFor="c-email">Email (ixtiyoriy)</label>
        <div className="mkt-input"><Mail size={16} /><input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@email.com" /></div>
      </div>
      <div className="mkt-field">
        <label htmlFor="c-message">Xabar *</label>
        <div className="mkt-input"><textarea id="c-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Fikr, taklif yoki muammoni yozing..." required /></div>
      </div>
      <button className="btn btn--gold btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Yuborilmoqda..." : "Xabar yuborish"}</button>
    </form>
  );
}
