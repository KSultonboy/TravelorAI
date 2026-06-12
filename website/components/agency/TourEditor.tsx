"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
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
  priceCurrency: string;
  priceBasis: string;
  badge: string;
  imageUrl: string;
  highlights: string;
  itineraryText: string;
  description: string;
  departureCity: string;
  destinationCountry: string;
  tourGroup: string;
  nights: string;
  hotelIncluded: boolean;
  hotelName: string;
  hotelCategory: string;
  hotelLocation: string;
  roomType: string;
  mealPlan: string;
  childPolicy: string;
  flightSeatStatus: string;
  availabilityStatus: string;
  instantConfirmation: boolean;
  promo: boolean;
  priceIncludes: string;
  priceExcludes: string;
};

type TextKey =
  | "title" | "city" | "subtitle" | "duration" | "responseTimeMinutes" | "price" | "priceMin"
  | "priceCurrency" | "priceBasis" | "badge" | "imageUrl" | "highlights" | "itineraryText" | "description"
  | "departureCity" | "destinationCountry" | "tourGroup" | "nights" | "hotelName" | "hotelCategory"
  | "hotelLocation" | "roomType" | "mealPlan" | "childPolicy" | "flightSeatStatus" | "availabilityStatus"
  | "priceIncludes" | "priceExcludes";

const MEAL_PLAN_OPTIONS = [
  { value: "", label: "Tanlanmagan", hint: "" },
  { value: "RO", label: "RO — Room Only", hint: "Faqat xona, ovqat yo'q" },
  { value: "BB", label: "BB — Bed & Breakfast", hint: "Yotoq + nonushta" },
  { value: "HB", label: "HB — Half Board", hint: "Nonushta + kechki ovqat" },
  { value: "FB", label: "FB — Full Board", hint: "3 mahal ovqat" },
  { value: "AI", label: "AI — All Inclusive", hint: "Ovqat + ichimlik + ayrim xizmatlar" },
  { value: "UAI", label: "UAI — Ultra All Inclusive", hint: "Premium ichimlik va xizmatlar ham kiradi" },
  { value: "FBT", label: "FBT — Full Board Treatment", hint: "Sanatoriy/davolanish paketlari uchun" },
];

const HOTEL_CATEGORY_OPTIONS = ["", "3*", "4*", "5*", "Boutique", "Apartment", "Villa"];
const ROOM_TYPE_OPTIONS = ["", "Single", "Double", "Twin", "Triple", "Family", "Suite"];
const CURRENCY_OPTIONS = ["", "USD", "UZS", "RUB", "EUR", "AED"];
const PRICE_BASIS_OPTIONS = [
  { value: "", label: "Ko'rsatilmagan" },
  { value: "1 kishi uchun", label: "1 kishi uchun" },
  { value: "2 kishilik xona uchun", label: "2 kishilik xona uchun" },
  { value: "Paket uchun", label: "Butun paket uchun" },
];
const AVAILABILITY_OPTIONS = [
  { value: "", label: "To'ldirilmagan" },
  { value: "available", label: "Joy bor" },
  { value: "few_seats", label: "Kam joy qoldi" },
  { value: "on_request", label: "So'rov bo'yicha" },
  { value: "sold_out", label: "Joy yo'q" },
];
const FLIGHT_OPTIONS = [
  { value: "", label: "To'ldirilmagan" },
  { value: "not_included", label: "Avia kiritilmagan" },
  { value: "available", label: "Avia joy bor" },
  { value: "few_seats", label: "Avia joy kam" },
  { value: "on_request", label: "Avia so'rov bo'yicha" },
  { value: "no_seats", label: "Avia joy yo'q" },
];

const STEPS = [
  { title: "Asosiy", hint: "Tour nomi va yo'nalishi", icon: MapPinned },
  { title: "Mehmonxona va ovqat", hint: "Ixtiyoriy — paket tafsilotlari", icon: BedDouble },
  { title: "Narx va mavjudlik", hint: "Narx siyosati, joylar, javob vaqti", icon: Wallet },
  { title: "Kontent", hint: "Reja, tavsif va rasm", icon: ImagePlus },
];

const emptyForm: TourForm = {
  title: "",
  city: "",
  subtitle: "",
  duration: "",
  responseTimeMinutes: "45",
  price: "",
  priceMin: "",
  priceCurrency: "USD",
  priceBasis: "",
  badge: "Latest",
  imageUrl: "",
  highlights: "",
  itineraryText: "",
  description: "",
  departureCity: "",
  destinationCountry: "",
  tourGroup: "",
  nights: "",
  hotelIncluded: false,
  hotelName: "",
  hotelCategory: "",
  hotelLocation: "",
  roomType: "",
  mealPlan: "",
  childPolicy: "",
  flightSeatStatus: "",
  availabilityStatus: "",
  instantConfirmation: false,
  promo: false,
  priceIncludes: "",
  priceExcludes: "",
};

function joinList(value?: string[] | null) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function parseList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tourToForm(tour: Tour): TourForm {
  return {
    title: tour.title || "",
    city: tour.city || "",
    subtitle: tour.subtitle || "",
    duration: tour.duration || "",
    responseTimeMinutes: String(tour.responseTimeMinutes ?? 45),
    price: tour.price || "",
    priceMin: tour.priceMin != null ? String(tour.priceMin) : "",
    priceCurrency: tour.priceCurrency || "USD",
    priceBasis: tour.priceBasis || "",
    badge: tour.badge || "Latest",
    imageUrl: tour.imageUrl || "",
    highlights: (tour.highlights || []).join(", "),
    itineraryText: itineraryToText(tour.itinerary),
    description: tour.description || "",
    departureCity: tour.departureCity || "",
    destinationCountry: tour.destinationCountry || "",
    tourGroup: tour.tourGroup || "",
    nights: tour.nights != null ? String(tour.nights) : "",
    hotelIncluded: Boolean(tour.hotelIncluded),
    hotelName: tour.hotelName || "",
    hotelCategory: tour.hotelCategory || "",
    hotelLocation: tour.hotelLocation || "",
    roomType: tour.roomType || "",
    mealPlan: tour.mealPlan || "",
    childPolicy: tour.childPolicy || "",
    flightSeatStatus: tour.flightSeatStatus || "",
    availabilityStatus: tour.availabilityStatus || "",
    instantConfirmation: Boolean(tour.instantConfirmation),
    promo: Boolean(tour.promo),
    priceIncludes: joinList(tour.priceIncludes),
    priceExcludes: joinList(tour.priceExcludes),
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

  function update(key: TextKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "hotelIncluded" | "instantConfirmation" | "promo") {
    setForm((current) => ({ ...current, [key]: !current[key] }));
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
      const payload = {
        title: form.title,
        city: form.city,
        subtitle: form.subtitle,
        duration: form.duration,
        responseTimeMinutes: Number(form.responseTimeMinutes || 45),
        price: form.price,
        priceMin: form.priceMin ? Number(form.priceMin) : undefined,
        priceCurrency: form.priceCurrency,
        priceBasis: form.priceBasis,
        badge: form.badge,
        imageUrl: form.imageUrl,
        highlights: form.highlights.split(",").map((value) => value.trim()).filter(Boolean),
        itinerary: parseItinerary(form.itineraryText),
        description: form.description,
        departureCity: form.departureCity,
        destinationCountry: form.destinationCountry,
        tourGroup: form.tourGroup,
        nights: form.nights ? Number(form.nights) : undefined,
        hotelIncluded: form.hotelIncluded,
        hotelName: form.hotelName,
        hotelCategory: form.hotelCategory,
        hotelLocation: form.hotelLocation,
        roomType: form.roomType,
        mealPlan: form.mealPlan,
        mealPlanLabel: MEAL_PLAN_OPTIONS.find((option) => option.value === form.mealPlan)?.hint || undefined,
        childPolicy: form.childPolicy,
        flightSeatStatus: form.flightSeatStatus,
        availabilityStatus: form.availabilityStatus,
        instantConfirmation: form.instantConfirmation,
        promo: form.promo,
        priceIncludes: parseList(form.priceIncludes),
        priceExcludes: parseList(form.priceExcludes),
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
  const mealHint = MEAL_PLAN_OPTIONS.find((option) => option.value === form.mealPlan)?.hint;

  function renderInput(key: TextKey, label: string, placeholder = "") {
    return (
      <label key={key}>
        <span>{label}</span>
        <input placeholder={placeholder} value={form[key] as string} onChange={(event) => update(key, event.target.value)} />
      </label>
    );
  }

  function renderSelect(key: TextKey, label: string, options: { value: string; label: string }[]) {
    return (
      <label key={key}>
        <span>{label}</span>
        <select value={form[key] as string} onChange={(event) => update(key, event.target.value)}>
          {options.map((option) => (
            <option key={option.value || "none"} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
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
            <p className="agency-muted">4 bosqich — Mehmonxona bo&apos;limi ixtiyoriy, to&apos;ldirsangiz paket professional ko&apos;rinadi.</p>
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
        {step === 0 ? (
          <>
            {renderInput("title", "Tour nomi *")}
            {renderInput("city", "Shahar / kurort *")}
            {renderInput("subtitle", "Qisqa subtitle")}
            {renderInput("duration", "Davomiyligi (masalan: 7 kun) *")}
            {renderInput("departureCity", "Jo'nash shahri", "Toshkent")}
            {renderInput("destinationCountry", "Mamlakat", "BAA, Turkiya...")}
            {renderInput("nights", "Tunlar soni", "6")}
            {renderInput("tourGroup", "Tour guruhi", "Plyaj, Ziyorat, Shahar...")}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="agency-checkbox-group">
              <label className="agency-checkbox-row">
                <input checked={form.hotelIncluded} onChange={() => toggle("hotelIncluded")} type="checkbox" />
                Mehmonxona paketga kiritilgan
              </label>
            </div>
            {renderInput("hotelName", "Mehmonxona nomi", "Rixos Premium...")}
            {renderSelect("hotelCategory", "Kategoriya", HOTEL_CATEGORY_OPTIONS.map((value) => ({ value, label: value || "Tanlanmagan" })))}
            {renderInput("hotelLocation", "Joylashuv", "Dubai Marina, 1-qator...")}
            {renderSelect("roomType", "Xona turi", ROOM_TYPE_OPTIONS.map((value) => ({ value, label: value || "Tanlanmagan" })))}
            <label>
              <span>Ovqatlanish (meal plan)</span>
              <select value={form.mealPlan} onChange={(event) => update("mealPlan", event.target.value)}>
                {MEAL_PLAN_OPTIONS.map((option) => (
                  <option key={option.value || "none"} value={option.value}>{option.label}</option>
                ))}
              </select>
              {mealHint ? <small className="agency-field-hint">{mealHint}</small> : null}
            </label>
            {renderInput("childPolicy", "Bolalar siyosati", "0-6 yosh bepul, 7-12 yosh -50%...")}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {renderInput("price", "Narx matni", "$650 dan")}
            {renderInput("priceMin", "Minimal narx (raqam)")}
            {renderSelect("priceCurrency", "Valyuta", CURRENCY_OPTIONS.map((value) => ({ value, label: value || "Tanlanmagan" })))}
            {renderSelect("priceBasis", "Narx nimaga", PRICE_BASIS_OPTIONS)}
            {renderSelect("availabilityStatus", "Joylar holati", AVAILABILITY_OPTIONS)}
            {renderSelect("flightSeatStatus", "Avia chipta", FLIGHT_OPTIONS)}
            {renderInput("responseTimeMinutes", "Javob vaqti (daqiqa)")}
            {renderInput("badge", "Badge (Latest / Popular)")}
            <div className="agency-checkbox-group">
              <label className="agency-checkbox-row">
                <input checked={form.instantConfirmation} onChange={() => toggle("instantConfirmation")} type="checkbox" />
                Tezkor tasdiqlash (instant confirmation)
              </label>
              <label className="agency-checkbox-row">
                <input checked={form.promo} onChange={() => toggle("promo")} type="checkbox" />
                Promo tour
              </label>
            </div>
            <label className="agency-wide">
              <span>Narxga KIRADI (har qatorda bittadan)</span>
              <textarea placeholder={"Aviachipta\nTransfer\nMehmonxona\nSug'urta"} value={form.priceIncludes} onChange={(event) => update("priceIncludes", event.target.value)} />
            </label>
            <label className="agency-wide">
              <span>Narxga KIRMAYDI</span>
              <textarea placeholder={"Viza\nShaxsiy xarajatlar\nQo'shimcha ekskursiyalar"} value={form.priceExcludes} onChange={(event) => update("priceExcludes", event.target.value)} />
            </label>
          </>
        ) : null}

        {isLastStep ? (
          <>
            {renderInput("highlights", "Diqqatga sazovorlar, vergul bilan")}
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
