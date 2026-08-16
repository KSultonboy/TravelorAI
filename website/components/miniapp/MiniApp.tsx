"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TgUser = { id: string; firstName: string; username: string | null };
type Agency = { name: string; slug: string; city?: string | null; description?: string | null; phone?: string | null; imageUrl?: string | null; rating?: number };
type TourItem = { id: string; title: string; city: string; subtitle?: string; duration?: string; price?: string | null; priceMin?: number | null; nights?: number | null; imageUrl?: string | null; highlights?: string[] };
type TourFull = TourItem & {
  description?: string | null; images?: string[]; itinerary?: unknown; mapAddress?: string | null;
  hotelName?: string | null; hotelCategory?: string | null; mealPlanLabel?: string | null;
  destinationCountry?: string | null; priceIncludes?: string[]; priceExcludes?: string[];
};
type Req = { id: string; title: string; stage: string; stageLabel: string; travelDate?: string | null; createdAt: string };
type Offer = { id: string; title: string; priceText?: string | null; url: string; createdAt: string };

/* Telegram WebApp SDK — turlari rasmiy paketda yo'q, minimal shakl yetarli */
type WebApp = {
  initData: string;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  ready: () => void;
  expand: () => void;
  openLink: (url: string) => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  MainButton: {
    setText: (t: string) => void; show: () => void; hide: () => void;
    onClick: (cb: () => void) => void; offClick: (cb: () => void) => void;
    showProgress: (leave?: boolean) => void; hideProgress: () => void;
  };
  HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred: (s: string) => void };
};

function getWebApp(): WebApp | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Telegram?: { WebApp?: WebApp } };
  return w.Telegram?.WebApp || null;
}

// SDK skripti yuklanguncha kutamiz (afterInteractive bilan yuklanadi)
function waitForWebApp(timeoutMs = 4000): Promise<WebApp | null> {
  return new Promise((resolve) => {
    const found = getWebApp();
    if (found) return resolve(found);
    const started = Date.now();
    const id = setInterval(() => {
      const wa = getWebApp();
      if (wa || Date.now() - started > timeoutMs) {
        clearInterval(id);
        resolve(wa);
      }
    }, 100);
  });
}

function money(t: TourItem) {
  if (t.price) return t.price;
  if (t.priceMin) return `$${t.priceMin}`;
  return "Narx kelishiladi";
}

function days(itinerary: unknown): { day: number; title: string }[] {
  if (!Array.isArray(itinerary)) return [];
  const out: { day: number; title: string }[] = [];
  itinerary.forEach((row, i) => {
    if (typeof row === "string") { if (row.trim()) out.push({ day: i + 1, title: row.trim() }); return; }
    if (row && typeof row === "object") {
      const r = row as Record<string, unknown>;
      const title = String(r.title || r.text || "").trim();
      if (title) out.push({ day: Number(r.day) || i + 1, title });
    }
  });
  return out;
}

export default function MiniApp({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [user, setUser] = useState<TgUser | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [tab, setTab] = useState<"tours" | "cabinet">("tours");
  const [tours, setTours] = useState<TourItem[]>([]);
  const [detail, setDetail] = useState<TourFull | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const initRef = useRef("");

  const api = useCallback(
    async <T,>(path: string, body: Record<string, unknown> = {}): Promise<T | null> => {
      try {
        const res = await fetch(`/api/backend/miniapp/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agency: slug, initData: initRef.current, ...body }),
        });
        const json = await res.json();
        if (!json?.success) {
          setErrMsg(json?.message || "Xatolik yuz berdi");
          return null;
        }
        return json.data as T;
      } catch {
        setErrMsg("Aloqa uzildi. Internetni tekshiring.");
        return null;
      }
    },
    [slug]
  );

  /* ---- ishga tushirish ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const wa = await waitForWebApp();
      if (!alive) return;

      if (!wa || !wa.initData) {
        setErrMsg("Bu sahifa Telegram ilovasi ichida ochilishi kerak. Botdagi menyu tugmasini bosing.");
        setPhase("error");
        return;
      }

      wa.ready();
      wa.expand();
      initRef.current = wa.initData;

      // Ranglar TravelorAI brendidan (zumrad + tilla + oq) — Telegram mavzusi
      // ularni bosib ketmaydi, aks holda ilova "hech kimniki emas"dek ko'rinadi.
      // Telegram'dan faqat yorug'/qorong'i rejimini olamiz.
      document.documentElement.dataset.tgScheme = wa.colorScheme;

      const s = await api<{ user: TgUser; agency: Agency }>("session");
      if (!alive) return;
      if (!s) { setPhase("error"); return; }
      setUser(s.user);
      setAgency(s.agency);
      setPhase("ready");

      const t = await api<{ items: TourItem[] }>("tours");
      if (alive && t) setTours(t.items || []);
    })();
    return () => { alive = false; };
  }, [api]);

  /* ---- kabinet ma'lumoti ---- */
  const loadCabinet = useCallback(async () => {
    const d = await api<{ requests: Req[]; offers: Offer[] }>("me");
    if (d) { setRequests(d.requests || []); setOffers(d.offers || []); }
  }, [api]);

  useEffect(() => { if (tab === "cabinet" && phase === "ready") void loadCabinet(); }, [tab, phase, loadCabinet]);

  /* ---- Telegram tugmalari ---- */
  const openTour = useCallback(async (id: string) => {
    setSent(false);
    const d = await api<TourFull>("tour", { tourId: id });
    if (d) { setDetail(d); getWebApp()?.HapticFeedback?.impactOccurred("light"); }
  }, [api]);

  const sendRequest = useCallback(async () => {
    if (!detail || busy) return;
    setBusy(true);
    const wa = getWebApp();
    wa?.MainButton.showProgress(true);
    const r = await api<{ ok: boolean }>("request", { tourId: detail.id });
    wa?.MainButton.hideProgress();
    setBusy(false);
    if (r) {
      setSent(true);
      wa?.HapticFeedback?.notificationOccurred("success");
      void loadCabinet();
    }
  }, [api, detail, busy, loadCabinet]);

  // Orqaga tugmasi — tur sahifasida ko'rinadi
  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;
    const back = () => setDetail(null);
    if (detail) { wa.BackButton.onClick(back); wa.BackButton.show(); }
    else wa.BackButton.hide();
    return () => { wa.BackButton.offClick(back); };
  }, [detail]);

  // Asosiy tugma — tur sahifasida "so'rov yuborish"
  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;
    if (detail && !sent) {
      wa.MainButton.setText("Qiziqdim — soʻrov yuborish");
      wa.MainButton.onClick(sendRequest);
      wa.MainButton.show();
    } else {
      wa.MainButton.hide();
    }
    return () => { wa.MainButton.offClick(sendRequest); };
  }, [detail, sent, sendRequest]);

  const dayList = useMemo(() => days(detail?.itinerary), [detail]);

  /* ---- ko'rinishlar ---- */
  if (phase === "loading") {
    return <div className="ma-center"><div className="ma-spin" /><p>Yuklanmoqda…</p></div>;
  }
  if (phase === "error") {
    return (
      <div className="ma-center">
        <h1>Ochib boʻlmadi</h1>
        <p>{errMsg}</p>
      </div>
    );
  }

  /* eslint-disable @next/next/no-img-element */
  if (detail) {
    return (
      <main className="ma">
        <div className={`ma-hero${detail.imageUrl ? " ma-hero--photo" : ""}`}>
          {detail.imageUrl ? <img src={detail.imageUrl} alt={detail.title} /> : null}
          <div className="ma-hero__tx">
            <h1>{detail.title}</h1>
            <div className="ma-meta">
              <span>{detail.city}{detail.destinationCountry ? `, ${detail.destinationCountry}` : ""}</span>
              {detail.duration ? <span>{detail.duration}</span> : null}
            </div>
          </div>
        </div>

        <div className="ma-price">
          <span>Narx</span>
          <b>{money(detail)}</b>
        </div>

        {sent ? (
          <div className="ma-ok">Soʻrovingiz yuborildi. Agentlik tez orada bogʻlanadi.</div>
        ) : null}

        {detail.description || detail.subtitle ? (
          <section className="ma-sec"><h2>Tur haqida</h2><p>{detail.description || detail.subtitle}</p></section>
        ) : null}

        {(detail.highlights || []).length ? (
          <section className="ma-sec">
            <h2>Nimalar kiritilgan</h2>
            <div className="ma-chips">{(detail.highlights || []).map((h) => <span key={h}>{h}</span>)}</div>
          </section>
        ) : null}

        {detail.hotelName || detail.mealPlanLabel || detail.nights ? (
          <section className="ma-sec">
            <h2>Asosiy maʼlumotlar</h2>
            <dl className="ma-specs">
              {detail.nights ? <div><dt>Kechalar</dt><dd>{detail.nights}</dd></div> : null}
              {detail.hotelName ? <div><dt>Mehmonxona</dt><dd>{detail.hotelName}{detail.hotelCategory ? ` (${detail.hotelCategory})` : ""}</dd></div> : null}
              {detail.mealPlanLabel ? <div><dt>Ovqatlanish</dt><dd>{detail.mealPlanLabel}</dd></div> : null}
            </dl>
          </section>
        ) : null}

        {dayList.length ? (
          <section className="ma-sec">
            <h2>Kun boʻyicha reja</h2>
            <ol className="ma-days">
              {dayList.map((d, i) => <li key={i}><span>{d.day}</span>{d.title}</li>)}
            </ol>
          </section>
        ) : null}

        {(detail.priceIncludes || []).length ? (
          <section className="ma-sec">
            <h2>Narxga kiritilgan</h2>
            <ul className="ma-list">{(detail.priceIncludes || []).map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        ) : null}

        {(detail.priceExcludes || []).length ? (
          <section className="ma-sec">
            <h2>Narxga kirmagan</h2>
            <ul className="ma-list ma-list--no">{(detail.priceExcludes || []).map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        ) : null}

        <button className="ma-btn" onClick={() => setDetail(null)}>Orqaga</button>
      </main>
    );
  }

  return (
    <main className="ma">
      <header className="ma-top">
        <div className="ma-top__row">
          {agency?.imageUrl
            ? <img className="ma-logo" src={agency.imageUrl} alt="" />
            : <span className="ma-logo ma-logo--f">{(agency?.name || "A").slice(0, 1)}</span>}
          <div className="ma-top__id">
            <b>{agency?.name}</b>
            <small>{agency?.city}</small>
          </div>
        </div>
        <p className="ma-top__hi">
          {user?.firstName ? <>Salom, <b>{user.firstName}</b>!</> : "Xush kelibsiz!"} Qayerga sayohat qilamiz?
        </p>
      </header>

      <nav className="ma-tabs">
        <button className={tab === "tours" ? "on" : ""} onClick={() => setTab("tours")}>Turlar</button>
        <button className={tab === "cabinet" ? "on" : ""} onClick={() => setTab("cabinet")}>Kabinetim</button>
      </nav>

      {errMsg ? <div className="ma-err">{errMsg}</div> : null}

      {tab === "tours" ? (
        tours.length ? (
          <div className="ma-grid">
            {tours.map((t) => (
              <button className="ma-card" key={t.id} onClick={() => void openTour(t.id)}>
                <div className="ma-card__img">
                  {t.imageUrl ? <img src={t.imageUrl} alt={t.title} loading="lazy" /> : <div className="ma-card__ph" />}
                  <span className="ma-card__price">{money(t)}</span>
                </div>
                <div className="ma-card__tx">
                  <b>{t.title}</b>
                  <small>{t.city}{t.duration ? ` · ${t.duration}` : ""}</small>
                  {(t.highlights || []).length ? (
                    <div className="ma-card__tags">
                      {(t.highlights || []).slice(0, 3).map((h) => <span key={h}>{h}</span>)}
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="ma-empty">Hozircha turlar qoʻshilmagan.</p>
        )
      ) : (
        <div className="ma-cab">
          <h2>Mening soʻrovlarim</h2>
          {requests.length ? (
            <div className="ma-rows">
              {requests.map((r) => (
                <div className="ma-row" key={r.id}>
                  <div><b>{r.title}</b><small>{new Date(r.createdAt).toLocaleDateString("uz-UZ")}</small></div>
                  <span className={`ma-badge ma-badge--${r.stage}`}>{r.stageLabel}</span>
                </div>
              ))}
            </div>
          ) : <p className="ma-empty">Hali soʻrov yoʻq. Turlardan birini tanlang.</p>}

          <h2>Menga yuborilgan takliflar</h2>
          {offers.length ? (
            <div className="ma-rows">
              {offers.map((o) => (
                <button className="ma-row ma-row--btn" key={o.id} onClick={() => getWebApp()?.openLink(o.url)}>
                  <div><b>{o.title}</b><small>{o.priceText || ""}</small></div>
                  <span className="ma-open">Ochish</span>
                </button>
              ))}
            </div>
          ) : <p className="ma-empty">Hozircha shaxsiy taklif yoʻq.</p>}
        </div>
      )}
    </main>
  );
}
