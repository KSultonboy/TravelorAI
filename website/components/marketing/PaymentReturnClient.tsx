"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";

/**
 * CLICK to'lovidan qaytish sahifasi (return_url).
 *
 * MUHIM (xavfsizlik): redirect'ning o'zi to'lov isboti EMAS — holat faqat
 * backend'dan so'raladi (GET /payments/status/:tx, egalik tekshiruvi bilan).
 * Ilovadan boshlangan to'lovda (from=app) bu brauzerda sessiya bo'lmasligi
 * mumkin — u holda holatni ilova o'zi ko'rsatadi.
 */

type ApiResult<T> = { success: true; data: T } | { success: false; message: string };

type StatusData = {
  merchantTransId: string;
  state: "created" | "prepared" | "paid" | "cancelled";
  amount: number;
  months: number;
  premium: { active: boolean; plan: string | null; until: string | null } | null;
};

const POLL_MS = 4000;
const MAX_POLLS = 45; // ~3 daqiqa

const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
}

export default function PaymentReturnClient() {
  const params = useSearchParams();
  const tx = (params.get("tx") || "").trim();
  const fromApp = params.get("from") === "app";

  const [status, setStatus] = useState<StatusData | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);

  const check = useCallback(async () => {
    if (!tx) return;
    try {
      const response = await fetch(`/api/backend/payments/status/${encodeURIComponent(tx)}`, { cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setUnauthorized(true);
        return;
      }
      const result = (await response.json()) as ApiResult<StatusData>;
      if (result.success) {
        setUnauthorized(false);
        setStatus(result.data);
      } else if (response.status === 404) {
        setUnauthorized(true);
      }
    } catch {
      // tarmoq xatosi — keyingi urinishda yana
    }
  }, [tx]);

  useEffect(() => {
    if (!tx) return undefined;
    check();
    const timer = setInterval(() => {
      pollCount.current += 1;
      if (pollCount.current > MAX_POLLS) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      const done = status && (status.state === "paid" || status.state === "cancelled");
      if (!done) check();
    }, POLL_MS);
    return () => clearInterval(timer);
    // status ataylab dependency emas — intervalni qayta yaratmaslik uchun ref uslubi o'rniga soddalik
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, check]);

  useEffect(() => {
    if (status && (status.state === "paid" || status.state === "cancelled")) {
      // yakuniy holat — boshqa so'rov shart emas
      pollCount.current = MAX_POLLS + 1;
    }
  }, [status]);

  if (!tx) {
    return (
      <div className="mkt-prose">
        <p>To&apos;lov raqami topilmadi. <Link href="/premium">Premium sahifasiga qaytish</Link></p>
      </div>
    );
  }

  // Ilovadan boshlangan to'lov: bu brauzerda akkaunt sessiyasi yo'q bo'lishi normal —
  // holatni ilova ko'rsatadi.
  if (unauthorized && fromApp) {
    return (
      <div className="mkt-prose" style={{ textAlign: "center" }}>
        <p>
          <CheckCircle2 size={40} />
        </p>
        <h2>To&apos;lov qabul qilinmoqda</h2>
        <p>
          Endi TravelorAI ilovasiga qayting — to&apos;lov tasdiqlangach Premium avtomatik faollashadi va ilovada
          ko&apos;rinadi.
        </p>
        <p>
          <a className="btn btn--gold btn--md" href="travelorai://checkout">
            Ilovaga qaytish
          </a>
        </p>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="mkt-prose" style={{ textAlign: "center" }}>
        <h2>Holatni ko&apos;rish uchun kiring</h2>
        <p>To&apos;lov holati faqat o&apos;z akkauntingizda ko&apos;rinadi.</p>
        <p>
          <Link className="btn btn--navy btn--md" href={`/signin?next=${encodeURIComponent(`/payment/return?tx=${tx}`)}`}>
            Kirish
          </Link>
        </p>
      </div>
    );
  }

  if (status?.state === "paid") {
    return (
      <div className="mkt-prose" style={{ textAlign: "center" }}>
        <p>
          <CheckCircle2 size={40} />
        </p>
        <h2>To&apos;lov muvaffaqiyatli!</h2>
        <p>
          Premium <strong>{formatDate(status.premium?.until)}</strong> gacha faollashdi —{" "}
          {som(status.amount)} so&apos;m · {status.months} oy.
        </p>
        <p>Mobil ilovaga shu akkaunt bilan kirsangiz, Premium u yerda ham faol bo&apos;ladi.</p>
        <p>
          <Link className="btn btn--gold btn--md" href="/my-trips">
            Kabinetga o&apos;tish
          </Link>
        </p>
      </div>
    );
  }

  if (status?.state === "cancelled") {
    return (
      <div className="mkt-prose" style={{ textAlign: "center" }}>
        <p>
          <XCircle size={40} />
        </p>
        <h2>To&apos;lov bekor qilindi</h2>
        <p>Mablag&apos; yechilmagan bo&apos;lsa, hech narsa qilish shart emas. Qayta urinib ko&apos;rishingiz mumkin.</p>
        <p>
          <Link className="btn btn--gold btn--md" href="/premium">
            Qayta urinish
          </Link>
        </p>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="mkt-prose" style={{ textAlign: "center" }}>
        <h2>Tasdiq hali kelmadi</h2>
        <p>
          To&apos;lov tasdig&apos;i CLICK&apos;dan biroz kechikishi mumkin. Holatni keyinroq{" "}
          <Link href="/premium">Premium sahifasida</Link> tekshiring — to&apos;lov o&apos;tgan bo&apos;lsa, obuna
          avtomatik faollashadi.
        </p>
      </div>
    );
  }

  return (
    <div className="mkt-prose" style={{ textAlign: "center" }}>
      <p>
        <Clock3 size={40} />
      </p>
      <h2>To&apos;lov tasdiqlanishi kutilmoqda…</h2>
      <p>
        Buyurtma: <code>{tx}</code>
      </p>
      <p>
        <ShieldCheck size={15} style={{ verticalAlign: "-2px" }} /> Tasdiq to&apos;g&apos;ridan-to&apos;g&apos;ri
        CLICK serveridan keladi — sahifani yopib qo&apos;ysangiz ham obuna avtomatik faollashadi.
      </p>
    </div>
  );
}
