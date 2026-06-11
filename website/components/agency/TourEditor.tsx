"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ImagePlus,
  Loader2,
  MapPinned,
  Send,
  Wallet,
} from "lucide-react";
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

type FieldKey = keyof TourForm;

const STEPS: { title: string; hint: string; icon: typeof MapPinned; fields: [FieldKey, string][] }[] = [
  {
    title: "Asosiy",
    hint: "Tour nomi va manzili",
    icon: MapPinned,
    fields: [
      ["title", "Tour nomi *"],
      ["city", "Shahar *"],
      ["subtitle", "Qisqa subtitle"],
      ["duration", "Davomiyligi (masalan: 3 kun) *"],
    ],
  },
  {
    title: "Narx va javob",
    hint: "Narx siyosati va lead javob vaqti",
    icon: Wallet,
    fields: [
      ["price", "Narx matni (masalan: $250 dan)"],
      ["priceMin", "Minimal narx (raqam, USD)"],
      ["badge", "Badge (Latest, Popular...)"],
      ["responseTimeMinutes", "Javob vaqti (daqiqa)"],
      ["highlights", "Diqqatga sazovorlar, vergul bilan"],
    ],
  },
  {
    title: "Kontent",
    hint: "Reja, tavsif va rasm",
    icon: ImagePlus,
    fields: [],
  },
];

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

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  const [form, setForm] = useState<TourForm>(() => (existing ? tourToForm(existing) : emptyForm));
  const [busy, setBusy] = useState<"" | "draft" | "submit">("");
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing) setForm(tourToForm(existing));
  }, [existing]);

  const isEdit = Boolean(tourId);
  const notFound = isEdit && tours.length > 0 && !existing;

  function update(key: FieldKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(index: number): boolean {
    if (index === 0) {
      if (!form.title.trim() || !form.city.trim() || !form.duration.trim()) {
        setError("Tour nomi, shahar va davomiylik majburiy.");
        return false;
      }
    }
    setError("");
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setDirection("fwd");
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setDirection("back");
    setStep((value) => Math.max(value - 1, 0));
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
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    setBusy(submit ? "submit" : "draft");
    setError("");
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

  const isLastStep = step === STEPS.length - 1;

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
            <p className="agency-muted">Ma&apos;lumotlarni 3 bosqichda kiriting — oxirida saqlaysiz.</p>
          )}
        </div>
        <button className="agency-ghost-button" onClick={() => router.push("/agency/tours")} type="button">
          <ArrowLeft size={15} /> Orqaga
        </button>
      </header>

      {error ? <div className="agency-alert agency-alert--error">{error}</div> : null}

      <ol className="agency-wizard-steps">
        {STEPS.map(({ title, icon: Icon }, index) => (
          <li
            className={index === step ? "is-current" : index < step ? "is-done" : ""}
            key={title}
            onClick={() => {
              if (index < step) {
                setDirection("back");
                setStep(index);
              }
            }}
          >
            <span><Icon size={15} /></span>
            {title}
          </li>
        ))}
      </ol>
      <p className="agency-muted agency-wizard-hint">
        {step + 1}/{STEPS.length} — {STEPS[step].hint}
      </p>

      <div className={`agency-form-grid agency-wizard-pane agency-wizard-pane--${direction}`} key={step}>
        {STEPS[step].fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input value={form[key]} onChange={(event) => update(key, event.target.value)} />
          </label>
        ))}

        {isLastStep ? (
          <>
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
              {busy === "draft" ? <Loader2 className="agency-spin" size={17} /> : <FileText size={17} />} Qoralama
              saqlash
            </button>
            <button disabled={Boolean(busy)} onClick={() => save(true)} type="button">
              {busy === "submit" ? <Loader2 className="agency-spin" size={17} /> : <Send size={17} />} Reviewga yuborish
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
