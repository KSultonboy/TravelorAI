"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FileText, Loader2, RefreshCw, Send } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import { agencyApi, formatDate, readImage, statusLabel } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { AgencyApplication } from "@/lib/agency/types";
import EmailChangeCard from "./EmailChangeCard";

type ApplicationForm = {
  companyName: string;
  legalName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  country: string;
  website: string;
  telegram: string;
  instagram: string;
  serviceTypes: string;
  description: string;
  documents: string;
  imageUrl: string;
};

type FieldErrors = Partial<Record<keyof ApplicationForm, string>>;

const REQUIRED_FIELDS = new Set<keyof ApplicationForm>([
  "companyName",
  "contactPerson",
  "phone",
  "email",
  "city",
  "country",
  "serviceTypes",
]);

const FIELD_LABELS: [keyof ApplicationForm, string][] = [
  ["companyName", "Kompaniya nomi"],
  ["legalName", "Yuridik nomi"],
  ["contactPerson", "Mas'ul shaxs"],
  ["phone", "Telefon"],
  ["email", "Public email"],
  ["city", "Shahar"],
  ["country", "Davlat"],
  ["website", "Website URL"],
  ["telegram", "Telegram"],
  ["instagram", "Instagram"],
  ["serviceTypes", "Xizmat turlari, vergul bilan"],
];

const emptyForm: ApplicationForm = {
  companyName: "",
  legalName: "",
  contactPerson: "",
  phone: "",
  email: "",
  city: "",
  country: "Global",
  website: "",
  telegram: "",
  instagram: "",
  serviceTypes: "Tours, Local guide",
  description: "",
  documents: "",
  imageUrl: "",
};

function fillForm(application: AgencyApplication | null, accountEmail: string): ApplicationForm {
  if (!application) return { ...emptyForm, email: accountEmail };
  return {
    companyName: application.companyName || "",
    legalName: application.legalName || "",
    contactPerson: application.contactPerson || "",
    phone: application.phone || "",
    email: application.email || accountEmail,
    city: application.city || "",
    country: application.country || "Global",
    website: application.website || "",
    telegram: application.telegram || "",
    instagram: application.instagram || "",
    serviceTypes: (application.serviceTypes || []).join(", ") || "Tours, Local guide",
    description: application.description || "",
    documents: Array.isArray(application.documents) ? (application.documents as string[]).join("\n") : "",
    imageUrl: application.imageUrl || "",
  };
}

export default function OnboardingScreen() {
  const { me, refresh } = useAgencySession();
  const application = me?.application || null;
  const isPending = application?.status === "pending";

  const [form, setForm] = useState<ApplicationForm>(() => fillForm(isPending ? null : application, me?.account.email || ""));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "submit" | "refresh">("");
  const formRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(fillForm(application?.status === "pending" ? null : application, me?.account.email || ""));
  }, [application, me?.account.email]);

  function updateField(key: keyof ApplicationForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const next: FieldErrors = {};
    const order: (keyof ApplicationForm)[] = [...FIELD_LABELS.map(([key]) => key), "description"];

    order.forEach((key) => {
      if ((REQUIRED_FIELDS.has(key) || key === "description") && !form[key].trim()) next[key] = "Bu majburiy maydon";
    });
    if (form.companyName.trim() && form.companyName.trim().length < 2) next.companyName = "Kamida 2 ta belgi kiriting";
    if (form.contactPerson.trim() && form.contactPerson.trim().length < 2) next.contactPerson = "Kamida 2 ta belgi kiriting";
    if (form.phone.trim() && form.phone.trim().length < 5) next.phone = "Telefon raqamini to'liq kiriting";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Email manzilini to'g'ri kiriting";
    if (form.website.trim()) {
      try {
        new URL(form.website.trim());
      } catch {
        next.website = "URL manzilini http:// yoki https:// bilan kiriting";
      }
    }
    if (form.description.trim() && form.description.trim().length < 20) next.description = "Tavsif kamida 20 ta belgi bo'lsin";

    setFieldErrors(next);
    const firstInvalid = order.find((key) => next[key]);
    if (firstInvalid) {
      window.requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>(`[data-agency-field="${firstInvalid}"]`);
        field?.focus();
        field?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return false;
    }
    return true;
  }

  async function save(submit: boolean) {
    if (!validate()) {
      setError("Majburiy maydonlarni to'ldiring.");
      return;
    }
    setBusy(submit ? "submit" : "draft");
    setError("");
    setMessage("");
    try {
      const documents = form.documents.trim()
        ? form.documents.split("\n").map((value) => value.trim()).filter(Boolean)
        : undefined;
      const payload = {
        ...form,
        serviceTypes: form.serviceTypes.split(",").map((value) => value.trim()).filter(Boolean),
        documents,
      };
      const saveResult = await agencyApi<{ application: AgencyApplication }>("/application", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!saveResult.success) throw new Error(saveResult.message);

      if (submit) {
        const submitResult = await agencyApi<{ application: AgencyApplication }>("/application/submit", { method: "POST" });
        if (!submitResult.success) throw new Error(submitResult.message);
        setMessage("Ariza admin tekshiruvi uchun yuborildi.");
      } else {
        setMessage("Ariza draft sifatida saqlandi.");
      }
      await refresh(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ariza saqlanmadi");
    } finally {
      setBusy("");
    }
  }

  async function chooseImage(file: File | null) {
    setError("");
    try {
      const imageUrl = await readImage(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasm tanlanmadi");
    }
  }

  return (
    <div className="agency-onboarding">
      <div className="agency-card">
        <p className="agency-eyebrow">Agency arizasi</p>
        <h2>{isPending ? "Ariza admin tekshiruviga yuborilgan" : "Kompaniya ma'lumotlarini to'ldiring"}</h2>
        <p className="agency-muted">
          Status: <b>{statusLabel(application?.status || me?.account.status)}</b>
        </p>
        <div className="agency-alert agency-alert--info">
          {isPending
            ? `Ariza ${formatDate(application?.submittedAt)} kuni yuborilgan. Admin qarori chiqqach status shu sahifada yangilanadi.`
            : "Agentlik rasmi, aloqa ma'lumotlari va ariza tafsilotlarini kiriting. Lead va tour boshqaruvi admin tasdiqlagandan keyin ochiladi."}
        </div>
        {application?.adminNote ? (
          <div className="agency-alert agency-alert--error">Admin izohi: {application.adminNote}</div>
        ) : null}
        {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}
        {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

        {isPending ? (
          <div className="agency-actions">
            <button
              disabled={Boolean(busy)}
              onClick={async () => {
                setBusy("refresh");
                await refresh(true);
                setBusy("");
              }}
              type="button"
            >
              {busy === "refresh" ? <Loader2 className="agency-spin" size={18} /> : <RefreshCw size={18} />} Statusni yangilash
            </button>
          </div>
        ) : (
          <>
            <div className="agency-form-grid" ref={formRef}>
              {FIELD_LABELS.map(([key, label]) => (
                <label className={fieldErrors[key] ? "agency-field--invalid" : ""} key={key}>
                  <span>
                    {label}
                    {REQUIRED_FIELDS.has(key) ? <b className="agency-required"> *</b> : null}
                  </span>
                  <input
                    aria-invalid={Boolean(fieldErrors[key])}
                    data-agency-field={key}
                    value={form[key]}
                    onChange={(event) => updateField(key, event.target.value)}
                    required={REQUIRED_FIELDS.has(key)}
                  />
                  {fieldErrors[key] ? <small className="agency-field-error">{fieldErrors[key]}</small> : null}
                </label>
              ))}
              <label className={`agency-wide ${fieldErrors.description ? "agency-field--invalid" : ""}`}>
                <span>
                  Tavsif<b className="agency-required"> *</b>
                </span>
                <textarea
                  aria-invalid={Boolean(fieldErrors.description)}
                  data-agency-field="description"
                  required
                  minLength={20}
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                />
                {fieldErrors.description ? <small className="agency-field-error">{fieldErrors.description}</small> : null}
              </label>
              <label className="agency-wide">
                Agentlik rasmi yoki logotipi
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => chooseImage(event.target.files?.[0] || null)}
                />
                {form.imageUrl ? (
                  <Image
                    unoptimized
                    width={840}
                    height={480}
                    className="agency-image-preview"
                    src={publicImageSrc(form.imageUrl)}
                    alt="Agentlik rasmi preview"
                  />
                ) : null}
              </label>
              <label className="agency-wide">
                Hujjat yoki rasm URLlari, har biri yangi qatorda
                <textarea value={form.documents} onChange={(event) => updateField("documents", event.target.value)} />
              </label>
            </div>
            <div className="agency-actions">
              <button disabled={Boolean(busy)} onClick={() => save(false)} type="button">
                {busy === "draft" ? <Loader2 className="agency-spin" size={18} /> : <FileText size={18} />} Draft saqlash
              </button>
              <button disabled={Boolean(busy)} onClick={() => save(true)} type="button">
                {busy === "submit" ? <Loader2 className="agency-spin" size={18} /> : <Send size={18} />} Reviewga yuborish
              </button>
            </div>
          </>
        )}

        <EmailChangeCard />
      </div>
    </div>
  );
}
