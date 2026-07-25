"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Lock, User } from "lucide-react";
import { adminLogin, ApiError } from "@/lib/adminApi";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await adminLogin(username.trim(), password);
      router.replace("/admin");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "Kirib bo‘lmadi.");
    } finally { setBusy(false); }
  }

  return (
    <div className="adm-login">
      <div className="adm-login__card">
        <span style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#1a6b3c,#0f5132)", color: "#fff", display: "grid", placeItems: "center" }}>
          <LayoutDashboard size={22} />
        </span>
        <h1>Admin panel</h1>
        <p>Davom etish uchun login va parolingizni kiriting.</p>
        {err ? <div className="adm-inline-err">{err}</div> : null}
        <form onSubmit={submitLogin}>
          <div className="adm-field"><label>Login</label><div style={{ position: "relative" }}><User size={16} style={{ position: "absolute", left: 13, top: 13, color: "var(--subtle)" }} /><input style={{ paddingLeft: 38 }} type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required /></div></div>
          <div className="adm-field"><label>Parol</label><div style={{ position: "relative" }}><Lock size={16} style={{ position: "absolute", left: 13, top: 13, color: "var(--subtle)" }} /><input style={{ paddingLeft: 38 }} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div></div>
          <button className="adm-btn adm-btn--primary" style={{ width: "100%", padding: 13 }} type="submit" disabled={busy}>{busy ? "Kirilyapti..." : "Kirish"}</button>
        </form>
      </div>
    </div>
  );
}
