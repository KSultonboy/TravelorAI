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

type PriceBasisChoice = "per1" | "per2" | "custom";

type TourForm = {
  title: string;
  city: string;
  subtitle: string;
  description: string;
  departureCity: string;
  destinationCountry: string;
  tourGroup: string;
  nights: string;
  days: string;
  responseTimeMinutes: string;
  price: string;
  priceCurrency: string;
  priceBasisChoice: PriceBasisChoice;
  priceBasisPeople: string;
  badge: string;
  imageUrl: string;
  highlights: string;
  itineraryText: string;
  hotelIncluded: boolean;
  hotelName: string;
  hotelCategory: string;
  hotelLocation: string;
  roomType: string;
  mealPlan: string;
  discount: string;
  childPolicy: string;
  flightIncluded: boolean;
  instantConfirmation: boolean;
  priceLockEnabled: boolean;
  priceLockMinutes: string;
  priceIncludesExtra: string;
};

type TextKey =
  | "title" | "city" | "subtitle" | "description" | "departureCity" | "destinationCountry"
  | "tourGroup" | "nights" | "days" | "responseTimeMinutes" | "price" | "priceCurrency"
  | "priceBasisPeople" | "badge" | "imageUrl" | "highlights" | "itineraryText" | "hotelName"
  | "hotelCategory" | "hotelLocation" | "roomType" | "mealPlan" | "discount" | "childPolicy"
  | "priceLockMinutes" | "priceIncludesExtra";

const MEAL_PLAN_OPTIONS = [
  { value: "", label: "Tanlanmagan", hint: "" },
  { value: "RO", label: "RO — Faqat xona", hint: "Faqat xona, ovqat yo'q" },
  { value: "BB", label: "BB — Nonushta bilan", hint: "Yotoq + nonushta" },
  { value: "HB", label: "HB — Yarim pansion", hint: "Nonushta + kechki ovqat" },
  { value: "FB", label: "FB — To'liq pansion", hint: "3 mahal ovqat" },
  { value: "AI", label: "AI — Hammasi kiritilgan", hint: "Ovqat + ichimlik + ayrim xizmatlar" },
  { value: "UAI", label: "UAI — Ultra hammasi kiritilgan", hint: "Premium ichimlik va xizmatlar ham kiradi" },
  { value: "FBT", label: "FBT — Davolanish paketi", hint: "Sanatoriy/davolanish paketlari uchun" },
];

const HOTEL_CATEGORY_OPTIONS = ["", "3*", "4*", "5*", "Boutique", "Apartment", "Villa"];
// Xona turlari — o'zbekcha + Moslashuvchan
const ROOM_TYPE_OPTIONS = [
  "",
  "Bir kishilik",
  "Ikki kishilik",
  "Ikki alohida o'rin",
  "Uch kishilik",
  "Oilaviy",
  "Lyuks",
  "Moslashuvchan",
];
const CURRENCY_OPTIONS = ["USD", "UZS", "RUB", "EUR", "AED"];

// Jo'nash shahri (O'zbekiston)
const DEPARTURE_OPTIONS = [
  "",
  "Toshkent",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Farg'ona",
  "Namangan",
  "Qarshi",
  "Nukus",
  "Urganch",
  "Xiva",
  "Termiz",
  "Jizzax",
  "Navoiy",
];

// Yo'nalish (davlat) — mobil filtrlar bilan mos
const DESTINATION_OPTIONS = [
  "",
  "BAA (Dubay)",
  "Turkiya",
  "Misr",
  "Saudiya Arabistoni",
  "Tailand",
  "Maldiv orollari",
  "Gruziya",
  "Malayziya",
  "Indoneziya (Bali)",
  "Qatar",
  "Ozarbayjon",
  "Yevropa",
];

const PRICE_BASIS_CHOICES: { value: PriceBasisChoice; label: string }[] = [
  { value: "per1", label: "1 kishi uchun" },
  { value: "per2", label: "2 kishi uchun" },
  { value: "custom", label: "Boshqa (kishi sonini kiriting)" },
];

const STEPS = [
  { title: "Asosiy", hint: "Yo'nalish, nom va davomiylik", icon: MapPinned },
  { title: "Mehmonxona va ovqat", hint: "Ixtiyoriy — paket tafsilotlari", icon: BedDouble },
  { title: "Narx va shartlar", hint: "Narx, avia, javob vaqti, narx kafolati", icon: Wallet },
  { title: "Kontent", hint: "Reja, tavsif va rasm", icon: ImagePlus },
];

const emptyForm: TourForm = {
  title: "",
  city: "",
  subtitle: "",
  description: "",
  departureCity: "",
  destinationCountry: "",
  tourGroup: "",
  nights: "",
  days: "",
  responseTimeMinutes: "45",
  price: "",
  priceCurrency: "USD",
  priceBasisChoice: "per1",
  priceBasisPeople: "",
  badge: "Latest",
  imageUrl: "",
  highlights: "",
  itineraryText: "",
  hotelIncluded: false,
  hotelName: "",
  hotelCategory: "",
  hotelLocation: "",
  roomType: "",
  mealPlan: "",
  discount: "",
  childPolicy: "",
  flightIncluded: false,
  instantConfirmation: false,
  priceLockEnabled: false,
  priceLockMinutes: "",
  priceIncludesExtra: "",
};

const AUTO_INCLUDES = ["Mehmonxona", "Aviachipta"];

function parseList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function peopleToChoice(people?: number | null): PriceBasisChoice {
  if (people === 1) return "per1";
  if (people === 2) return "per2";
  return people && people > 0 ? "custom" : "per1";
}

function tourToForm(tour: Tour): TourForm {
  const people = tour.priceBasisPeople ?? null;
  const choice = peopleToChoice(people);
  // priceIncludes'dan avtomatik (hotel/avia) qatorlarni olib tashlab, qolganini "qo'shimcha"ga
  const extras = (tour.priceIncludes || []).filter((item) => !AUTO_INCLUDES.includes(item.trim()));
  return {
    title: tour.title || "",
    city: tour.city || "",
    subtitle: tour.subtitle || "",
    description: tour.description || "",
    departureCity: tour.departureCity || "",
    destinationCountry: tour.destinationCountry || "",
    tourGroup: tour.tourGroup || "",
    nights: tour.nights != null ? String(tour.nights) : "",
    days: tour.days != null ? String(tour.days) : "",
    responseTimeMinutes: String(tour.responseTimeMinutes ?? 45),
    price: tour.price || "",
    priceCurrency: tour.priceCurrency || "USD",
    priceBasisChoice: choice,
    priceBasisPeople: choice === "custom" && people ? String(people) : "",
    badge: tour.badge || "Latest",
    imageUrl: tour.imageUrl || "",
    highlights: (tour.highlights || []).join(", "),
    itineraryText: itineraryToText(tour.itinerary),
    hotelIncluded: Boolean(tour.hotelIncluded),
    hotelName: tour.hotelName || "",
    hotelCategory: tour.hotelCategory || "",
    hotelLocation: tour.hotelLocation || "",
    roomType: tour.roomType || "",
    mealPlan: tour.mealPlan || "",
    discount: tour.discount || "",
    childPolicy: tour.childPolicy || "",
    flightIncluded: Boolean(tour.flightIncluded),
    instantConfirmation: Boolean(tour.instantConfirmation),
    priceLockEnabled: Boolean(tour.priceLockMinutes && tour.priceLockMinutes > 0),
    priceLockMinutes: tour.priceLockMinutes ? String(tour.priceLockMinutes) : "",
    priceIncludesExtra: extras.join("\n"),
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

  function toggle(key: "hotelIncluded" | "flightIncluded" | "instantConfirmation") {
    setForm((current) => ({ ...current, [key]: !current[key] }));
  }

  function validateStep(index: number): boolean {
    if (index === 0) {
      if (!form.departureCity.trim() || !form.destinationCountry.trim()) {
        setError("Qayerdan va qayerga — ikkalasini tanlang.");
        return false;
      }
      if (!form.title.trim() || !form.city.trim() || !form.subtitle.trim()) {
        setError("Tour nomi, shahar/kurort va qisqa subtitle majburiy.");
        return false;
      }
      if (!form.days.trim()) {
        setError("Kunduzlar sonini kiriting.");
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

  function buildDuration(): string {
    const d = Number(form.days) || 0;
    const n = Number(form.nights) || 0;
    const parts: string[] = [];
    if (d > 0) parts.push(`${d} kun`);
    if (n > 0) parts.push(`${n} kecha`);
    return parts.join(", ") || form.days.trim() || "Tur";
  }

  function buildPriceBasis(): { label: string; people: number | undefined } {
    if (form.priceBasisChoice === "per1") return { label: "1 kishi uchun", people: 1 };
    if (form.priceBasisChoice === "per2") return { label: "2 kishi uchun", people: 2 };
    const n = Number(form.priceBasisPeople) || 0;
    return { label: n > 0 ? `${n} kishi uchun` : "Boshqa", people: n > 0 ? n : undefined };
  }

  async function save(submit: boolean) {
    if (!validateStep(0)) {
      setStep(0);
      return;
    }
    setBusy(submit ? "submit" : "draft");
    setError("");
    try {
      const basis = buildPriceBasis();
      const includes = [
        ...(form.hotelIncluded ? ["Mehmonxona"] : []),
        ...(form.flightIncluded ? ["Aviachipta"] : []),
        ...parseList(form.priceIncludesExtra),
      ];
      const dedupedIncludes = Array.from(new Set(includes));

      const payload = {
        title: form.title,
        city: form.city,
        subtitle: form.subtitle,
        description: form.description,
        duration: buildDuration(),
        responseTimeMinutes: Number(form.responseTimeMinutes || 45),
        price: form.price,
        priceCurrency: form.priceCurrency,
        priceBasis: basis.label,
        priceBasisPeople: basis.people,
        badge: form.badge,
        imageUrl: form.imageUrl,
        highlights: form.highlights.split(",").map((value) => value.trim()).filter(Boolean),
        itinerary: parseItinerary(form.itineraryText),
        departureCity: form.departureCity,
        destinationCountry: form.destinationCountry,
        tourGroup: form.tourGroup,
        nights: form.nights ? Number(form.nights) : undefined,
        days: form.days ? Number(form.days) : undefined,
        hotelIncluded: form.hotelIncluded,
        flightIncluded: form.flightIncluded,
        hotelName: form.hotelName,
        hotelCategory: form.hotelCategory,
        hotelLocation: form.hotelLocation,
        roomType: form.roomType,
        mealPlan: form.mealPlan,
        mealPlanLabel: MEAL_PLAN_OPTIONS.find((option) => option.value === form.mealPlan)?.hint || undefined,
        discount: form.discount,
        childPolicy: form.childPolicy,
        instantConfirmation: form.instantConfirmation,
        promo: Boolean(form.discount.trim()),
        priceLockMinutes: form.priceLockEnabled ? Number(form.priceLockMinutes || 0) : 0,
        priceIncludes: dedupedIncludes,
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

  function renderInput(key: TextKey, label: string, placeholder = "", type = "text") {
    return (
      <label key={key}>
        <span>{label}</span>
        <input type={type} placeholder={placeholder} value={form[key] as string} onChange={(event) => update(key, event.target.value)} />
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
            {renderSelect("departureCity", "Qayerdan (jo'nash shahri) *", DEPARTURE_OPTIONS.map((value) => ({ value, label: value || "Tanlang" })))}
            {renderSelect("destinationCountry", "Qayerga (yo'nalish) *", DESTINATION_OPTIONS.map((value) => ({ value, label: value || "Tanlang" })))}
            {renderInput("title", "Tour nomi *", "Dubay sarguzashtlari")}
            {renderInput("city", "Shahar / kurort *", "Dubai, Antalya...")}
            {renderInput("subtitle", "Qisqa subtitle *", "Lyuks mehmonxona + ekskursiyalar")}
            {renderInput("tourGroup", "Tour guruhi", "Plyaj, Ziyorat, Shahar...")}
            {renderInput("nights", "Nechta kecha", "6", "number")}
            {renderInput("days", "Nechta kunduz *", "7", "number")}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="agency-checkbox-group agency-wide">
              <label className="agency-checkbox-row">
                <input checked={form.hotelIncluded} onChange={() => toggle("hotelIncluded")} type="checkbox" />
                Mehmonxona paketga kiritilgan
              </label>
            </div>
            {renderInput("hotelName", "Mehmonxona nomi", "Rixos Premium...")}
            {renderSelect("hotelCategory", "Kategoriya", HOTEL_CATEGORY_OPTIONS.map((value) => ({ value, label: value || "Tanlanmagan" })))}
            {renderInput("hotelLocation", "Joylashuv (ixtiyoriy)", "Dubai Marina, 1-qator...")}
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
            {renderInput("discount", "Chegirma", "Erta bron -15% / 100$ chegirma")}
            {renderInput("childPolicy", "Bolalar siyosati", "0-6 yosh bepul, 7-12 yosh -50%...")}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {renderInput("price", "Narx matni *", "$650 dan")}
            {renderSelect("priceCurrency", "Valyuta", CURRENCY_OPTIONS.map((value) => ({ value, label: value })))}
            {renderSelect("priceBasisChoice" as TextKey, "Narx nimaga", PRICE_BASIS_CHOICES)}
            {form.priceBasisChoice === "custom"
              ? renderInput("priceBasisPeople", "Necha kishi uchun", "4", "number")
              : null}
            {renderInput("responseTimeMinutes", "Javob vaqti (daqiqa)", "45", "number")}
            {renderInput("badge", "Badge (Latest / Popular)", "Latest")}

            <div className="agency-checkbox-group agency-wide">
              <label className="agency-checkbox-row">
                <input checked={form.flightIncluded} onChange={() => toggle("flightIncluded")} type="checkbox" />
                Avia chipta narxga kiritilgan
              </label>
              <label className="agency-checkbox-row">
                <input checked={form.instantConfirmation} onChange={() => toggle("instantConfirmation")} type="checkbox" />
                Tezkor tasdiqlash (instant confirmation)
              </label>
            </div>

            <label>
              <span>Narx kafolati (muddat)</span>
              <select
                value={form.priceLockEnabled ? "yes" : "no"}
                onChange={(event) => setForm((c) => ({ ...c, priceLockEnabled: event.target.value === "yes" }))}
              >
                <option value="no">Yo&apos;q</option>
                <option value="yes">Ha</option>
              </select>
              <small className="agency-field-hint">Ha bo&apos;lsa — shu daqiqalar davomida narx o&apos;zgarmaydi (ilovada orqaga sanaydi).</small>
            </label>
            {form.priceLockEnabled ? renderInput("priceLockMinutes", "Necha daqiqa narx kafolatlanadi", "60", "number") : null}

            <label className="agency-wide">
              <span>Narxga KIRADI</span>
              <small className="agency-field-hint">
                Mehmonxona va Avia checkboxlari avtomatik qo&apos;shiladi. Qo&apos;shimchasini har qatorga bittadan yozing.
              </small>
              <textarea
                placeholder={"Transfer\nSug'urta\nEkskursiyalar"}
                value={form.priceIncludesExtra}
                onChange={(event) => update("priceIncludesExtra", event.target.value)}
              />
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
