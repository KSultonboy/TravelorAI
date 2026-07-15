"use client";

import { useState } from "react";

const GREEN = "#1a6b3c";
const GOLD = "#c9a227";

export default function UserResetForm({ email, code }: { email: string; code: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const invalidLink = !email || !code;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) return setErr("Parol kamida 8 ta belgidan iborat bo‘lsin.");
    if (pw !== pw2) return setErr("Parollar mos kelmadi.");
    setBusy(true);
    try {
      const res = await fetch("/api/backend/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ email, code, newPassword: pw }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        setErr(json?.message || "Havola xato yoki muddati tugagan.");
        return;
      }
      setDone(true);
      // Parol yangilangach — foydalanuvchi login sahifasiga o'tkazamiz.
      setTimeout(() => { window.location.href = "/signin"; }, 1800);
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  const wrap: React.CSSProperties = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f7f5", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" };
  const card: React.CSSProperties = { width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e6ede8", borderRadius: 20, padding: 32, boxShadow: "0 10px 30px rgba(16,31,22,.06)" };
  const input: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d7e2da", fontSize: 15, marginTop: 6, boxSizing: "border-box" };
  const btn: React.CSSProperties = { width: "100%", padding: "13px", borderRadius: 12, border: "none", background: GREEN, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 16 };

  return (
    <div style={wrap}>
      <div style={card}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: GREEN, fontWeight: 700 }}>TravelorAI</p>
        <h1 style={{ margin: "8px 0 4px", fontSize: 24, color: "#122117" }}>Parolni yangilash</h1>

        {invalidLink ? (
          <p style={{ color: "#b91c1c", marginTop: 14, lineHeight: 1.6 }}>
            Havola to‘liq emas yoki eskirgan. Iltimos, emaildagi tugmani qaytadan bosing yoki yangi havola so‘rang.
          </p>
        ) : done ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ color: GREEN, fontWeight: 600, lineHeight: 1.6 }}>✅ Parol yangilandi! Kirish sahifasiga o‘tkazilyapmiz...</p>
            <a href="/signin" style={{ ...btn, display: "block", textAlign: "center", textDecoration: "none", background: GOLD, color: "#1c1400" }}>Kirish sahifasiga o‘tish</a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p style={{ color: "#4f6355", fontSize: 14, lineHeight: 1.6, margin: "6px 0 18px" }}>
              <strong>{email}</strong> uchun yangi parol o‘rnating.
            </p>
            <label style={{ fontSize: 13, color: "#2f4136", fontWeight: 600 }}>
              Yangi parol
              <input style={input} type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Kamida 8 ta belgi" autoComplete="new-password" />
            </label>
            <label style={{ fontSize: 13, color: "#2f4136", fontWeight: 600, display: "block", marginTop: 14 }}>
              Parolni takrorlang
              <input style={input} type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Yangi parolni qayta kiriting" autoComplete="new-password" />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "#4f6355", cursor: "pointer" }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Parolni ko‘rsatish
            </label>
            {err ? <p style={{ color: "#b91c1c", fontSize: 14, marginTop: 12 }}>{err}</p> : null}
            <button style={{ ...btn, opacity: busy ? 0.7 : 1 }} type="submit" disabled={busy}>
              {busy ? "Yangilanmoqda..." : "Parolni yangilash"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
