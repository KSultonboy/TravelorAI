"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Send } from "lucide-react";
import { publicImageSrc } from "@/lib/imageUrls";
import { agencyApi, itineraryToText, parseItinerary, readImage, statusLabel } from "@/lib/agency/api";
import { useAgencySession } from "@/lib/agency/session";
import type { Tour } from "@/lib/agency/types";

type TourForm = {
  title: string;
  city: string;
  subtitle: string;
  duration: string;
  responseTimeMinutes: string;
  price: string;
  priceMin: string;
  badge: string;
  imageUrl: string;
  highlights: string;
  itineraryText: string;
  description: string;
};

const emptyForm: TourForm = {
  title: "",
  city: "",
  subtitle: "",
  duration: "",
  responseTimeMinutes: "45",
  price: "",
  priceMin: "",
  badge: "Latest",
  imageUrl: "",
  highlights: "",
  itineraryText: "",
  description: "",
};

function tourToForm(tour: Tour): TourForm {
  return {
    title: tour.title || "",
    city: tour.city || "",
    subtitle: tour.subtitle || "",
    duration: tour.duration || "",
    responseTimeMinutes: String(tour.responseTimeMinutes ?? 45),
    price: tour.price || "",
    priceMin: tour.priceMin != null ? String(tour.priceMin) : "",
    badge: tour.badge || "Latest",
    imageUrl: tour.imageUrl || "",
    highlights: (tour.highlights || []).join(", "),
    itineraryText: itineraryToText(tour.itinerary),
    description: tour.description || "",
  };
}

export default function TourEditor({ tourId }: { tourId?: string }) {
  const router = useRouter();
  const { tours, refreshTours, refresh } = useAgencySession();
  const existing = useMemo(() => tours.find((tour) => tour.id === tourId) || null, [tours, tourId]);

  const [form, setForm] = useState<TourForm>(() => (existing ? tourToForm(existing) : emptyForm));
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing) setForm(tourToForm(existing));
  }, [existing]);

  const isEdit = Boolean(tourId);
  const notFound = isEdit && tours.length > 0 && !existing;

  function update(key: keyof TourForm, value: string) {
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

  async function save(submit: boolean) {
    if (!form.title.trim() || !form.city.trim() || !form.duration.trim()) {
      setError("Tour nomi, shahar va davomiylik majburiy.");
      return;
    }
    setBusy(submit ? "submit" : "draft");
    setError("");
    setMessage("");
    try {
      const { itineraryText, ...rest } = form;
      const payload = {
        ...rest,
        priceMin: form.priceMin ? Number(form.priceMin) : undefined,
        responseTimeMinutes: Number(form.responseTimeMinutes || 45),
        highlights: form.highlights.split(",").map((value) => value.trim()).filter(Boolean),
        itinerary: parseItinerary(itineraryText),
      };

      let savedId = tourId;
      if (isEdit && tourId) {
        const result = await agencyApi<Tour>(`/tours/${tourId}`, { method: "PUT", body: JSON.stringify(payload) });
        if (!result.success) throw new Error(result.message);
      } else {
        const result = await agencyApi<Tour>("/tours", { method: "POST", body: JSON.stringify(payload) });
        if (!result.success) throw new Error(result.message);
        savedId = result.data.id;
      }

      if (submit && savedId) {
        const submitResult = await agencyApi<Tour>(`/tours/${savedId}/submit`, { method: "POST" });
        if (!submitResult.success) throw new Error(submitResult.message);
      }

      await refreshTours();
      await refresh(true);
      router.push("/agency/tours");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tour saqlanmadi");
      setBusy("");
    }
  }

  if (notFound) {
    return (
      <section className="agency-dashboard-section">
        <div className="agency-empty-state">
          <p>Tour topilmadi yoki sizga tegishli emas.</p>
          <button className="agency-ghost-button" onClick={() => router.push("/agency/tours")} type="button">
            <ArrowLeft size={15} /> Tourlarga qaytish
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="agency-dashboard-section">
      <header className="agency-section-head">
        <div>
          <p className="agency-eyebrow">{isEdit ? "Tourni tahrirlash" : "Yangi tour"}</p>
          <h2>{isEdit ? existing?.title || "Tour" : "Yangi tour yaratish"}</h2>
          {isEdit && existing ? (
            <p className="agency-muted">
              Holat: <b>{statusLabel(existing.approvalStatus)}</b>
              {existing.adminNote ? ` · Admin izohi: ${existing.adminNote}` : ""}
            </p>
          ) : (
            <p className="agency-muted">Qoralama saqlang yoki to&apos;g&apos;ridan-to&apos;g&apos;ri admin tekshiruviga yuboring.</p>
          )}
        </div>
        <button className="agency-ghost-button" onClick={() => router.push("/agency/tours")} type="button">
          <ArrowLeft size={15} /> Orqaga
        </button>
      </header>

      {message ? <div className="agency-alert agency-alert--success">{message}</div> : null}
      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

      <div className="agency-form-grid">
        {([
          ["title", "Tour nomi *"],
          ["city", "Shahar *"],
          ["subtitle", "Qisqa subtitle"],
          ["duration", "Davomiyligi (masalan: 3 kun) *"],
          ["responseTimeMinutes", "Javob vaqti (daqiqa)"],
          ["price", "Narx matni (masalan: $250 dan)"],
          ["priceMin", "Minimal narx (raqam, USD)"],
          ["badge", "Badge (Latest, Popular...)"],
          ["highlights", "Diqqatga sazovorlar, vergul bilan"],
        ] as const).map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input value={form[key]} onChange={(event) => update(key, event.target.value)} />
          </label>
        ))}
        <label className="agency-wide">
          <span>Kunlik reja (har qatorda bitta kun: &quot;1-kun: Registon&quot;)</span>
          <textarea value={form.itineraryText} onChange={(event) => update("itineraryText", event.target.value)} />
        </label>
        <label className="agency-wide">
          <span>Tavsif</span>
          <textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
        </label>
        <label className="agency-wide">
          Tour rasmi
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
              alt="Tour rasmi preview"
            />
          ) : null}
        </label>
      </div>

      <div className="agency-actions">
        <button disabled={Boolean(busy)} onClick={() => save(false)} type="button">
          {busy === "draft" ? <Loader2 className="agency-spin" size={17} /> : <FileText size={17} />} Qoralama saqlash
        </button>
        <button disabled={Boolean(busy)} onClick={() => save(true)} type="button">
          {busy === "submit" ? <Loader2 className="agency-spin" size={17} /> : <Send size={17} />} Reviewga yuborish
        </button>
      </div>
    </section>
  );
}
