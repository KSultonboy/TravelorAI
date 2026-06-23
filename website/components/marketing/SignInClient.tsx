"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, ChevronRight, Eye, EyeOff, Lock, Mail, MapPinned, ShieldCheck, Sparkles, User } from "lucide-react";
import Logo from "./Logo";
import GoogleContinueButton from "../GoogleContinueButton";

const HERO = "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1400&q=70";
type Role = "traveler" | "partner";
type Step = "role" | "form" | "verify";

const BENEFITS = [
  { icon: Sparkles, title: "AI sayohat rejasi", sub: "Byudjet va qiziqishingizga mos marshrut" },
  { icon: ShieldCheck, title: "Tasdiqlangan agentliklar", sub: "Shaffof narx va ishonchli bron" },
  { icon: MapPinned, title: "Web va mobil sinxron", sub: "Bir hisob — barcha qurilmalarda" },
];

export default function SignInClient() {
  const params = useSearchParams();
  const next = params.get("next") || "";

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<Role>("traveler");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const base = role === "partner" ? "/api/agency-proxy/agency/auth" : "/api/backend/auth";
  const dest = role === "partner" ? "/agency" : next || "/my-trips";

  function go() { window.location.href = dest; }

  async function post(path: string, body: unknown) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: window.location.origin },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setInfo("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Email noto‘g‘ri."); return; }
    if (password.length < 8) { setErr("Parol kamida 8 ta belgidan iborat bo‘lsin."); return; }
    if (mode === "register" && role === "traveler" && name.trim().length < 2) { setErr("Ismingizni kiriting."); return; }
    setBusy(true);
    try {
      if (mode === "register") {
        const body = role === "traveler" ? { name: name.trim(), email: email.trim().toLowerCase(), password } : { email: email.trim().toLowerCase(), password };
        const { ok, json } = await post("/register", body);
        if (ok || json?.success || json?.data?.requiresVerification) { setInfo("Emailingizga tasdiqlash kodi yuborildi."); setStep("verify"); return; }
        setErr(json?.message || "Ro‘yxatdan o‘tib bo‘lmadi."); return;
      }
      // login
      const { ok, json } = await post("/login", { email: email.trim().toLowerCase(), password });
      if (json?.data?.requiresVerification) { setInfo("Hisobni tasdiqlang."); setStep("verify"); return; }
      if (ok && json?.success !== false) { go(); return; }
      setErr(json?.message || "Email yoki parol noto‘g‘ri.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (code.trim().length < 4) { setErr("Kodni to‘liq kiriting."); return; }
    setBusy(true);
    try {
      const { ok, json } = await post("/verify-email", { email: email.trim().toLowerCase(), code: code.trim() });
      if (ok && json?.success !== false) { go(); return; }
      setErr(json?.message || "Kod noto‘g‘ri yoki muddati tugagan.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(idToken: string) {
    setErr(""); setBusy(true);
    try {
      const { ok, json } = await post("/google", { idToken });
      if (ok && json?.success !== false) { go(); return; }
      setErr(json?.message || "Google orqali kirib bo‘lmadi.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mkt mkt-auth">
      <div className="mkt-auth__left">
        <img src={HERO} alt="" aria-hidden="true" />
        <Logo light />
        <div className="mkt-auth__benefits">
          <div className="mkt-auth__bhead">Sayohatingiz shu yerdan boshlanadi</div>
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="mkt-auth__brow">
                <span><Icon size={20} /></span>
                <span><b>{b.title}</b><small>{b.sub}</small></span>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>© {new Date().getFullYear()} TravelorAI</div>
      </div>

      <div className="mkt-auth__right">
        <div className="mkt-auth__card">
          {step === "role" ? (
            <>
              <h1>Xush kelibsiz 👋</h1>
              <p className="sub">Davom etish uchun hisob turini tanlang.</p>
              <button className="mkt-rolebtn" type="button" onClick={() => { setRole("traveler"); setMode("login"); setErr(""); setStep("form"); }}>
                <span className="mkt-rolebtn__icon"><User size={22} /></span>
                <span><b>Sayohatchi</b><small>Turlarni ko‘ring, AI reja tuzing va bron qiling</small></span>
                <ChevronRight className="mkt-rolebtn__chev" size={20} />
              </button>
              <button className="mkt-rolebtn" type="button" onClick={() => { setRole("partner"); setMode("login"); setErr(""); setStep("form"); }}>
                <span className="mkt-rolebtn__icon"><Building2 size={22} /></span>
                <span><b>Hamkor (agentlik)</b><small>Turlaringizni joylang va mijoz qabul qiling</small></span>
                <ChevronRight className="mkt-rolebtn__chev" size={20} />
              </button>
            </>
          ) : step === "verify" ? (
            <>
              <button className="mkt-auth__back" type="button" onClick={() => { setStep("form"); setCode(""); setErr(""); }}><ArrowLeft size={16} /> Orqaga</button>
              <h1>Kodni kiriting</h1>
              <p className="sub">{email} manziliga yuborilgan 6 xonali kodni kiriting.</p>
              {err ? <div className="mkt-alert mkt-alert--error" style={{ marginBottom: 12 }}>{err}</div> : null}
              {info ? <div className="mkt-alert mkt-alert--ok" style={{ marginBottom: 12 }}>{info}</div> : null}
              <form className="mkt-auth__fields" onSubmit={verify}>
                <div className="mkt-field"><label>Tasdiqlash kodi</label><div className="mkt-input"><ShieldCheck size={16} /><input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></div></div>
                <button className="btn btn--gold btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Tekshirilmoqda..." : "Tasdiqlash"}</button>
              </form>
            </>
          ) : (
            <>
              <button className="mkt-auth__back" type="button" onClick={() => { setStep("role"); setErr(""); }}><ArrowLeft size={16} /> Hisob turi</button>
              <h1>{role === "partner" ? "Hamkor kirishi" : "Sayohatchi"}{mode === "register" ? " — ro‘yxatdan o‘tish" : ""}</h1>
              <p className="sub">{mode === "login" ? "Hisobingizga kiring." : "Yangi hisob yarating."}</p>
              {err ? <div className="mkt-alert mkt-alert--error" style={{ marginBottom: 12 }}>{err}</div> : null}
              {info ? <div className="mkt-alert mkt-alert--ok" style={{ marginBottom: 12 }}>{info}</div> : null}

              <form className="mkt-auth__fields" onSubmit={submit}>
                {mode === "register" && role === "traveler" ? (
                  <div className="mkt-field"><label>Ism</label><div className="mkt-input"><User size={16} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ismingiz" /></div></div>
                ) : null}
                <div className="mkt-field"><label>Email</label><div className="mkt-input"><Mail size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@email.com" /></div></div>
                <div className="mkt-field"><label>Parol</label><div className="mkt-input"><Lock size={16} /><input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 8 belgi" /><button type="button" className="mkt-input__eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Parolni yashirish" : "Parolni ko‘rsatish"} title={showPw ? "Yashirish" : "Ko‘rsatish"} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, padding: 4, margin: 0, cursor: "pointer", color: "var(--muted, #6b8576)" }}>{showPw ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
                <button className="btn btn--gold btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Yuborilmoqda..." : mode === "login" ? "Kirish" : "Ro‘yxatdan o‘tish"}</button>
              </form>

              {role === "traveler" ? (
                <>
                  <div className="mkt-divider">yoki</div>
                  <GoogleContinueButton disabled={busy} onCredential={onGoogle} onError={(m) => setErr(m)} />
                </>
              ) : null}

              {role === "traveler" ? (
                <div className="mkt-auth__toggle">
                  {mode === "login" ? "Hisobingiz yo‘qmi? " : "Hisobingiz bormi? "}
                  <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>{mode === "login" ? "Ro‘yxatdan o‘tish" : "Kirish"}</button>
                </div>
              ) : (
                <div className="mkt-auth__toggle" style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <BadgeCheck size={15} style={{ color: "var(--primary)" }} /> Yangi agentlikmi? <a href="/partners" style={{ color: "var(--primary)", fontWeight: 800 }}>Ariza qoldiring</a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
