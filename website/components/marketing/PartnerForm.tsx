"use client";

import { useId, useState } from "react";
import { Building2, CheckCircle2, FileText, Lock, Mail, MapPin, Phone, ShieldCheck, User } from "lucide-react";
import { normalizeUzPhone } from "./BookingPanel";
import { trackPublicEventOnce } from "@/lib/productEvents";

/** Agentlik xizmat turlari — backend `serviceTypes` (string[], 1..12, har biri ≥2 belgi). */
const SERVICE_TYPES = [
  "Chiqish turizmi",
  "Ichki turizm",
  "Kirish turizmi",
  "Umra va Haj",
  "Aviabiletlar",
  "Mehmonxona bron",
  "Viza xizmati",
  "Transfer",
];

type Step = "form" | "verify" | "done";

const AGENCY_API = "/api/agency-proxy/agency";

async function post(path: string, body: unknown, method = "POST") {
  const res = await fetch(`${AGENCY_API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.success !== false, status: res.status, json };
}

/**
 * Hamkorlik arizasi — backend oqimi:
 *  1) POST /agency/auth/register {email, password}  → emailga 6 xonali kod
 *  2) POST /agency/auth/verify-email {email, code}  → sessiya (httpOnly cookie)
 *  3) PUT  /agency/application {companyName, contactPerson, phone, email, city, country, serviceTypes, description}
 *  4) POST /agency/application/submit               → ariza "pending", admin ko'rib chiqadi
 * Ilgari faqat 1-qadam bajarilardi va biznes nomi/mas'ul shaxs/telefon yo'qolardi.
 */
export default function PartnerForm() {
  const ids = useId();
  const [business, setBusiness] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  function toggleService(name: string) {
    setServices((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name].slice(0, 12)));
  }

  function validate(): string | null {
    if (business.trim().length < 2) return "Biznes nomini kiriting.";
    if (contact.trim().length < 2) return "Mas’ul shaxs ism-familiyasini kiriting.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "Email noto‘g‘ri.";
    if (!normalizeUzPhone(phone)) return "Telefon raqami +998 XX XXX XX XX ko‘rinishida bo‘lsin.";
    if (city.trim().length < 2) return "Shaharni kiriting.";
    if (services.length === 0) return "Kamida bitta xizmat turini tanlang.";
    if (description.trim().length < 20) return "Agentlik haqida kamida 20 belgili qisqacha ma’lumot yozing.";
    if (password.length < 8) return "Parol kamida 8 belgidan iborat bo‘lsin.";
    return null;
  }

  async function submitApplication() {
    const application = {
      companyName: business.trim(),
      legalName: "",
      contactPerson: contact.trim(),
      phone: normalizeUzPhone(phone) || phone.trim(),
      email: email.trim().toLowerCase(),
      city: city.trim(),
      country: "O‘zbekiston",
      website: "",
      telegram: "",
      instagram: "",
      serviceTypes: services,
      description: description.trim(),
    };
    const saved = await post("/application", application, "PUT");
    if (!saved.ok) return saved.json?.message || "Arizani saqlab bo‘lmadi.";
    const submitted = await post("/application/submit", {});
    if (!submitted.ok) return submitted.json?.message || "Arizani yuborib bo‘lmadi.";
    return null;
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setInfo("");
    const problem = validate();
    if (problem) { setErr(problem); return; }
    setBusy(true);
    try {
      const { ok, status, json } = await post("/auth/register", { email: email.trim().toLowerCase(), password });
      if (ok || json?.data?.requiresVerification) {
        setInfo(`${email.trim()} manziliga 6 xonali tasdiqlash kodi yuborildi (Spam papkasini ham tekshiring).`);
        setStep("verify");
        return;
      }
      setErr(status === 409
        ? "Bu email bilan agentlik hisobi allaqachon bor. Kirish sahifasidan hisobingizga kiring."
        : json?.message || "Ariza yuborilmadi. Keyinroq urinib ko‘ring.");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (!verified) {
        if (code.trim().length < 4) { setErr("Kodni to‘liq kiriting."); return; }
        const { ok, json } = await post("/auth/verify-email", { email: email.trim().toLowerCase(), code: code.trim() });
        if (!ok) { setErr(json?.message || "Kod noto‘g‘ri yoki muddati tugagan."); return; }
        setVerified(true);
      }
      const problem = await submitApplication();
      if (problem) { setErr(`${problem} Qayta urinib ko‘ring.`); return; }
      setStep("done");
    } catch {
      setErr("Server bilan aloqa bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <div className="mkt-form-card" style={{ textAlign: "center" }} role="status">
        <div className="mkt-vcard__icon" style={{ margin: "0 auto", background: "var(--gold-soft)", color: "#9a6a00" }}><CheckCircle2 size={24} /></div>
        <h3 style={{ margin: 0 }}>Arizangiz qabul qilindi</h3>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Email tasdiqlandi va ariza adminga yuborildi (holat: <b>kutilmoqda</b>). Tasdiqlangach agentlik kabinetingiz ochiladi.
        </p>
        <a className="btn btn--navy btn--md" href="/agency">Agentlik portaliga o‘tish</a>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <form className="mkt-form-card" onSubmit={onVerify}>
        <h3 style={{ margin: "0 0 4px" }}>Emailni tasdiqlang</h3>
        {info ? <div className="mkt-alert mkt-alert--ok">{info}</div> : null}
        {err ? <div className="mkt-alert mkt-alert--error" role="alert">{err}</div> : null}
        {!verified ? (
          <div className="mkt-field">
            <label htmlFor={`${ids}-code`}>Tasdiqlash kodi</label>
            <div className="mkt-input">
              <ShieldCheck size={16} aria-hidden="true" />
              <input id={`${ids}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            </div>
          </div>
        ) : null}
        <button className="btn btn--gold btn--lg btn--block" type="submit" disabled={busy}>
          {busy ? "Yuborilmoqda..." : verified ? "Arizani qayta yuborish" : "Tasdiqlash va ariza yuborish"}
        </button>
        {!verified ? (
          <button type="button" className="btn btn--ghost btn--md btn--block" onClick={() => { setStep("form"); setCode(""); setErr(""); }}>
            Orqaga
          </button>
        ) : null}
      </form>
    );
  }

  return (
    <form className="mkt-form-card" onSubmit={onRegister} onFocusCapture={() => trackPublicEventOnce("agency_signup_started")} noValidate>
      <h3 style={{ margin: "0 0 4px" }}>Hamkorlik arizasi</h3>
      <p style={{ color: "var(--muted)", margin: "0 0 6px", fontSize: "0.9rem" }}>To‘ldiring — jamoamiz 1 ish kuni ichida bog‘lanadi.</p>
      {err ? <div className="mkt-alert mkt-alert--error" role="alert">{err}</div> : null}
      <div className="mkt-field"><label htmlFor={`${ids}-biz`}>Biznes nomi *</label><div className="mkt-input"><Building2 size={16} aria-hidden="true" /><input id={`${ids}-biz`} autoComplete="organization" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Masalan: Guli Travel" required /></div></div>
      <div className="mkt-field"><label htmlFor={`${ids}-contact`}>Mas’ul shaxs *</label><div className="mkt-input"><User size={16} aria-hidden="true" /><input id={`${ids}-contact`} autoComplete="name" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Ism familiya" required /></div></div>
      <div className="mkt-field"><label htmlFor={`${ids}-email`}>Email *</label><div className="mkt-input"><Mail size={16} aria-hidden="true" /><input id={`${ids}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agentlik@email.com" required /></div></div>
      <div className="mkt-field"><label htmlFor={`${ids}-phone`}>Telefon *</label><div className="mkt-input"><Phone size={16} aria-hidden="true" /><input id={`${ids}-phone`} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required /></div></div>
      <div className="mkt-field"><label htmlFor={`${ids}-city`}>Shahar *</label><div className="mkt-input"><MapPin size={16} aria-hidden="true" /><input id={`${ids}-city`} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Masalan: Toshkent" required /></div></div>
      <fieldset className="mkt-field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Xizmat turlari *</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SERVICE_TYPES.map((name) => (
            <label key={name} className={`chip${services.includes(name) ? " chip--gold" : ""}`} style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={services.includes(name)} onChange={() => toggleService(name)} style={{ marginRight: 6 }} />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mkt-field"><label htmlFor={`${ids}-desc`}>Agentlik haqida *</label><div className="mkt-input"><FileText size={16} aria-hidden="true" /><input id={`${ids}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qaysi yo‘nalishlarda ishlaysiz, tajribangiz (kamida 20 belgi)" required minLength={20} maxLength={2000} /></div></div>
      <div className="mkt-field"><label htmlFor={`${ids}-pw`}>Parol *</label><div className="mkt-input"><Lock size={16} aria-hidden="true" /><input id={`${ids}-pw`} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kamida 8 belgi" required /></div></div>
      <button className="btn btn--gold btn--lg btn--block" type="submit" disabled={busy}>{busy ? "Yuborilmoqda..." : "Ariza yuborish"}</button>
    </form>
  );
}
