"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Save } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import { agencyApi, readImage, statusLabel } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { Agency } from "@/lib/agency/types";
import EmailChangeCard from "./EmailChangeCard";

type ProfileForm = {
  name: string;
  city: string;
  specialty: string;
  description: string;
  phone: string;
  website: string;
  imageUrl: string;
};

function fillForm(agency: Agency | null): ProfileForm {
  return {
    name: agency?.name || "",
    city: agency?.city || "",
    specialty: agency?.specialty || "",
    description: agency?.description || "",
    phone: agency?.phone || "",
    website: agency?.website || "",
    imageUrl: agency?.imageUrl || "",
  };
}

export default function ProfileEditor() {
  const { me, refresh } = useAgencySession();
  const [form, setForm] = useState<ProfileForm>(() => fillForm(me?.agency || null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(fillForm(me?.agency || null));
  }, [me?.agency]);

  function update(key: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
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

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await agencyApi<{ agency: Agency }>("/profile", {
      method: "PUT",
      body: JSON.stringify(form),
    });
    if (result.success) {
      setMessage("Agentlik profili yangilandi.");
      await refresh(true);
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  return (
    <section className="agency-dashboard-section">
      <header className="agency-section-head">
        <div>
          <p className="agency-eyebrow">Public profil</p>
          <h2>Agentlik profili</h2>
          <p className="agency-muted">
            Bu ma&apos;lumotlar mobil ilova va webda mijozlarga ko&apos;rinadi. Holat:{" "}
            <b>{statusLabel(me?.agency?.approvalStatus)}</b>
          </p>
        </div>
      </header>

      {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}
      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

      <div className="agency-form-grid">
        {([
          ["name", "Agentlik nomi"],
          ["city", "Shahar"],
          ["specialty", "Yo'nalish (masalan: Madaniy turlar)"],
          ["phone", "Telefon"],
          ["website", "Website URL"],
        ] as const).map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input value={form[key]} onChange={(event) => update(key, event.target.value)} />
          </label>
        ))}
        <label className="agency-wide">
          <span>Tavsif</span>
          <textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
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
      </div>

      <div className="agency-actions">
        <button disabled={busy} onClick={save} type="button">
          {busy ? <Loader2 className="agency-spin" size={17} /> : <Save size={17} />} Profilni saqlash
        </button>
      </div>

      <EmailChangeCard />

      {me?.application ? (
        <details className="agency-application-details">
          <summary>Ro&apos;yxatdan o&apos;tish arizasi ma&apos;lumotlari</summary>
          <dl>
            <div><dt>Kompaniya</dt><dd>{me.application.companyName}</dd></div>
            <div><dt>Mas&apos;ul shaxs</dt><dd>{me.application.contactPerson}</dd></div>
            <div><dt>Telefon</dt><dd>{me.application.phone}</dd></div>
            <div><dt>Holat</dt><dd>{statusLabel(me.application.status)}</dd></div>
          </dl>
        </details>
      ) : null}
    </section>
  );
}
