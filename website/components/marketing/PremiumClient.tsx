"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck, Star } from "lucide-react";

/**
 * Traveler Premium sotib olish — MOBIL ILOVA BILAN YAGONA obuna.
 * Backend bitta (User.premiumUntil), sayt /api/backend proxy (httpOnly cookie)
 * orqali xuddi ilova ishlatadigan endpointlarni chaqiradi: shu yerda to'lansa
 * ilovada ham ko'rinadi, ilovada to'lansa bu yerda ham.
 */

type ApiResult<T> = { success: true; data: T } | { success: false; message: string };

type PremiumInfo = { active: boolean; plan: string | null; until: string | null };
type PremiumPlan = { slug: string; name: string; priceMonthlyUzs: number; features: string[] };
type PlansData = { clickEnabled: boolean; plans: PremiumPlan[]; premium: PremiumInfo | null };
type CheckoutData = { payUrl: string; merchantTransId: string; amount: number; months: number };

const MONTH_OPTIONS = [1, 3, 6, 12];

const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
}

async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  const response = await fetch(`/api/backend${path}`, { ...init, headers, cache: "no-store" });
  return response.json();
}

export default function PremiumClient() {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [clickEnabled, setClickEnabled] = useState(false);
  const [plan, setPlan] = useState<PremiumPlan | null>(null);
  const [premium, setPremium] = useState<PremiumInfo | null>(null);
  const [months, setMonths] = useState(1);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [me, plans] = await Promise.all([
        api<{ user: { id: string } | null }>("/auth/me"),
        api<PlansData>("/payments/plans"),
      ]);
      setLoggedIn(Boolean(me.success && me.data.user?.id));
      if (plans.success) {
        setClickEnabled(Boolean(plans.data.clickEnabled));
        setPlan(plans.data.plans?.[0] || null);
        setPremium(plans.data.premium || null);
      }
    } catch {
      setErrorMsg("Ma'lumotlarni yuklab bo'lmadi. Sahifani yangilang.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startPayment = useCallback(async () => {
    if (!plan) return;
    setErrorMsg(null);
    setPaying(true);
    try {
      const result = await api<CheckoutData>("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ planSlug: plan.slug, months, platform: "web" }),
      });
      if (!result.success) {
        setErrorMsg(result.message || "To'lovni boshlab bo'lmadi.");
        setPaying(false);
        return;
      }
      // CLICK'ning rasmiy to'lov sahifasiga o'tamiz; qaytish — /payment/return
      window.location.href = result.data.payUrl;
    } catch {
      setErrorMsg("To'lovni boshlab bo'lmadi. Qayta urinib ko'ring.");
      setPaying(false);
    }
  }, [plan, months]);

  if (loading) {
    return <p className="mkt-plan__desc">Yuklanmoqda…</p>;
  }

  if (!plan) {
    return <p className="mkt-plan__desc">Hozircha sotuvda Premium plan yo&apos;q.</p>;
  }

  const total = plan.priceMonthlyUzs * months;

  return (
    <div className="mkt-plans" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="mkt-plan mkt-plan--best">
        <span className="mkt-plan__tag">
          <Star size={14} /> Ilova va saytda birga ishlaydi
        </span>
        <div className="mkt-plan__name">{plan.name}</div>

        {premium?.active ? (
          <p className="mkt-plan__desc">
            <ShieldCheck size={15} style={{ verticalAlign: "-2px" }} /> Premium faol —{" "}
            <strong>{formatDate(premium.until)}</strong> gacha. Yangi to&apos;lov muddat ustiga qo&apos;shiladi.
          </p>
        ) : (
          <p className="mkt-plan__desc">
            Obuna akkauntingizga bog&apos;lanadi: mobil ilovada ham, saytda ham bir xil ishlaydi.
          </p>
        )}

        <div className="mkt-plan__price">
          <b>{som(plan.priceMonthlyUzs)}</b>
          <span>so&apos;m / oy</span>
        </div>

        <ul className="mkt-plan__list">
          {plan.features.map((f) => (
            <li key={f}>
              <Check size={16} /> <span>{f}</span>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
          {MONTH_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={`btn btn--md ${months === m ? "btn--gold" : "btn--navy"}`}
              style={{ flex: 1 }}
            >
              {m} oy
            </button>
          ))}
        </div>

        <p className="mkt-plan__usd">
          Jami: <strong>{som(total)} so&apos;m</strong> · {months} oy
        </p>

        {errorMsg ? (
          <p className="mkt-plan__desc" role="alert" style={{ color: "#c73b3b" }}>
            {errorMsg}
          </p>
        ) : null}

        {!loggedIn ? (
          <Link href="/signin?next=/premium" className="btn btn--gold btn--md btn--block">
            Kirish va Premium olish
          </Link>
        ) : !clickEnabled ? (
          <p className="mkt-plan__desc">Onlayn to&apos;lov hozircha sozlanmagan — tez orada ochiladi.</p>
        ) : (
          <button
            type="button"
            onClick={startPayment}
            disabled={paying}
            className="btn btn--gold btn--md btn--block"
          >
            {paying ? "Tayyorlanmoqda…" : "CLICK orqali to'lash"}
          </button>
        )}

        <p className="mkt-plan__usd" style={{ marginTop: 10 }}>
          <ShieldCheck size={14} style={{ verticalAlign: "-2px" }} /> To&apos;lov CLICK&apos;ning rasmiy sahifasida
          amalga oshadi — karta ma&apos;lumotlari bizga yetib bormaydi.
        </p>
      </div>
    </div>
  );
}
