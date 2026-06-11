"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  FileText,
  Globe,
  Loader2,
  Phone,
  RefreshCw,
  Send,
} from "lucide-react";
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
type FieldKey = keyof ApplicationForm;

const REQUIRED_FIELDS = new Set<FieldKey>([
  "companyName",
  "contactPerson",
  "phone",
  "email",
  "city",
  "country",
  "serviceTypes",
  "description",
]);

const FIELD_LABELS: Record<FieldKey, string> = {
  companyName: "Kompaniya nomi",
  legalName: "Yuridik nomi",
  contactPerson: "Mas'ul shaxs",
  phone: "Telefon",
  email: "Public email",
  city: "Shahar",
  country: "Davlat",
  website: "Website URL",
  telegram: "Telegram",
  instagram: "Instagram",
  serviceTypes: "Xizmat turlari, vergul bilan",
  description: "Tavsif",
  documents: "Hujjat URLlari",
  imageUrl: "Rasm",
};

const STEPS: { title: string; hint: string; icon: typeof Building2; fields: FieldKey[] }[] = [
  {
    title: "Kompaniya",
    hint: "Agentlik nomi va mas'ul shaxs",
    icon: Building2,
    fields: ["companyName", "legalName", "contactPerson"],
  },
  {
    title: "Aloqa",
    hint: "Mijozlar siz bilan qanday bog'lanadi",
    icon: Phone,
    fields: ["phone", "email", "city", "country"],
  },
  {
    title: "Onlayn",
    hint: "Saytlar va ijtimoiy tarmoqlar",
    icon: Globe,
    fields: ["website", "telegram", "instagram", "serviceTypes"],
  },
  {
    title: "Tavsif va rasm",
    hint: "Agentlik haqida va logotip",
    icon: FileText,
    fields: ["description"],
  },
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

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApplicationForm>(() =>
    fillForm(isPending ? null : application, me?.account.email || "")
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "draft" | "submit" | "refresh">("");
  const formRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(fillForm(application?.status === "pending" ? null : application, me?.account.email || ""));
  }, [application, me?.account.email]);

  function updateField(key: FieldKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateFields(keys: FieldKey[]): boolean {
    const next: FieldErrors = {};
    keys.forEach((key) => {
      if (REQUIRED_FIELDS.has(key) && !form[key].trim()) next[key] = "Bu majburiy maydon";
    });
    if (keys.includes("companyName") && form.companyName.trim() && form.companyName.trim().length < 2)
      next.companyName = "Kamida 2 ta belgi kiriting";
    if (keys.includes("contactPerson") && form.contactPerson.trim() && form.contactPerson.trim().length < 2)
      next.contactPerson = "Kamida 2 ta belgi kiriting";
    if (keys.includes("phone") && form.phone.trim() && form.phone.trim().length < 5)
      next.phone = "Telefon raqamini to'liq kiriting";
    if (keys.includes("email") && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Email manzilini to'g'ri kiriting";
    if (keys.includes("website") && form.website.trim()) {
      try {
        new URL(form.website.trim());
      } catch {
        next.website = "URL manzilini http:// yoki https:// bilan kiriting";
      }
    }
    if (keys.includes("description") && form.description.trim() && form.description.trim().length < 20)
      next.description = "Tavsif kamida 20 ta belgi bo'lsin";

    setFieldErrors((current) => ({ ...current, ...next }));
    const firstInvalid = keys.find((key) => next[key]);
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

  function goNext() {
    setError("");
    if (!validateFields(STEPS[step].fields)) return;
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStep((value) => Math.max(value - 1, 0));
  }

  async function save(submit: boolean) {
    // Yakuniy tekshiruv — barcha bosqichlar
    for (let index = 0; index < STEPS.length; index += 1) {
      if (!validateFields(STEPS[index].fields)) {
        setStep(index);
        setError("Majburiy maydonlarni to'ldiring.");
        return;
      }
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
        const submitResult = await agencyApi<{ application: AgencyApplication }>("/application/submit", {
          method: "POST",
        });
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

  function renderField(key: FieldKey) {
    return (
      <label className={fieldErrors[key] ? "agency-field--invalid" : ""} key={key}>
        <span>
          {FIELD_LABELS[key]}
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
    );
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="agency-onboarding">
      <div className="agency-card">
        <p className="agency-eyebrow">Agency arizasi</p>
        <h2>{isPending ? "Ariza admin tekshiruviga yuborilgan" : "Kompaniya ma'lumotlarini to'ldiring"}</h2>
        <p className="agency-muted">
          Status: <b>{statusLabel(application?.status || me?.account.status)}</b>
        </p>

        {application?.adminNote ? (
          <div className="agency-alert agency-alert--error">Admin izohi: {application.adminNote}</div>
        ) : null}
        {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}
        {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

        {isPending ? (
          <>
            <div className="agency-alert agency-alert--info">
              Ariza {formatDate(application?.submittedAt)} kuni yuborilgan. Admin qarori chiqqach status shu sahifada
              yangilanadi.
            </div>
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
                {busy === "refresh" ? <Loader2 className="agency-spin" size={18} /> : <RefreshCw size={18} />} Statusni
                yangilash
              </button>
            </div>
          </>
        ) : (
          <>
            <ol className="agency-wizard-steps">
              {STEPS.map(({ title, icon: Icon }, index) => (
                <li
                  className={index === step ? "is-current" : index < step ? "is-done" : ""}
                  key={title}
                  onClick={() => index < step && setStep(index)}
                >
                  <span><Icon size={15} /></span>
                  {title}
                </li>
              ))}
            </ol>
            <p className="agency-muted agency-wizard-hint">
              {step + 1}/{STEPS.length} — {STEPS[step].hint}
            </p>

            <div className="agency-form-grid" ref={formRef}>
              {STEPS[step].fields.filter((key) => key !== "description").map((key) => renderField(key))}

              {isLastStep ? (
                <>
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
                    {fieldErrors.description ? (
                      <small className="agency-field-error">{fieldErrors.description}</small>
                    ) : null}
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
                </>
              ) : null}
            </div>

            <div className="agency-wizard-nav">
              {step > 0 ? (
                <button className="agency-ghost-button" onClick={goBack} type="button">
                  <ArrowLeft size={16} /> Orqaga
                </button>
              ) : (
                <span />
              )}
              {!isLastStep ? (
                <button onClick={goNext} type="button">
                  Keyingisi <ArrowRight size={16} />
                </button>
              ) : (
                <div className="agency-actions">
                  <button disabled={Boolean(busy)} onClick={() => save(false)} type="button">
                    {busy === "draft" ? <Loader2 className="agency-spin" size={18} /> : <FileText size={18} />} Draft
                    saqlash
                  </button>
                  <button disabled={Boolean(busy)} onClick={() => save(true)} type="button">
                    {busy === "submit" ? <Loader2 className="agency-spin" size={18} /> : <Send size={18} />} Reviewga
                    yuborish
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <EmailChangeCard />
      </div>
    </div>
  );
}
