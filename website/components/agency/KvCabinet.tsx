"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useAgencySession } from "@/lib/agency/session";
import { useCrm } from "@/lib/agency/useCrm";
import { onExternalClick, openExternal, saveFile } from "@/lib/agency/external";
import { agencyApi, formatMoney, formatDate, statusLabel, readImage } from "@/lib/agency/api";
import { REGIONS, REGION_GROUPS, regionByKey } from "@/lib/travelData";
import { getNotifs, markRead, markAllRead, clearNotifs, pushNotif, seedNotifs, type KvNotif } from "@/lib/agency/notify";
import {
  CRM_STAGES,
  STAGE_LABEL,
  timeAgo,
  whatsappLink,
  telegramLink,
  telegramLinkSmart,
  greetingTemplate,
  normalizePhone,
  normalizeSource,
  LEAD_SOURCE_LABEL,
  LEAD_SOURCE_OPTIONS,
  LEAD_SOURCES,
  type CrmLead,
  type CrmStage,
} from "@/lib/agency/crm";
import {
  DOC_LIST,
  DOC_LABEL,
  buildDocumentFile,
  getRequisites,
  saveRequisites,
  EMPTY_REQUISITES,
  getTemplates,
  saveTemplates,
  DEFAULT_DOC_TEMPLATES,
  DOC_PLACEHOLDERS,
  parseBody,
  serializeBody,
  type DocSection,
  type DocType,
  type DocRequisites,
  type DocTemplates,
} from "@/lib/agency/documents";
import { AuditPage, AutomationPage, CsvImportPage, InsightsPage, IntegrationPage, WhatsAppPage } from "./CrmCompetitionPages";

/* ---- tiny inline icons ---- */
const I = {
  grid: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  list: "M3 5h18M3 12h18M3 19h18",
  users: "M9 8a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 3-6 7-6s7 2.7 7 6",
  box: "M12 2 3 7v10l9 5 9-5V7z M3 7l9 5 9-5 M12 12v10",
  cal: "M3 4h18v17H3z M3 9h18 M8 2v4 M16 2v4",
  card: "M2 5h20v14H2z M2 10h20",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  plus: "M12 5v14M5 12h14",
  out: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  check: "M20 6 9 17l-5-5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  money: "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  pin: "M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z",
  trash: "M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14",
  bolt: "M13 2 3 14h7l-1 8 10-12h-7z",
  lock: "M5 11h14v10H5z M9 11V7a3 3 0 0 1 6 0v4",
  send: "M22 2 11 13 M22 2l-7 20-4-9-9-4z",
  eye: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  copy: "M9 9h10v12H9z M5 15H3V3h12v2",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  expand: "M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M16 21h3a2 2 0 0 0 2-2v-3 M3 16v3a2 2 0 0 0 2 2h3",
  compress: "M8 3v3a2 2 0 0 1-2 2H3 M21 8h-3a2 2 0 0 1-2-2V3 M3 16h3a2 2 0 0 1 2 2v3 M16 21v-3a2 2 0 0 1 2-2h3",
  edit: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16v-4 M12 8h.01",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
};
function Ic({ d, s = 18 }: { d: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function formatCurrencyAmount(value: number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("uz-UZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(value || 0);
}
type DueKind = "overdue" | "today" | "soon" | "far" | "none";
function dueInfo(dueAt?: string): { kind: DueKind; label: string; cls: string } {
  if (!dueAt) return { kind: "none", label: "Muddatsiz", cls: "b-grey" };
  const d = new Date(dueAt);
  const t = d.getTime();
  if (Number.isNaN(t)) return { kind: "none", label: "Muddatsiz", cls: "b-grey" };
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startDue - startToday) / 86400000);
  if (t < now.getTime()) return { kind: "overdue", label: "Muddati o'tgan", cls: "b-rose" };
  if (days === 0) return { kind: "today", label: "Bugun", cls: "b-amber" };
  if (days === 1) return { kind: "soon", label: "Ertaga", cls: "b-amber" };
  if (days <= 7) return { kind: "soon", label: `${days} kundan keyin`, cls: "b-green" };
  return { kind: "far", label: formatDate(dueAt), cls: "b-grey" };
}
function isOverdue(t: any): boolean {
  return !t.done && !!t.dueAt && new Date(t.dueAt).getTime() < Date.now();
}

// Brauzer bildirishnomasi — CRM boshqa tabda bo'lsa ham ko'rinadi.
// Ruxsat berilmagan bo'lsa jimgina o'tkazib yuboriladi (o'zimiz so'ramaymiz — foydalanuvchi tugma bosadi).
function browserNotify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    /* ignore */
  }
}

const NAV: { key: string; label: string; icon: string; group: string; badge?: "leads" | "tasks" }[] = [
  { key: "dashboard", label: "Boshqaruv paneli", icon: I.grid, group: "Asosiy" },
  { key: "leads", label: "Lidlar / Voronka", icon: I.list, group: "Asosiy", badge: "leads" },
  { key: "customers", label: "Mijozlar", icon: I.users, group: "Asosiy" },
  { key: "tasks", label: "Vazifalar", icon: I.check, group: "Asosiy", badge: "tasks" },
  { key: "packages", label: "Turlar / Paketlar", icon: I.box, group: "Sotuv" },
  { key: "presentations", label: "Takliflar", icon: I.send, group: "Sotuv" },
  { key: "reviews", label: "Sharhlar", icon: I.star, group: "Sotuv" },
  { key: "payments", label: "Mijoz to'lovlari", icon: I.card, group: "Sotuv" },
  { key: "reports", label: "Hisobotlar", icon: I.chart, group: "Boshqa" },
  { key: "insights", label: "SLA va KPI", icon: I.clock, group: "Boshqa" },
  { key: "automation", label: "Avtomatizatsiya", icon: I.bolt, group: "Boshqa" },
  { key: "api-webhooks", label: "API va Webhook", icon: I.link, group: "Boshqa" },
  { key: "csv-import", label: "CSV import", icon: I.download, group: "Boshqa" },
  { key: "audit", label: "Audit tarixi", icon: I.eye, group: "Boshqa" },
  { key: "whatsapp", label: "WhatsApp", icon: I.send, group: "Boshqa" },
  { key: "documents", label: "Hujjatlar", icon: I.doc, group: "Boshqa" },
  // Obuna to'lovi (CLICK) endi Sozlamalar → «Obuna va tarif» ichida.
  // Ilgari alohida band edi, lekin Sozlamalar ham xuddi shu narsani
  // ko'rsatardi — bir xil narsa ikki joyda turardi.
  { key: "settings", label: "Sozlamalar", icon: I.gear, group: "Boshqa" },
];
const TITLES: Record<string, string> = { ...Object.fromEntries(NAV.map((n) => [n.key, n.label])), telegram: "Telegram bot", instagram: "Instagram Direct", whatsapp: "WhatsApp Cloud API" };
const OPEN: CrmStage[] = ["new", "contacted", "quoted"];
const UZ_MONTH = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const PKG_GRADS = [
  "linear-gradient(135deg,#0F5132,#0a3d25)",
  "linear-gradient(135deg,#CA8A04,#8A5A08)",
  "linear-gradient(135deg,#128054,#0b4a30)",
  "linear-gradient(135deg,#3E86B0,#255d7d)",
  "linear-gradient(135deg,#1E9E63,#0F5132)",
  "linear-gradient(135deg,#B5761A,#8A5A08)",
];

const NOTIF_KIND: Record<string, string> = {
  new: "Yangi lid keldi",
  contacted: "Mijoz bilan bog'lanildi",
  quoted: "Taklif yuborildi",
  won: "Kelishuv yopildi",
  completed: "Sayohat yakunlandi",
  lost: "Lid yo'qotildi",
};

function notifDot(n: KvNotif) {
  if (n.kind === "payment" || n.kind === "booking") return "s-won";
  if (n.kind === "tour") return "s-quoted";
  return `s-${n.stage || "new"}`;
}

function NotificationBell({ agencyId, leads, go }: { agencyId: string; leads: CrmLead[]; go: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KvNotif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agencyId || agencyId === "anon") return;
    const seenKey = `kv_seen_${agencyId}`;
    let seen: string[] | null = null;
    try { const raw = window.localStorage.getItem(seenKey); seen = raw ? JSON.parse(raw) : null; } catch { seen = null; }
    if (seen === null) {
      // birinchi ochilish: feed'ni mavjud lidlardan to'ldiramiz, spam qilmaymiz
      const recent = [...leads].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8);
      seedNotifs(agencyId, recent.map((l) => ({
        kind: "lead" as const,
        stage: l.stage,
        title: NOTIF_KIND[l.stage] || "Lid yangilandi",
        sub: `${l.customerName}${l.tourTitle ? ` • ${l.tourTitle}` : ""}`,
        ts: new Date(l.createdAt || Date.now()).getTime(),
        read: l.stage !== "new",
      })));
    } else {
      // yangi lid keldi (qo'lda yoki marketplace) — seen ro'yxatida yo'q bo'lsa
      const known = new Set(seen);
      for (const l of leads) {
        if (l.stage === "new" && !known.has(l.id)) {
          pushNotif(agencyId, { kind: "lead", stage: "new", title: "Yangi lid keldi", sub: `${l.customerName}${l.tourTitle ? ` • ${l.tourTitle}` : ""}` });
        }
      }
    }
    try { window.localStorage.setItem(seenKey, JSON.stringify(leads.map((l) => l.id))); } catch { /* ignore */ }
    const sync = () => setItems(getNotifs(agencyId));
    sync();
    window.addEventListener("kv:notif", sync);
    return () => window.removeEventListener("kv:notif", sync);
  }, [agencyId, leads]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className={`notif${open ? " open" : ""}`} ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button className="icon-btn" aria-label="Bildirishnomalar" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {unread > 0 ? <span className="nbadge">{unread > 9 ? "9+" : unread}</span> : null}
        <Ic d={I.bell} s={19} />
      </button>
      <div className="notif-menu" role="menu">
        <div className="notif-head">
          <b>Bildirishnomalar</b>
          {items.length > 0 ? (
            <div className="notif-actions">
              {unread > 0 ? <button className="notif-allread" onClick={() => markAllRead(agencyId)}>O&apos;qildi</button> : null}
              <button className="notif-allread notif-clear" onClick={() => clearNotifs(agencyId)}>Tozalash</button>
            </div>
          ) : null}
        </div>
        <div className="notif-list">
          {items.length === 0 ? (
            <div className="notif-empty">Hozircha bildirishnoma yo&apos;q</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`notif-item${n.read ? " read" : ""}`}>
                <span className={`kdot ${notifDot(n)}`} />
                <button className="notif-tx" onClick={() => { markRead(agencyId, n.id); setOpen(false); go("leads"); }}>
                  <b>{n.title}</b>
                  {n.sub ? <small>{n.sub}</small> : null}
                  <time>{timeAgo(new Date(n.ts).toISOString())}</time>
                </button>
                {!n.read ? (
                  <button className="notif-ack" title="Ko'rib chiqildi" aria-label="Ko'rib chiqildi" onClick={() => markRead(agencyId, n.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
        <button className="notif-foot" onClick={() => { setOpen(false); go("leads"); }}>Barcha lidlar &rarr;</button>
      </div>
    </div>
  );
}

/* ============ DESKTOP YANGILANISH ============
   Faqat desktop ilova (Tauri qobiq) ichida ko'rinadi — brauzerда yashirin.
   Tauri tomonда ochilgan ikki buyruqni chaqiradi: check_update / install_update. */
type TauriBridge = { core?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } };
type UpdateInfo = { current: string; latest: string | null; available: boolean; notes?: string | null };

function tauriInvoke(): ((cmd: string) => Promise<unknown>) | null {
  if (typeof window === "undefined") return null;
  const t = (window as unknown as { __TAURI__?: TauriBridge }).__TAURI__;
  const fn = t?.core?.invoke;
  return typeof fn === "function" ? (cmd: string) => fn(cmd) : null;
}

function DesktopUpdate() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "installing" | "error">("idle");
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsDesktop(!!tauriInvoke()); }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function check() {
    const invoke = tauriInvoke();
    if (!invoke) return;
    setState("checking"); setErr("");
    try {
      setInfo((await invoke("check_update")) as UpdateInfo);
      setState("idle");
    } catch (e) {
      setErr(String((e as Error)?.message || e || "Tekshirib bo'lmadi"));
      setState("error");
    }
  }

  async function install() {
    const invoke = tauriInvoke();
    if (!invoke) return;
    setState("installing"); setErr("");
    try {
      await invoke("install_update"); // muvaffaqiyatli bo'lsa ilova qayta ishga tushadi
      setState("idle");
    } catch (e) {
      setErr(String((e as Error)?.message || e || "O'rnatib bo'lmadi"));
      setState("error");
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void check();
  }

  if (!isDesktop) return null;

  return (
    <div className={`dsk-upd${open ? " open" : ""}`} ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button className="icon-btn" onClick={toggle} title="Dastur yangilanishi" aria-label="Dastur yangilanishi">
        {info?.available ? <span className="dsk-upd__dot" /> : null}
        <Ic d={I.download} s={18} />
      </button>

      <div className="dsk-upd__menu" role="dialog">
        <div className="dsk-upd__head">Dastur yangilanishi</div>

        <div className="dsk-upd__status">
          {state === "checking" ? "Tekshirilmoqda…"
            : state === "installing" ? "Yuklab olinmoqda va o'rnatilmoqda…"
            : state === "error" ? "Tekshirishda xatolik"
            : info?.available ? "Yangi versiya mavjud!"
            : "Yangilanish topilmadi"}
        </div>

        <div className="dsk-upd__rows">
          <div><span>Joriy versiya</span><b>{info?.current || "—"}</b></div>
          <div><span>Oxirgi versiya</span><b>{info?.latest || "—"}</b></div>
        </div>

        {info?.notes ? <p className="dsk-upd__notes">{info.notes}</p> : null}
        {err ? <p className="dsk-upd__err">{err}</p> : null}

        <div className="dsk-upd__foot">
          {info?.available ? (
            <button className="btn btn-primary btn-sm" disabled={state === "installing"} onClick={() => void install()}>
              {state === "installing" ? "O'rnatilmoqda…" : "O'rnatish"}
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" disabled={state === "checking"} onClick={() => void check()}>
              {state === "checking" ? "Tekshirilmoqda…" : "Qayta tekshirish"}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Yopish</button>
        </div>

        {info?.available ? (
          <p className="dsk-upd__hint">O&apos;rnatilgach dastur o&apos;zi qayta ishga tushadi.</p>
        ) : null}
      </div>
    </div>
  );
}

function UpgradeNotice({ section, planName, go }: { section: string; planName?: string; go: (v: string) => void }) {
  const label = TITLES[section] || "Bu bo'lim";
  return (
    <div className="kv-upg">
      <div className="kv-upg__ic"><Ic d={I.lock} s={26} /></div>
      <h3>{label} — yuqoriroq tarifda</h3>
      <p>Bu bo&apos;lim joriy tarifingizda{planName ? ` (${planName})` : ""} mavjud emas. Ochish uchun tarifni yuqoriga ko&apos;taring.</p>
      <div className="kv-upg__tiers">
        <div><b>Pro</b><span>Instagram va Telegram · Hisobotlar · Broadcast · Takliflar</span></div>
        <div><b>Premium</b><span>Jamoa va rollar · AI yordamchi</span></div>
      </div>
      <p className="kv-upg__hint">Tarifni yangilash uchun administrator bilan bog&apos;laning.</p>
      <button className="btn btn-primary" onClick={() => go("settings")}>Sozlamalarga o&apos;tish</button>
    </div>
  );
}

/* Chiqib bo'lgan holda /agency'ga kelsa — guest ekranни ko'rsatmay, /signin'ga.
   replace: /agency tarixда qolmaydi, "orqaga"да bu yerga qaytib qolinmaydi. */
function RedirectToSignin() {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/signin");
  }, []);
  return <div className="kv"><div className="kv-center"><svg className="kv-spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg><p>Yo‘naltirilmoqda…</p></div></div>;
}

/* ========= Bir martalik parol — birinchi kirishда majburiy almashtirish ========= */
function ChangePasswordGate({ email, onDone, logout }: { email: string; onDone: () => void; logout: () => Promise<void> | void }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw1.length < 6) { setErr("Parol kamida 6 belgi bo'lsin."); return; }
    if (pw1 !== pw2) { setErr("Parollar mos kelmadi."); return; }
    setBusy(true); setErr("");
    const r = await agencyApi("/auth/change-password", { method: "POST", body: JSON.stringify({ newPassword: pw1 }) });
    setBusy(false);
    if (r.success) { setOk(true); setTimeout(() => onDone(), 900); }
    else setErr(r.message || "Parolni o'zgartirib bo'lmadi.");
  }

  return (
    <div className="kv">
      <div className="kv-center">
       <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div className="mark" style={{ marginBottom: 6 }}><Ic d={I.lock} s={26} /></div>
        <h2>Yangi parol o‘rnating</h2>
        <p style={{ marginBottom: 4 }}>
          <b>{email}</b> uchun vaqtinchalik parol berilgan. Davom etish uchun o‘zingizning maxfiy parolingizni yarating.
        </p>
        {ok ? (
          <div className="note" style={{ color: "#1E9E63", marginTop: 8 }}>Parol o‘rnatildi — kabinet ochilmoqda…</div>
        ) : (
          <form onSubmit={submit} style={{ width: "100%", marginTop: 12, textAlign: "left" }}>
            <div className="fld">
              <label>Yangi parol</label>
              <input type={show ? "text" : "password"} value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="kamida 6 belgi" autoFocus />
            </div>
            <div className="fld">
              <label>Parolni takrorlang</label>
              <input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="yana bir marta" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#8aa398", cursor: "pointer", margin: "2px 0 12px" }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Parolni ko‘rsatish
            </label>
            {err ? <div className="note note-err" style={{ marginBottom: 10 }}>{err}</div> : null}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>
              {busy ? "Saqlanmoqda…" : "Parolni saqlash va kirish"}
            </button>
          </form>
        )}
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => void logout()}>Chiqish</button>
       </div>
      </div>
    </div>
  );
}

export default function KvCabinet() {
  const { phase, me, tours, bookings, bookingStats, logout, refresh, refreshBookings, refreshTours } = useAgencySession();
  const { agencyId, leads, archivedLeads, tasks, customers, members, move, busyId, reloadCrm, createTask, toggleTask, deleteTask } = useCrm();
  const [view, setView] = useState("dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [dragId, setDragId] = useState("");
  const [over, setOver] = useState<CrmStage | "">("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isFs, setIsFs] = useState(false);

  // Tema: saqlangan tanlov -> tizim sozlamasi -> yorug'. <html data-theme> ga qo'yiladi.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("travelorai_theme");
    if (saved === "dark" || saved === "light") setTheme(saved);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    try { window.localStorage.setItem("travelorai_theme", theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => () => { if (typeof document !== "undefined") document.documentElement.removeAttribute("data-theme"); }, []);

  // To'liq ekran (fullscreen) — bitta tugma bilan almashadi. Brauzerда ham,
  // desktop app'да ham HTML Fullscreen API orqali ishlaydi.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    const id = "kv-fonts";
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  // Dinamik takliflar (Pro+) — ochilish statistikasi kanban kartalarida ham ko'rinadi.
  const [presentations, setPresentations] = useState<any[]>([]);
  async function reloadPresentations() {
    const r = await agencyApi<{ items: any[] }>("/presentations");
    if (r.success) setPresentations(r.data.items || []);
  }
  const canPresent = me?.access?.caps?.presentations !== false;
  useEffect(() => {
    if (!me?.agency || !canPresent) return;
    void reloadPresentations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.agency?.id, canPresent]);

  // Jonli yangilanish — mijoz taklifni ochsa CRM o'zi biladi, F5 bosish shart emas.
  // Tab ko'rinmayotgan bo'lsa so'rov yubormaymiz (behuda trafik bo'lmasin).
  const presRef = useRef<any[]>([]);
  useEffect(() => { presRef.current = presentations; }, [presentations]);
  useEffect(() => {
    const agId = me?.agency?.id;
    if (!agId || !canPresent) return;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const r = await agencyApi<{ items: any[] }>("/presentations");
      if (!r.success) return;
      const next = r.data.items || [];
      const before = presRef.current;
      if (before.length) {
        const byId = new Map(before.map((x: any) => [x.id, x]));
        for (const n of next) {
          const o: any = byId.get(n.id);
          if (!o) continue;
          const who = `${n.customerName || "Mijoz"} · ${n.title}`;
          if (n.status === "interested" && o.status !== "interested") {
            pushNotif(agId, { kind: "stage", title: "Mijoz qiziqish bildirdi", sub: who });
            browserNotify("Mijoz qiziqish bildirdi", who);
          } else if ((n.openCount || 0) > (o.openCount || 0)) {
            pushNotif(agId, { kind: "stage", title: "Taklif ko'rildi", sub: who });
            browserNotify("Taklif ko'rildi", who);
          }
        }
      }
      presRef.current = next;
      setPresentations(next);
    };
    const id = setInterval(tick, 25000);
    return () => clearInterval(id);
  }, [me?.agency?.id, canPresent]);

  if (phase === "loading") {
    return <div className="kv"><div className="kv-center"><svg className="kv-spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg><p>Yuklanmoqda…</p></div></div>;
  }
  if (phase === "guest") {
    return <RedirectToSignin />;
  }
  if (phase === "onboarding") {
    return <div className="kv"><div className="kv-center"><h2>Hisobingiz ko'rib chiqilmoqda</h2><p>Agentligingiz tasdiqlangach, CRM kabineti ochiladi.</p><button className="btn btn-ghost" onClick={() => void logout()}>Chiqish</button></div></div>;
  }
  // Bir martalik parol — o'z parolini o'rnatmaguncha kabinet ochilmaydi.
  if (me?.account?.mustChangePassword) {
    return <ChangePasswordGate email={me.account.email} onDone={() => void refresh(true)} logout={logout} />;
  }

  const agency = me?.agency;
  const openLeads = leads.filter((l) => OPEN.includes(l.stage)).length;
  const overdueCount = tasks.filter((t: any) => isOverdue(t)).length;

  // Lid → eng "kuchli" taklif holati (qiziqdi > ko'rildi > yuborildi) — kanban kartasi uchun.
  const presRank = (p: any) => (p.status === "interested" ? 3 : p.status === "viewed" ? 2 : 1);
  const presByLead: Record<string, any> = {};
  for (const p of presentations) {
    if (!p.bookingId) continue;
    const cur = presByLead[p.bookingId];
    if (!cur || presRank(p) > presRank(cur)) presByLead[p.bookingId] = p;
  }

  // ── Obuna / tarif enforcement ──
  const access = me?.access;
  const readOnly = !!access?.readOnly;
  const caps = access?.caps || {};
  const canExport = caps.csvExport !== false;
  const allowedSections = access?.sections || null; // null = cheklovsiz (grandfather / eski agentlik)
  const sectionAllowed = (key: string) => {
    // DIQQAT: «settings» DOIM ochiq bo'lishi SHART — obuna to'lovi endi
    // Sozlamalar ichida, ya'ni muddat tugaganda ham agentlik to'lay olishi
    // kerak (aks holda kabinetda qamalib qoladi va tiklay olmaydi).
    if (key === "dashboard" || key === "settings" || key === "reviews" || key === "documents" || key === "audit") return true; // doim ochiq
    // «instagram» ham shu yerda: u NAV kaliti emas, shuning uchun quyidagi
    // sections tekshiruviga tushib qolsa Premium agentlik ham paywall ko'rardi.
    // Daraja backend bilan bir xil: /agency/instagram → requireCapability('telegram').
    if (key === "telegram" || key === "instagram" || key === "whatsapp") return caps.telegram !== false;
    if (key === "csv-import") return caps.manualLeads !== false;
    if (key === "insights" || key === "automation") return caps.analytics !== false;
    if (key === "api-webhooks") return caps.integrations !== false;
    if (key === "presentations") return caps.presentations !== false;
    if (!allowedSections) return true;
    return allowedSections.includes(key);
  };
  // Muddat o'tган bo'lsa pipeline ko'chirishni bloklaymiz (backend ham 402 qaytaradi)
  const guardedMove = (readOnly ? ((async () => {}) as typeof move) : move);
  const curAllowed = sectionAllowed(view);

  return (
    <div className="kv">
      <h2 className="sr-only">TravelorAI agentlik CRM — lidlar, mijozlar, bronlar, to&apos;lovlar va hisobotlar.</h2>
      <div className="app">
        {/* ===== sidebar ===== */}
        <aside className="sidebar">
          <div className="brand">
            {agency?.imageUrl
              ? <div className="mark logo"><img src={agency.imageUrl} alt="" /></div>
              : <div className="mark"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round"><path d="M4 17c3-7 6-7 8-7s5 0 8-7" strokeDasharray="1.5 3" /><circle cx="4" cy="17" r="2" fill="#EAB308" stroke="none" /><circle cx="20" cy="10" r="2" fill="#EAB308" stroke="none" /></svg></div>}
            <div><b>{agency?.name || "TravelorAI"}</b><small>Sayohat CRM</small></div>
          </div>
          {["Asosiy", "Sotuv", "Boshqa"].map((g) => (
            <div className="nav-group" key={g}>
              <div className="lbl">{g}</div>
              {NAV.filter((n) => n.group === g).map((n) => {
                const locked = !sectionAllowed(n.key);
                return (
                  <button key={n.key} className={`nav-item${view === n.key ? " active" : ""}${locked ? " locked" : ""}`} onClick={() => setView(n.key)} title={locked ? "Yuqoriroq tarifda ochiladi" : undefined}>
                    <Ic d={n.icon} />{n.label}
                    {locked ? <span className="nav-lock"><Ic d={I.lock} s={13} /></span>
                      : (n.badge === "leads" && openLeads > 0 ? <span className="badge">{openLeads}</span>
                        : n.badge === "tasks" && overdueCount > 0 ? <span className="badge" style={{ background: "#F43F5E", color: "#fff" }}>{overdueCount}</span>
                        : null)}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="side-foot">
            <div className="av">{initials(agency?.name || me?.account.email || "AG")}</div>
            <div><b>{agency?.name || "Agentlik"}</b><small>{agency?.city || "Menejer"}</small></div>
            <button className="logout" title="Chiqish" onClick={() => void logout()}><Ic d={I.out} s={17} /></button>
          </div>
        </aside>

        {/* ===== main ===== */}
        <div className="main">
          <header className="topbar">
            <h1>{TITLES[view]}</h1>
            <div className="top-actions">
              <button className="icon-btn" onClick={toggleFullscreen} title={isFs ? "Oddiy ko'rinish" : "To'liq ekran"} aria-label="To'liq ekran">
                <Ic d={isFs ? I.compress : I.expand} s={18} />
              </button>
              <button className="icon-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} title={theme === "dark" ? "Yorug' rejim" : "Tungi rejim"} aria-label="Rejimni almashtirish">
                <Ic d={theme === "dark" ? I.sun : I.moon} s={18} />
              </button>
              <DesktopUpdate />
              <NotificationBell agencyId={agencyId} leads={leads} go={setView} />
              <button className="btn btn-primary" onClick={() => setShowAdd(true)} disabled={readOnly} title={readOnly ? "Obuna tugagan — faqat o'qish rejimi" : undefined}><Ic d={I.plus} s={16} /> Yangi lid</button>
            </div>
          </header>

          <div className="content">
            {readOnly ? (
              <div className="kv-lockbar">
                <span className="kv-lockbar__ic"><Ic d={I.clock} s={18} /></span>
                <div className="kv-lockbar__tx">
                  <b>Obuna muddati tugagan — faqat o&apos;qish rejimi.</b>
                  <span>Ma&apos;lumotlaringiz saqlanib turibdi. Yangi tur qo&apos;shish, lidlarni boshqarish va Telegram uchun to&apos;lovni yangilang.</span>
                </div>
                <button className="btn btn-primary" onClick={() => setView("settings")}>Batafsil</button>
              </div>
            ) : null}
            {!curAllowed ? (
              <UpgradeNotice section={view} planName={access?.planName} go={setView} />
            ) : (
              <>
                <Dashboard show={view === "dashboard"} leads={leads} tasks={tasks} stats={bookingStats} agencyId={agencyId} go={setView} />
                <Leads show={view === "leads"} leads={leads} archivedLeads={archivedLeads} move={guardedMove} busyId={busyId} dragId={dragId} setDragId={setDragId} over={over} setOver={setOver} readOnly={readOnly} canExport={canExport} presByLead={presByLead} refresh={refreshBookings} reloadCrm={reloadCrm} members={members} />
                <Customers show={view === "customers"} customers={customers} canExport={canExport} readOnly={readOnly} refresh={refreshBookings} />
                <Tasks show={view === "tasks"} tasks={tasks} leads={leads} members={members} readOnly={readOnly} createTask={createTask} toggleTask={toggleTask} deleteTask={deleteTask} />
                <Packages show={view === "packages"} tours={tours} agencyId={agencyId} refreshTours={refreshTours} readOnly={readOnly} />
                <Presentations show={view === "presentations"} items={presentations} leads={leads} tours={tours} reload={reloadPresentations} readOnly={readOnly} />
                <Reviews show={view === "reviews"} readOnly={readOnly} />
                <Payments show={view === "payments"} leads={leads} move={guardedMove} busyId={busyId} readOnly={readOnly} canExport={canExport} />
                <Reports show={view === "reports"} leads={leads} />
                <InsightsPage show={view === "insights"} readOnly={readOnly} />
                <AutomationPage show={view === "automation"} readOnly={readOnly} />
                <IntegrationPage show={view === "api-webhooks"} readOnly={readOnly} />
                <CsvImportPage show={view === "csv-import"} readOnly={readOnly} onImported={refreshBookings} />
                <AuditPage show={view === "audit"} />
                <DocumentsSection show={view === "documents"} agencyId={agencyId} leads={leads} readOnly={readOnly} />
                <Settings show={view === "settings"} agency={agency} agencyId={agencyId} refresh={refresh} logout={logout} go={setView} access={access} readOnly={readOnly} caps={caps} />
                <TelegramPage show={view === "telegram"} leads={leads} go={setView} readOnly={readOnly} />
                <InstagramPage show={view === "instagram"} go={setView} readOnly={readOnly} />
                <WhatsAppPage show={view === "whatsapp"} readOnly={readOnly} />
              </>
            )}
          </div>
        </div>
      </div>

      {showAdd ? <AddLead agencyId={agencyId} onClose={() => setShowAdd(false)} onCreated={refreshBookings} /> : null}
    </div>
  );
}

/* ================= DASHBOARD ================= */
function Dashboard({ show, leads, stats, go }: any) {
  const m = useMemo(() => {
    const c = (s: CrmStage) => leads.filter((l: CrmLead) => l.stage === s).length;
    const counts = { new: c("new"), contacted: c("contacted"), quoted: c("quoted"), won: c("won"), completed: c("completed") };
    const maxF = Math.max(1, ...Object.values(counts));
    const open = counts.new + counts.contacted + counts.quoted;
    const won = counts.won + counts.completed;
    const revenue = leads.filter((l: CrmLead) => l.stage === "won" || l.stage === "completed").reduce((a: number, l: CrmLead) => a + (l.totalEstimate || 0), 0);
    const decided = won + leads.filter((l: CrmLead) => l.stage === "lost").length;
    return { counts, maxF, open, won, revenue, conv: decided ? Math.round((won / decided) * 100) : 0 };
  }, [leads]);
  const upcoming = useMemo(() => leads.filter((l: CrmLead) => l.travelDate && new Date(l.travelDate).getTime() > Date.now() && (l.stage === "won" || l.stage === "completed")).slice(0, 4), [leads]);
  const recent = useMemo(() => leads.filter((l: CrmLead) => (l.stage === "won" || l.stage === "completed") && l.totalEstimate).slice(0, 4), [leads]);
  const FUN: { key: CrmStage; label: string }[] = [
    { key: "new", label: "Yangi so'rov" }, { key: "contacted", label: "Bog'lanildi" }, { key: "quoted", label: "Taklif yuborildi" }, { key: "won", label: "Kelishildi" }, { key: "completed", label: "Yakunlandi" },
  ];

  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="grid g4">
        <Kpi icon={I.list} val={m.open} lbl="Ochiq lidlar" />
        <Kpi icon={I.cal} val={m.won} lbl="Kelishilgan bronlar" />
        <Kpi icon={I.money} val={formatMoney(m.revenue)} lbl="Yopilgan aylanma" gold />
        <Kpi icon={I.chart} val={(stats?.conversion ?? m.conv) + "%"} lbl="Konversiya" />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-head" style={{ margin: "16px 20px 4px" }}><div><h2>Sotuv voronkasi</h2></div><button className="link" onClick={() => go("leads")}>Ochish →</button></div>
        <div className="funnel">
          {FUN.map((f) => (
            <div className={`row${f.key === "won" ? " won" : ""}`} key={f.key}>
              <span className="name">{f.label}</span>
              <div className="track"><div className="fill" style={{ width: `${Math.max(8, ((m.counts as any)[f.key] / m.maxF) * 100)}%` }}>{(m.counts as any)[f.key]}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-head" style={{ margin: "16px 18px 2px" }}><div><h2>Yaqinlashayotgan sayohatlar</h2></div><button className="link" onClick={() => go("leads")}>Barchasi →</button></div>
          <div className="mini">
            {upcoming.length ? upcoming.map((l: CrmLead) => (
              <div className="r" key={l.id}><div className="av-sm">{initials(l.customerName)}</div><div><b>{l.customerName}</b><small>{l.tourTitle || "Tur"}</small></div><div className="end"><span className="badge2 b-green">{formatDate(l.travelDate)}</span></div></div>
            )) : <Empty icon={I.cal} text="Yaqin sayohatlar yo'q." />}
          </div>
        </div>
        <div className="card">
          <div className="section-head" style={{ margin: "16px 18px 2px" }}><div><h2>So'nggi kelishuvlar</h2></div><button className="link" onClick={() => go("payments")}>Barchasi →</button></div>
          <div className="mini">
            {recent.length ? recent.map((l: CrmLead) => (
              <div className="r" key={l.id}><div className="av-sm">{initials(l.customerName)}</div><div><b>{l.customerName}</b><small>{l.tourTitle || "Tur"}</small></div><div className="end money">{formatMoney(l.totalEstimate)}</div></div>
            )) : <Empty icon={I.money} text="Hali kelishuv yo'q." />}
          </div>
        </div>
      </div>
    </section>
  );
}
function Kpi({ icon, val, lbl, gold }: any) {
  return <div className={`card kpi${gold ? " gold" : ""}`}><div className="top"><div className="ico"><Ic d={icon} s={19} /></div></div><div className="val">{val}</div><div className="lbl">{lbl}</div></div>;
}
function Empty({ icon, text }: any) {
  return <div className="empty"><Ic d={icon} s={30} /><p>{text}</p></div>;
}

/* ================= CSV EKSPORT ================= */
type CsvCol = { label: string; get: (r: any) => any };
function downloadCsv(filename: string, columns: CsvCol[], rows: any[]) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => esc(c.get(r))).join(","));
  const csv = "﻿" + lines.join("\r\n"); // BOM — Excel'да o'zbek harflari to'g'ri ochilishi uchun
  const stamp = new Date().toISOString().slice(0, 10);
  // saveFile — desktopda «Yuklanmalar»ga yozadi, brauzerda odatdagi yuklab olish.
  // (Ilgari bu yerda to'g'ridan-to'g'ri <a download> edi — desktopda ishlamasdi.)
  void saveFile(`${filename}-${stamp}.csv`, csv, "text/csv;charset=utf-8;")
    .catch((e) => alert(e instanceof Error ? e.message : "Faylni saqlab bo'lmadi"));
}
function ExportBtn({ rows, filename, columns }: { rows: any[]; filename: string; columns: CsvCol[] }) {
  const empty = !rows || rows.length === 0;
  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={empty}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      title={empty ? "Eksport uchun ma'lumot yo'q" : "CSV faylга yuklab olish"}
      onClick={() => downloadCsv(filename, columns, rows)}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
      CSV
    </button>
  );
}
function CsvImportBtn({ disabled, onImported }: { disabled?: boolean; onImported?: () => Promise<void> | void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("CSV fayl 5 MB dan oshmasligi kerak."); return; }
    setBusy(true);
    const csv = await file.text();
    const result = await agencyApi<{ imported: number; warnings?: string[] }>("/crm/import/csv", { method: "POST", body: JSON.stringify({ csv }) });
    setBusy(false);
    if (!result.success) { alert(result.message || "CSV import qilinmadi."); return; }
    await onImported?.();
    alert(`${result.data.imported} ta lid serverga import qilindi${result.data.warnings?.length ? `. ${result.data.warnings.length} ta qator ogohlantirish bilan o'tkazib yuborildi.` : "."}`);
  }
  return (
    <>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => void pick(e)} />
      <button type="button" className="btn btn-ghost btn-sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
        <Ic d={I.plus} s={14} /> {busy ? "Import…" : "CSV import"}
      </button>
    </>
  );
}
const CUST_COLS: CsvCol[] = [
  { label: "Mijoz", get: (c) => c.name },
  { label: "Telefon", get: (c) => c.phone || "" },
  { label: "So'rovlar", get: (c) => (c.leads?.length ?? 0) },
  { label: "Jami qiymat", get: (c) => (c.totalValue ?? 0) },
  { label: "Holat", get: (c) => (c.totalValue >= 1500 ? "VIP" : c.wonCount > 1 ? "Doimiy" : c.wonCount ? "Faol" : "Yangi") },
];
const BOOK_COLS: CsvCol[] = [
  { label: "Mijoz", get: (b) => b.customerName },
  { label: "Telefon", get: (b) => b.customerPhone || "" },
  { label: "Email", get: (b) => b.customerEmail || "" },
  { label: "Yo'nalish", get: (b) => b.tour?.title || b.tour?.city || b.leadTour || "" },
  { label: "Sana", get: (b) => (b.travelDate ? String(b.travelDate).slice(0, 10) : "") },
  { label: "Kishi", get: (b) => (b.travelers ?? "") },
  { label: "Summa", get: (b) => (b.totalEstimate ?? "") },
  { label: "Valyuta", get: (b) => b.currency || "" },
  { label: "Holat", get: (b) => (({ pending: "Kutilmoqda", confirmed: "Tasdiqlangan", completed: "Yakunlangan", rejected: "Rad etilgan", cancelled: "Bekor qilingan" } as Record<string, string>)[b.status] || b.status) },
];
const LEAD_COLS: CsvCol[] = [
  { label: "Mijoz", get: (l) => l.customerName },
  { label: "Telefon", get: (l) => l.customerPhone || "" },
  { label: "Yo'nalish", get: (l) => l.tourTitle || "" },
  { label: "Bosqich", get: (l) => (CRM_STAGES.find((s: any) => s.key === l.stage)?.label || l.stage) },
  { label: "Summa", get: (l) => (l.totalEstimate ?? "") },
  { label: "Manba", get: (l) => srcLabel(l.source) },
  { label: "Sana", get: (l) => (l.createdAt ? String(l.createdAt).slice(0, 10) : "") },
];
const PAY_COLS: CsvCol[] = [
  { label: "Mijoz", get: (l) => l.customerName },
  { label: "Yo'nalish", get: (l) => l.tourTitle || "" },
  { label: "Summa", get: (l) => (l.totalEstimate ?? "") },
  { label: "Manba", get: (l) => srcLabel(l.source) },
  { label: "Holat", get: (l) => (l.stage === "completed" ? "Yakunlandi" : "Kelishildi") },
];

/* ================= LEADS / KANBAN ================= */
const SRC_BADGE: Record<string, string> = {
  marketplace: "b-green", telegram: "b-sky", instagram: "b-rose", whatsapp: "b-green", offline: "b-amber", manual: "b-amber",
};
const srcLabel = (s: string) => LEAD_SOURCE_LABEL[normalizeSource(s)];
/** Donut/legend uchun manba rangi (hisobotда) */
const SRC_COLOR: Record<string, string> = {
  marketplace: "#0F5132", telegram: "#3E86B0", instagram: "#C0392B", whatsapp: "#25A768", offline: "#CA8A04", manual: "#CA8A04",
};

/* Tez aloqa: WhatsApp / Telegram / qo'ng'iroq — mijoz telefoni bo'lsa (chiquvchi havolalar) */
function ContactActions({ lead }: { lead: { customerName: string; customerPhone?: string | null; tourTitle?: string | null; whatsappNumber?: string | null; telegramHandle?: string | null } }) {
  const phone = lead.customerPhone;
  const waNum = lead.whatsappNumber || phone;
  const wa = waNum ? whatsappLink(waNum, greetingTemplate(lead)) : null;
  const tg = telegramLinkSmart(lead.telegramHandle, phone);
  const tel = phone ? `tel:${normalizePhone(phone)}` : null;
  if (!wa && !tg && !tel) return null;
  const stop = (e: any) => e.stopPropagation();
  const base: any = { width: 30, height: 30, borderRadius: 8, display: "inline-grid", placeItems: "center", color: "#fff", textDecoration: "none", flex: "none" };
  // DIQQAT: onClick faqat stopPropagation qilib qo'yilsa, desktop ilovada (Tauri)
  // havola OCHILMAYDI — webview target="_blank" ni bloklaydi. onExternalClick
  // desktopda tizim brauzeri/ilovasiga topshiradi, brauzerda esa oddiy yo'l.
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }} onPointerDown={stop}>
      {wa ? <a href={wa} target="_blank" rel="noreferrer" title="WhatsApp" onClick={onExternalClick(wa)} style={{ ...base, background: "#25D366" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.26-.1-.45-.15-.64.15-.19.28-.73.94-.9 1.13-.16.19-.33.21-.61.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.29-.02-.44.13-.59.13-.13.3-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.38s1.02 2.76 1.17 2.95c.14.19 2.01 3.08 4.88 4.32.68.29 1.21.47 1.63.6.68.22 1.3.19 1.79.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12 2a10 10 0 0 0-8.6 15.06L2 22l5.06-1.33A10 10 0 1 0 12 2z" /></svg></a> : null}
      {tg ? <a href={tg} target="_blank" rel="noreferrer" title="Telegram" onClick={onExternalClick(tg)} style={{ ...base, background: "#229ED9" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.4c-.24 1.06-.87 1.32-1.76.82l-4.87-3.59-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.02-8.15c.39-.35-.09-.55-.6-.2L6.83 13.2l-4.8-1.5c-1.04-.33-1.06-1.04.22-1.54l18.77-7.23c.87-.32 1.63.2 1.35 1.37z" /></svg></a> : null}
      {tel ? <a href={tel} title="Qo'ng'iroq" onClick={onExternalClick(tel)} style={{ ...base, background: "#64748B" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" /></svg></a> : null}
    </div>
  );
}
/**
 * Hujjat oynasi — CRM ichida (iframe).
 *
 * NEGA: ilgari hujjat `window.open()` bilan yangi oynada ochilardi. Desktop
 * ilovada yangi oyna umuman ochilmaydi, brauzerda esa pop-up blokirovkasiga
 * tushardi — «Brauzer yangi oynani bloklamoqda» xatosi shundan edi. Endi
 * hujjat shu yerda chiziladi: chop etish, yuklab olish va yopish — hammasi
 * ilova ichida, hech qanday pop-up talab qilinmaydi.
 */
function DocViewer({ html, filename, title, onClose }: { html: string; filename: string; title: string; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function print() {
    const w = frame.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  }
  const [saved, setSaved] = useState("");
  async function download() {
    // Iframe ichida qo'lda to'ldirilgan maydonlar ham saqlanadi
    const doc = frame.current?.contentDocument;
    const out = doc ? `<!doctype html>${doc.documentElement.outerHTML}` : html;
    try {
      // Desktopda «Yuklanmalar»ga yoziladi va ochiladi; brauzerda oddiy yuklab olish
      const path = await saveFile(filename, out, "text/html;charset=utf-8");
      setSaved(path ? `Saqlandi: ${path}` : "Yuklab olindi");
      setTimeout(() => setSaved(""), 4000);
    } catch (e) {
      setSaved(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      setTimeout(() => setSaved(""), 4000);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card doc-view" onClick={(e) => e.stopPropagation()}>
        <div className="doc-view__head">
          <b>{title}</b>
          <div className="doc-view__acts">
            <button type="button" className="btn btn-primary btn-sm" onClick={print}><Ic d={I.doc} s={14} /> Chop etish / PDF</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void download()}><Ic d={I.download} s={14} /> Yuklab olish</button>
            {saved ? <span className="doc-view__saved" title={saved}>{saved}</span> : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Yopish</button>
          </div>
        </div>
        <iframe ref={frame} className="doc-view__frame" srcDoc={html} title={title} />
      </div>
    </div>
  );
}

/* Hujjat generatsiyasi — lid ma'lumotidan shartnoma/hisob-faktura (print → PDF) */
function DocMenu({ lead }: { lead: CrmLead }) {
  const { me } = useAgencySession();
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<{ html: string; filename: string; title: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!me) return null;
  const agencyId = me.agency?.id || me.account.id || "anon";
  const stop = (e: any) => e.stopPropagation();
  function gen(type: DocType) {
    setOpen(false);
    const { html, filename } = buildDocumentFile({
      type, agencyId, me: me!,
      lead: {
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        customerEmail: lead.customerEmail,
        travelers: lead.travelers,
        travelDate: lead.travelDate,
        tourTitle: lead.tourTitle,
        tourCity: lead.tourCity,
        totalEstimate: lead.totalEstimate,
        currency: lead.currency,
      },
    });
    setDoc({ html, filename, title: `${DOC_LABEL[type]} — ${lead.customerName}` });
  }
  return (
    <div className={`docmenu${open ? " open" : ""}`} ref={ref} onPointerDown={stop}>
      <button type="button" className="doc-btn" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>
        Hujjat
      </button>
      <div className="doc-pop" role="menu">
        {DOC_LIST.map((d) => (
          <button key={d.type} type="button" className="doc-opt" onClick={() => gen(d.type)}>
            <b>{d.label}</b><small>{d.hint}</small>
          </button>
        ))}
      </div>
      {doc ? <DocViewer {...doc} onClose={() => setDoc(null)} /> : null}
    </div>
  );
}
/* Lid hujjatlari (pasport / viza / shartnoma) — DB'да, maxfiy, faqat egasi ko'radi */
type LeadFileMeta = { id: string; name: string; mimeType: string; size: number; ocrStatus?: string; ocrData?: Record<string, unknown>; ocrAt?: string; ocrError?: string; createdAt: string };
function fileSize(n: number) { return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }
function FilesButton({ lead, readOnly }: { lead: CrmLead; readOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="file-btn" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        Hujjatlar
      </button>
      {open ? <FilesModal lead={lead} readOnly={readOnly} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
function FilesModal({ lead, readOnly, onClose }: { lead: CrmLead; readOnly?: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<LeadFileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const load = async () => {
    const res = await agencyApi<{ files: LeadFileMeta[] }>(`/bookings/${lead.id}/files`);
    setLoading(false);
    if (res.success) setFiles(res.data.files);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setErr("");
    if (file.size > 6 * 1024 * 1024) { setErr("Fayl hajmi 6 MB dan oshmasligi kerak."); return; }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) { setErr("Faqat JPG, PNG, WEBP yoki PDF."); return; }
    setBusy(true);
    const dataUrl: string = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve("");
      r.readAsDataURL(file);
    });
    if (!dataUrl) { setBusy(false); setErr("Faylni o'qib bo'lmadi."); return; }
    const res = await agencyApi(`/bookings/${lead.id}/files`, { method: "POST", body: JSON.stringify({ name: file.name, dataUrl }) });
    setBusy(false);
    if (res.success) await load();
    else setErr(res.message || "Yuklab bo'lmadi.");
  }
  async function openFile(f: LeadFileMeta) {
    setErr("");
    const res = await agencyApi<{ file: { dataUrl: string } }>(`/files/${f.id}`);
    if (!res.success) { setErr(res.message || "Ochib bo'lmadi."); return; }
    try {
      const b64 = res.data.file.dataUrl.split(",")[1] || "";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: f.mimeType }));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setErr("Ochib bo'lmadi."); }
  }
  async function del(f: LeadFileMeta) {
    if (typeof window !== "undefined" && !window.confirm(`"${f.name}" o'chirilsinmi?`)) return;
    setBusy(true);
    const res = await agencyApi(`/files/${f.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.success) await load();
  }
  async function ocr(f: LeadFileMeta) {
    setBusy(true); setErr("");
    const res = await agencyApi<{ file: LeadFileMeta }>(`/files/${f.id}/ocr`, { method: "POST" });
    setBusy(false);
    if (res.success) await load(); else setErr(res.message || "Pasportni o'qib bo'lmadi.");
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 70, display: "grid", placeItems: "center", padding: 16 }} onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="card" style={{ width: "min(520px,100%)", padding: 22, maxHeight: "88vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 12px" }}><div><h2>Hujjatlar</h2><div className="sub">{lead.customerName} — pasport, viza, shartnoma (JPG/PNG/PDF, ≤6 MB)</div></div></div>
        {err ? <div className="note" style={{ marginBottom: 12, background: "var(--rose-soft)", color: "#8f2a20", borderColor: "#f3c9c4" }}>{err}</div> : null}
        {!readOnly ? (
          <div style={{ marginBottom: 14 }}>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: "none" }} onChange={onPick} />
            <button className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Yuklanmoqda…" : "+ Fayl yuklash"}</button>
          </div>
        ) : null}
        {loading ? (
          <div style={{ color: "var(--t2)", fontSize: 13 }}>Yuklanmoqda…</div>
        ) : files.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f) => (
              <Fragment key={f.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span style={{ fontSize: 18, flex: "none" }}>{f.mimeType === "application/pdf" ? "📄" : "🖼"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{fileSize(f.size)} · {formatDate(f.createdAt)}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => void openFile(f)}>Ochish</button>
                {!readOnly && f.mimeType.startsWith("image/") ? <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void ocr(f)}>{f.ocrStatus === "done" ? "Qayta OCR" : "Pasport OCR"}</button> : null}
                {!readOnly ? <button className="btn btn-ghost btn-sm" style={{ color: "#c0392b" }} disabled={busy} onClick={() => void del(f)}>O&apos;chirish</button> : null}
              </div>
              {f.ocrStatus === "done" && f.ocrData ? <div className="note" style={{ margin: "0 0 4px", fontSize: 12 }}><b>{String(f.ocrData.surname || "")} {String(f.ocrData.givenNames || "")}</b> · Pasport: {String(f.ocrData.passportNumber || "—")} · Tug&apos;ilgan sana: {String(f.ocrData.birthDate || "—")} · Amal qiladi: {String(f.ocrData.expiryDate || "—")}</div> : null}
              </Fragment>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--t3)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Hali hujjat biriktirilmagan.</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
  );
}
function StageSelect({ value, onChange, disabled }: { value: CrmStage; onChange: (s: CrmStage) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const current = CRM_STAGES.find((s) => s.key === value);
  return (
    <div className={`kstage2${open ? " open" : ""}`} ref={ref} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="kstage2-btn" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`kdot s-${value}`} />
        <span className="kstage2-lbl">{current?.label}</span>
        <svg className="kstage2-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className="kstage2-menu" role="listbox">
        {CRM_STAGES.map((s) => (
          <button type="button" key={s.key} role="option" aria-selected={s.key === value} className={`kstage2-opt${s.key === value ? " sel" : ""}`} onClick={() => { onChange(s.key as CrmStage); setOpen(false); }}>
            <span className={`kdot s-${s.key}`} />
            <span className="kstage2-optl">{s.label}</span>
            {s.key === value ? <svg className="kcheck" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Leads({ show, leads, archivedLeads, move, busyId, dragId, setDragId, over, setOver, readOnly, canExport, presByLead, refresh, reloadCrm, members }: any) {
  const [chat, setChat] = useState<CrmLead | null>(null);
  const [detailId, setDetailId] = useState<string>("");
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [q, setQ] = useState("");
  const [fStage, setFStage] = useState("all");
  const [fSource, setFSource] = useState("all");
  // Bosish (batafsil) va surish (drag) ni ajratish: agar kursor siljigan bo'lsa — bu drag, modal ochmaymiz.
  const downPt = useRef<{ x: number; y: number } | null>(null);
  const byStage = useMemo(() => {
    const map: Record<CrmStage, CrmLead[]> = { new: [], contacted: [], quoted: [], won: [], completed: [], lost: [] };
    for (const l of leads) map[(l as CrmLead).stage].push(l);
    return map;
  }, [leads]);
  const arch: CrmLead[] = archivedLeads || [];
  const archFiltered = useMemo(() => {
    let a: CrmLead[] = archivedLeads || [];
    const query = q.trim().toLowerCase();
    if (query) a = a.filter((l: CrmLead) => (l.customerName || "").toLowerCase().includes(query) || (l.customerPhone || "").replace(/\s/g, "").includes(query.replace(/\s/g, "")) || (l.customerEmail || "").toLowerCase().includes(query));
    if (fStage !== "all") a = a.filter((l: CrmLead) => l.stage === fStage);
    // normalizeSource — eski/notanish qiymatlar ham to'g'ri guruhga tushsin
    if (fSource !== "all") a = a.filter((l: CrmLead) => normalizeSource(l.source) === fSource);
    return a;
  }, [archivedLeads, q, fStage, fSource]);
  const dl = leads.find((x: CrmLead) => x.id === detailId) || arch.find((x: CrmLead) => x.id === detailId);
  async function setArchived(l: CrmLead, val: boolean) {
    await agencyApi(`/bookings/${l.id}`, { method: "PATCH", body: JSON.stringify({ archived: val }) });
    await refresh?.();
  }
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head">
        <div><h2>Sotuv voronkasi</h2><div className="sub">{tab === "active" ? `Jami ${leads.length} ta faol lid — kartani suring yoki bosing` : `Arxivda ${arch.length} ta lid`}</div></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="lead-tabs">
            <button className={tab === "active" ? "on" : ""} onClick={() => setTab("active")}>Faol</button>
            <button className={tab === "archive" ? "on" : ""} onClick={() => setTab("archive")}>Arxiv{arch.length ? ` (${arch.length})` : ""}</button>
          </div>
          <CsvImportBtn disabled={readOnly} onImported={async () => { await refresh?.(); await reloadCrm?.(); }} />
          {canExport ? <ExportBtn rows={tab === "active" ? leads : arch} filename={tab === "active" ? "lidlar" : "arxiv"} columns={LEAD_COLS} /> : null}
        </div>
      </div>
      {tab === "active" ? (
        <div className="kanban">
          {CRM_STAGES.map((s, i) => (
            <div key={s.key} className={`kcol c${i}${over === s.key ? " over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
              onDragLeave={() => setOver((c: string) => (c === s.key ? "" : c))}
              onDrop={() => { const l = leads.find((x: CrmLead) => x.id === dragId); setOver(""); setDragId(""); if (l) void move(l, s.key); }}>
              <div className="khead"><span className="acc" /><b>{s.label}</b><span className="n">{byStage[s.key as CrmStage].length}</span></div>
              {byStage[s.key as CrmStage].map((l) => (
                <article key={l.id} className="kcard kcard-min" draggable={!readOnly}
                  onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId("")}
                  onMouseDown={(e) => { downPt.current = { x: e.clientX, y: e.clientY }; }}
                  onClick={(e) => { const p = downPt.current; downPt.current = null; if (p && (Math.abs(e.clientX - p.x) > 6 || Math.abs(e.clientY - p.y) > 6)) return; setDetailId(l.id); }}
                  title="Suring — bosqichga o'tkazish · bosing — batafsil"
                  style={busyId === l.id ? { opacity: 0.5 } : undefined}>
                  <b>{l.customerName}</b>
                  <div className="foot">
                    <span className={`badge2 ${SRC_BADGE[l.source] || "b-grey"}`}>{srcLabel(l.source)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {presByLead?.[l.id]?.status === "interested" ? <span title="Taklifga qiziqish bildirdi" style={{ color: "#EAB308", fontSize: 11, lineHeight: 1 }}>●</span> : null}
                      <small>{timeAgo(l.createdAt)}</small>
                    </div>
                  </div>
                </article>
              ))}
              {byStage[s.key as CrmStage].length === 0 ? <div style={{ textAlign: "center", color: "#aab6b0", fontSize: 12, padding: "10px 0" }}>Bo&apos;sh</div> : null}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="arch-tools">
            <div className="arch-search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mijoz ismi, telefon yoki email..." />
              {q ? <button className="arch-clear" onClick={() => setQ("")} aria-label="Tozalash">×</button> : null}
            </div>
            <select className="arch-sel" value={fStage} onChange={(e) => setFStage(e.target.value)}>
              <option value="all">Barcha bosqich</option>
              {CRM_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className="arch-sel" value={fSource} onChange={(e) => setFSource(e.target.value)}>
              <option value="all">Barcha manba</option>
              {/* YAGONA manba: lib/agency/crm LEAD_SOURCES — lid qo'shish formasi,
                  hisobot diagrammasi va bu filtr bir xil ro'yxatdan foydalanadi.
                  Ilgari bu yerda faqat 3 tasi qo'lda yozilgan edi, shuning uchun
                  Instagram/WhatsApp/Offline lidlarini filtrlab bo'lmasdi. */}
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="card tbl-wrap">
            {archFiltered.length ? (
              <table>
                <thead><tr><th>Mijoz</th><th>Telefon</th><th>Yo&apos;nalish</th><th>Bosqich</th><th>Manba</th><th>Qo&apos;shilgan</th><th className="r">Amal</th></tr></thead>
                <tbody>
                  {archFiltered.map((l) => (
                    <tr key={l.id} style={{ cursor: "pointer" }} onClick={() => setDetailId(l.id)}>
                      <td><div className="cell"><span className="av-sm">{initials(l.customerName)}</span><b>{l.customerName}</b></div></td>
                      <td>{l.customerPhone || "—"}</td>
                      <td>{l.tourTitle || "—"}</td>
                      <td><span className={`badge2 ${l.stage === "completed" ? "b-green" : l.stage === "lost" ? "b-rose" : "b-grey"}`}>{STAGE_LABEL[l.stage]}</span></td>
                      <td><span className="badge2 b-grey">{srcLabel(l.source)}</span></td>
                      <td>{timeAgo(l.createdAt)}</td>
                      <td className="r" onClick={(e) => e.stopPropagation()}>
                        {!readOnly ? <button className="btn btn-ghost btn-sm" disabled={busyId === l.id} onClick={() => void setArchived(l, false)}>Tiklash</button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <Empty icon={I.box} text={arch.length ? "Filtrga mos lid topilmadi — qidiruv yoki filtrni o'zgartiring." : "Arxiv bo'sh. Yakunlangan yoki yo'qotilgan lidlar 30 kundan keyin avtomatik shu yerga o'tadi — yoki batafsil oynadan qo'lda arxivlang."} />}
          </div>
        </>
      )}
      {dl ? (
        <LeadDetail lead={dl} readOnly={readOnly} busyId={busyId} pres={presByLead?.[dl.id]} members={members}
          onMove={move} onClose={() => setDetailId("")} refresh={refresh}
          reloadCrm={reloadCrm}
          onArchive={(val: boolean) => setArchived(dl, val)}
          onOpenChat={(l: CrmLead) => { setDetailId(""); setChat(l); }} />
      ) : null}
      {chat ? <TelegramChat lead={chat} onClose={() => setChat(null)} onBack={() => { setDetailId(chat.id); setChat(null); }} readOnly={readOnly} /> : null}
    </section>
  );
}

/* Lid batafsil oynasi — kartaga bosilганда ochiladi; ko'rish + tahrirlash */
function LeadDetail({ lead, readOnly, busyId, pres, members, onMove, onClose, onOpenChat, refresh, reloadCrm, onArchive }: {
  lead: CrmLead; readOnly?: boolean; busyId?: string; pres?: any;
  members?: any[];
  onMove: (l: CrmLead, s: CrmStage) => void; onClose: () => void; onOpenChat: (l: CrmLead) => void; refresh?: () => Promise<void>;
  reloadCrm?: () => Promise<void>;
  onArchive?: (val: boolean) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (editing) setEditing(false); else onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, editing]);
  function startEdit() {
    setForm({
      customerName: lead.customerName || "",
      customerPhone: lead.customerPhone || "",
      customerEmail: lead.customerEmail || "",
      leadTelegram: lead.telegramHandle || "",
      leadWhatsapp: lead.whatsappNumber || "",
      leadTour: lead.tourTitle || "",
      leadCity: lead.tourCity || "",
      travelers: String(lead.travelers || 1),
      travelDate: lead.travelDate ? String(lead.travelDate).slice(0, 10) : "",
      totalEstimate: lead.totalEstimate ? String(lead.totalEstimate) : "",
      customerBirthday: lead.customerBirthday ? String(lead.customerBirthday).slice(0, 10) : "",
      source: normalizeSource(lead.source),
    });
    setErr(""); setEditing(true);
  }
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    if (!(form.customerName || "").trim()) { setErr("Mijoz ismini kiriting."); return; }
    setBusy(true); setErr("");
    const res = await agencyApi(`/bookings/${lead.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        customerName: form.customerName.trim(),
        customerPhone: (form.customerPhone || "").trim(),
        customerEmail: (form.customerEmail || "").trim(),
        leadTelegram: (form.leadTelegram || "").trim(),
        leadWhatsapp: (form.leadWhatsapp || "").trim(),
        leadTour: (form.leadTour || "").trim(),
        leadCity: (form.leadCity || "").trim(),
        travelers: form.travelers,
        travelDate: form.travelDate || null,
        totalEstimate: form.totalEstimate === "" ? null : form.totalEstimate,
        customerBirthday: form.customerBirthday || null,
        source: form.source || undefined,
      }),
    });
    setBusy(false);
    if (res.success) { await refresh?.(); setEditing(false); }
    else setErr(res.message || "Saqlab bo'lmadi.");
  }
  const fields: [string, React.ReactNode][] = [
    ["Menejer", lead.assignedMemberName || "Biriktirilmagan"],
    ["Telefon", lead.customerPhone || "—"],
    ["Email", lead.customerEmail || "—"],
    ["Telegram", lead.telegramHandle || "—"],
    ["WhatsApp", lead.whatsappNumber || "—"],
    ["Yo'nalish / Tur", lead.tourTitle || "—"],
    ["Shahar", lead.tourCity || "—"],
    ["Kishilar soni", lead.travelers || "—"],
    ["Sayohat sanasi", lead.travelDate ? formatDate(lead.travelDate) : "—"],
    ["Taxminiy summa", lead.totalEstimate ? formatMoney(lead.totalEstimate) : "—"],
    ...(BIRTHDAY_LIVE
      ? ([["Tug'ilgan kun", lead.customerBirthday ? formatDate(lead.customerBirthday) : "—"]] as [string, React.ReactNode][])
      : []),
    // Qayerdan keldi — o'qish ko'rinishida ham ko'rinsin (o'zgartirish ✏️ ostida)
    ["Qayerdan keldi", <span className={`badge2 ${SRC_BADGE[normalizeSource(lead.source)] || "b-grey"}`}>{srcLabel(lead.source)}</span>],
  ];
  if (lead.utmSource) fields.push(["Manba (UTM)", lead.utmSource]);
  async function assign(memberId: string) {
    setBusy(true);
    const result = await agencyApi(`/crm/bookings/${lead.id}/assignee`, { method: "PATCH", body: JSON.stringify({ memberId: memberId || null }) });
    if (result.success) { await refresh?.(); await reloadCrm?.(); } else setErr(result.message);
    setBusy(false);
  }
  async function addTag() {
    const value = tagInput.trim(); if (!value || readOnly) return;
    const tags = Array.from(new Set([...(lead.tags || []), value]));
    const result = await agencyApi(`/crm/bookings/${lead.id}/tags`, { method: "PUT", body: JSON.stringify({ tags }) });
    if (result.success) { setTagInput(""); await reloadCrm?.(); } else setErr(result.message);
  }
  async function removeTag(name: string) {
    const result = await agencyApi(`/crm/bookings/${lead.id}/tags`, { method: "PUT", body: JSON.stringify({ tags: (lead.tags || []).filter((tag) => tag !== name) }) });
    if (result.success) await reloadCrm?.(); else setErr(result.message);
  }
  async function addNote() {
    const text = noteInput.trim(); if (!text || readOnly) return;
    const result = await agencyApi(`/crm/bookings/${lead.id}/activities`, { method: "POST", body: JSON.stringify({ type: "note", text }) });
    if (result.success) { setNoteInput(""); await reloadCrm?.(); } else setErr(result.message);
  }
  const inp = (k: string, label: string, o?: { type?: string; ph?: string; full?: boolean }) => (
    <div className="fld" style={{ marginBottom: 0, ...(o?.full ? { gridColumn: "1 / -1" } : {}) }}>
      <label>{label}</label>
      <input type={o?.type || "text"} value={form[k] || ""} placeholder={o?.ph}
        max={o?.type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
        onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  return (
    <div className="ld-overlay" onPointerDown={(e) => e.stopPropagation()} onClick={() => { if (!editing) onClose(); }}>
      <div className="ld-panel card" onClick={(e) => e.stopPropagation()}>
        {!readOnly && !editing ? (
          <button className="ld-x" style={{ right: 54 }} onClick={startEdit} title="Tahrirlash" aria-label="Tahrirlash"><Ic d={I.edit} s={16} /></button>
        ) : null}
        <button className="ld-x" onClick={onClose} aria-label="Yopish"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        <div className="ld-head">
          <span className="ld-av">{initials(lead.customerName)}</span>
          <div className="ld-headmeta">
            <h2>{lead.customerName}</h2>
            <div className="ld-sub"><span className={`badge2 ${SRC_BADGE[lead.source] || "b-grey"}`}>{srcLabel(lead.source)}</span><small>{timeAgo(lead.createdAt)}</small></div>
          </div>
        </div>
        <div className="ld-stagebar">
          <span className="ld-k">Bosqich</span>
          <StageSelect value={lead.stage} onChange={(s) => onMove(lead, s)} disabled={readOnly || busyId === lead.id || editing} />
        </div>
        {!editing ? (
          <div className="ld-stagebar">
            <span className="ld-k">Mas&apos;ul menejer</span>
            <select value={lead.assignedMemberId || ""} disabled={readOnly || busy} onChange={(e) => void assign(e.target.value)} style={{ marginLeft: "auto", minWidth: 190 }}>
              <option value="">Biriktirilmagan</option>
              {(members || []).map((m: any) => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
          </div>
        ) : null}
        {editing ? (
          <>
            {err ? <div className="note" style={{ marginBottom: 12, background: "var(--rose-soft)", color: "#8f2a20", borderColor: "#f3c9c4" }}>{err}</div> : null}
            <div className="ld-grid" style={{ borderTop: "1px solid var(--border)", paddingTop: 15 }}>
              {inp("customerName", "Mijoz ismi", { full: true })}
              {inp("customerPhone", "Telefon", { ph: "+998..." })}
              {inp("customerEmail", "Email", { type: "email", ph: "email@..." })}
              {inp("leadTelegram", "Telegram", { ph: "@username yoki link" })}
              {inp("leadWhatsapp", "WhatsApp", { ph: "+998..." })}
              {inp("leadTour", "Yo'nalish / Tur")}
              {inp("leadCity", "Shahar")}
              {inp("travelers", "Kishilar soni", { type: "number" })}
              {inp("travelDate", "Sayohat sanasi", { type: "date" })}
              {inp("totalEstimate", "Taxminiy summa ($)", { ph: "800" })}
              {BIRTHDAY_LIVE ? inp("customerBirthday", "Tug'ilgan kun", { type: "date" }) : null}
              {/* Manba — mijoz qayerdan kelgani. Hisobotdagi doiraviy diagramma shundan yasaladi. */}
              <div className="fld">
                <label>Qayerdan keldi (manba)</label>
                <select value={form.source || "offline"} onChange={(e) => set("source", e.target.value)}>
                  {LEAD_SOURCE_OPTIONS.map((sv) => (
                    <option key={sv} value={sv}>{LEAD_SOURCE_LABEL[sv]}</option>
                  ))}
                  {/* Eski lidlar "Qo'lda" bo'lsa — ro'yxatdan tushib qolmasin */}
                  {form.source === "manual" ? <option value="manual">{LEAD_SOURCE_LABEL.manual}</option> : null}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Bekor</button>
              <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
            </div>
          </>
        ) : (
          <>
            <div className="ld-grid">
              {fields.map(([k, v]) => (
                <div className="ld-field" key={k}><span className="ld-k">{k}</span><span className="ld-v">{v}</span></div>
              ))}
            </div>
            {lead.message ? <div className="ld-note"><span className="ld-k">Mijoz xabari</span><p>{lead.message}</p></div> : null}
            <div className="ld-note">
              <span className="ld-k">Teglar</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {(lead.tags || []).map((tag) => <button key={tag} type="button" className="badge2 b-green" disabled={readOnly} onClick={() => void removeTag(tag)} title="Tegni o‘chirish">{tag}{!readOnly ? " ×" : ""}</button>)}
                {!readOnly ? <><input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Yangi teg" style={{ maxWidth: 140 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTag(); } }} /><button className="btn btn-ghost btn-sm" onClick={() => void addTag()}>Qo&apos;shish</button></> : null}
              </div>
            </div>
            {!readOnly ? (
              <div className="ld-note">
                <span className="ld-k">Faoliyatga izoh qo&apos;shish</span>
                <textarea rows={2} value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Qo‘ng‘iroq natijasi yoki keyingi qadam…" />
                <button className="btn btn-ghost btn-sm" disabled={!noteInput.trim()} onClick={() => void addNote()}>Izohni saqlash</button>
              </div>
            ) : null}
            {pres ? <div style={{ marginTop: 12 }}><PresBadge p={pres} /></div> : null}
            <div className="ld-tools"><ContactActions lead={lead} /></div>
            <div className="ld-tools2">
              <div style={{ flex: 1, minWidth: 130 }}><DocMenu lead={lead} /></div>
              {lead.source === "telegram" || lead.source === "instagram" || lead.source === "whatsapp" ? (
                <button className="tg-chat-btn" style={{ width: "auto", marginTop: 0, padding: "0 14px" }} onClick={() => onOpenChat(lead)}>
                  {lead.source === "instagram" ? (
                    <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>Instagram suhbat</>
                  ) : lead.source === "whatsapp" ? (
                    <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>WhatsApp suhbat</>
                  ) : (
                    <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>Telegram suhbat</>
                  )}
                </button>
              ) : null}
            </div>
            {lead.activities?.length ? (
              <div className="ld-acts">
                <span className="ld-k">Faoliyat tarixi</span>
                {lead.activities.slice(0, 6).map((a) => (
                  <div className="ld-act" key={a.id}><span className="ld-act-dot" /><span className="ld-act-tx">{a.text}</span><small>{timeAgo(a.at)}</small></div>
                ))}
              </div>
            ) : null}
            {!readOnly && onArchive ? (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-ghost btn-sm" onClick={async () => { await onArchive(!lead.archived); onClose(); }}>
                  {lead.archived ? "↩ Arxivdan chiqarish" : "🗄 Arxivlash"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Tug'ilgan kun / avto-tabrik — VAQTINCHA YASHIRILGAN.
 *
 * Sabab: bot faqat o'zi bilan suhbat boshlagan mijozga yozadi (Telegram
 * cheklovi), shuning uchun Telegramда bo'lmagan mijozlarda tabrik yetib
 * bormaydi va jadval ⚠ belgilariga to'lib ketardi.
 *
 * Kod, backend, baza va migratsiyalar JOYIDA — faqat interfeysda ko'rinmaydi.
 * Qayta yoqish uchun shu bayroqni `true` qilish kifoya (boshqa hech narsa
 * o'zgartirilmaydi). Xuddi TEAM_LIVE bayrog'i kabi.
 */
const BIRTHDAY_LIVE: boolean = false;

/* Mijoz tug'ilgan kuni — o'zgartirilganda serverга yoziladi (avto-tabrik uchun) */
function BirthdayCell({ customer, readOnly, onSaved }: any) {
  const [val, setVal] = useState(customer.birthday ? String(customer.birthday).slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  async function save(v: string) {
    setVal(v); setBusy(true); setSaved(false);
    const res = await agencyApi(`/bookings/${customer.birthdayBookingId}/birthday`, { method: "PATCH", body: JSON.stringify({ birthday: v }) });
    setBusy(false);
    if (res.success) { setSaved(true); setTimeout(() => setSaved(false), 1500); await onSaved?.(); }
  }
  if (readOnly) return <span style={{ color: "#8aa398", fontSize: 13 }}>{val ? formatDate(val) : "—"}</span>;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {/* DIQQAT: bu yerda ilgari qattiq rang va colorScheme:"dark" yozilgan edi —
          och rejimda chegara ko'rinmasdi va sana tanlash oynasi qora chiqardi.
          Ranglar mavzu tokenlaridan; color-scheme'ni CSS o'zi hal qiladi. */}
      <input type="date" value={val} max={new Date().toISOString().slice(0, 10)} disabled={busy}
        onChange={(e) => void save(e.target.value)}
        style={{ padding: "5px 8px", border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--t1)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
      {saved ? <span style={{ color: "#1E9E63", fontSize: 13 }}>✓</span> : null}
      {!customer.hasTelegram && val ? (
        <span title="Bu mijoz Telegramда bog'lanmagan — avto-tabrik hozircha faqat Telegram orqali yuboriladi" style={{ color: "#CA8A04", fontSize: 13, cursor: "help" }}>⚠</span>
      ) : null}
    </div>
  );
}

/* ================= CUSTOMERS ================= */
function Customers({ show, customers, canExport, readOnly, refresh }: any) {
  const vip = customers.filter((c: any) => c.totalValue >= 1500).length;
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Mijozlar bazasi</h2><div className="sub">Jami {customers.length} mijoz · {vip} yuqori qiymatli</div></div>{canExport ? <ExportBtn rows={customers} filename="mijozlar" columns={CUST_COLS} /> : null}</div>
      <div className="card tbl-wrap">
        {customers.length ? (
          <table>
            <thead><tr><th>Mijoz</th><th>Telefon</th>{BIRTHDAY_LIVE ? <th>Tug&apos;ilgan kun</th> : null}<th>So&apos;rovlar</th><th className="r">Jami qiymat</th><th>Holat</th><th>Aloqa</th></tr></thead>
            <tbody>
              {customers.map((c: any) => (
                <tr key={c.keyId}>
                  <td><div className="cell"><span className="av-sm">{initials(c.name)}</span><b>{c.name}</b></div></td>
                  <td>{c.phone || "—"}</td>
                  {BIRTHDAY_LIVE ? <td><BirthdayCell customer={c} readOnly={readOnly} onSaved={refresh} /></td> : null}
                  <td>{c.leads.length}</td>
                  <td className="r money">{formatMoney(c.totalValue)}</td>
                  <td><span className={`badge2 ${c.totalValue >= 1500 ? "b-amber" : c.wonCount > 1 ? "b-green" : c.wonCount ? "b-grey" : "b-sky"}`}>{c.totalValue >= 1500 ? "VIP" : c.wonCount > 1 ? "Doimiy" : c.wonCount ? "Faol" : "Yangi"}</span></td>
                  <td><ContactActions lead={{ customerName: c.name, customerPhone: c.phone, tourTitle: c.leads[0]?.tourTitle }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={I.users} text="Hali mijoz yo'q. Birinchi lid kelganda shu yerda paydo bo'ladi." />}
      </div>
    </section>
  );
}

/* ================= VAZIFALAR / ESLATMALAR ================= */
function Tasks({ show, tasks, leads, members, readOnly, createTask, toggleTask, deleteTask }: any) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [leadId, setLeadId] = useState("");
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const openLeadOpts: CrmLead[] = useMemo(() => leads.filter((l: CrmLead) => OPEN.includes(l.stage)), [leads]);

  const g = useMemo(() => {
    const byDue = (a: any, b: any) => new Date(a.dueAt || "2999-01-01").getTime() - new Date(b.dueAt || "2999-01-01").getTime();
    const active = tasks.filter((t: any) => !t.done);
    const pick = (k: string) => active.filter((t: any) => dueInfo(t.dueAt).kind === k).sort(byDue);
    return {
      overdue: pick("overdue"),
      today: pick("today"),
      upcoming: [...pick("soon"), ...pick("far")].sort(byDue),
      noDue: pick("none"),
      done: tasks.filter((t: any) => t.done).sort((a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))),
    };
  }, [tasks]);

  const openTaskLeadIds = useMemo(() => new Set(tasks.filter((t: any) => !t.done && t.leadId).map((t: any) => t.leadId)), [tasks]);
  const untracked = useMemo(() => openLeadOpts.filter((l) => !openTaskLeadIds.has(l.id)), [openLeadOpts, openTaskLeadIds]);
  const activeCount = g.overdue.length + g.today.length + g.upcoming.length + g.noDue.length;
  // DIQQAT: qattiq rang YOZILMAYDI. Ilgari chegara rgba(255,255,255,.15) edi —
  // och rejimda oq kartada ko'rinmasdi, maydonlar chegarasiz turardi. Ranglar
  // mavzu tokenlaridan olinadi, shuning uchun ikki rejimda ham to'g'ri.
  const inp: any = { padding: "10px 12px", border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--t1)", borderRadius: 10, fontSize: 14, minWidth: 0, fontFamily: "inherit", outline: "none" };

  async function submit(e?: any) {
    e?.preventDefault?.();
    const t = title.trim();
    if (!t || readOnly) return;
    const ok = await createTask({ title: t, dueAt: due ? new Date(due).toISOString() : undefined, leadId: leadId || undefined, assignedMemberId: assignedMemberId || undefined });
    if (ok) { setTitle(""); setDue(""); setLeadId(""); setAssignedMemberId(""); }
  }
  async function quickForLead(l: CrmLead) {
    if (readOnly) return;
    await createTask({ title: `${l.customerName} bilan bog'lanish`, leadId: l.id, dueAt: new Date(Date.now() + 86400000).toISOString(), assignedMemberId: l.assignedMemberId || undefined });
  }

  const renderRow = (t: any) => {
    const info = dueInfo(t.dueAt);
    return (
      <div className={`task${t.done ? " done" : ""}`} key={t.id}>
        <button className="box" disabled={readOnly} onClick={() => void toggleTask(t)} aria-label="Bajarildi"><Ic d={I.check} s={13} /></button>
        <span className="tx">{t.title}{t.leadName ? <small style={{ color: "#8aa398", marginLeft: 6 }}>· {t.leadName}</small> : null}{t.assignedMemberName ? <small style={{ color: "#8aa398", marginLeft: 6 }}>· {t.assignedMemberName}</small> : null}</span>
        <span className={`badge2 ${t.done ? "b-grey" : info.cls}`}>{t.done ? "Bajarildi" : info.label}</span>
        {!readOnly ? <button onClick={() => void deleteTask(t.id)} title="O'chirish" aria-label="O'chirish" style={{ background: "transparent", border: "none", color: "inherit", opacity: 0.45, cursor: "pointer", padding: 4, display: "inline-flex" }}><Ic d={I.trash} s={14} /></button> : null}
      </div>
    );
  };
  const renderGroup = (label: string, items: any[], accent?: string) =>
    items.length ? (
      <div className="card" style={{ marginTop: 12 }} key={label}>
        <div className="section-head" style={{ margin: "14px 18px 2px" }}><div><h2 style={accent ? { color: accent } : undefined}>{label}</h2><div className="sub">{items.length} ta</div></div></div>
        <div className="list">{items.map(renderRow)}</div>
      </div>
    ) : null;

  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Vazifalar va eslatmalar</h2><div className="sub">{activeCount} ochiq{g.overdue.length ? ` · ${g.overdue.length} muddati o'tgan` : ""}</div></div></div>

      {!readOnly ? (
        <form className="card" style={{ padding: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} onSubmit={submit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eslatma yoki vazifa…" style={{ ...inp, flex: "2 1 240px" }} />
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={{ ...inp, flex: "1 1 180px" }} />
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={{ ...inp, flex: "1 1 170px" }}>
            <option value="">Lidga bog'lash (ixtiyoriy)</option>
            {openLeadOpts.map((l) => <option key={l.id} value={l.id}>{l.customerName}</option>)}
          </select>
          <select value={assignedMemberId} onChange={(e) => setAssignedMemberId(e.target.value)} style={{ ...inp, flex: "1 1 170px" }}>
            <option value="">Menejer (ixtiyoriy)</option>
            {(members || []).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}><Ic d={I.plus} s={15} /> Qo&apos;shish</button>
        </form>
      ) : null}

      {untracked.length ? (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(234,179,8,.4)" }}>
          <div className="section-head" style={{ margin: "14px 18px 2px" }}><div><h2 style={{ color: "#EAB308" }}>Vazifasiz lidlar</h2><div className="sub">{untracked.length} ta faol lidda eslatma yo&apos;q — unutib qo&apos;ymang</div></div></div>
          <div className="list">
            {untracked.slice(0, 6).map((l) => (
              <div className="task" key={l.id}>
                <span className="av-sm">{initials(l.customerName)}</span>
                <span className="tx">{l.customerName}<small style={{ marginLeft: 6, color: "#8aa398" }}>· {STAGE_LABEL[l.stage as CrmStage]}</small></span>
                {!readOnly ? <button className="btn btn-ghost btn-sm" onClick={() => void quickForLead(l)}><Ic d={I.plus} s={14} /> Eslatma</button> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeCount === 0 && g.done.length === 0 ? <div className="card" style={{ marginTop: 12 }}><Empty icon={I.check} text="Hali vazifa yo'q. Yuqoridagi shakl orqali eslatma qo'shing." /></div> : null}

      {renderGroup("Muddati o'tgan", g.overdue, "#F43F5E")}
      {renderGroup("Bugun", g.today, "#EAB308")}
      {renderGroup("Keyingi kunlar", g.upcoming)}
      {renderGroup("Muddatsiz", g.noDue)}
      {g.done.length ? renderGroup("Bajarilgan", g.done.slice(0, 12)) : null}
    </section>
  );
}

/* ================= PRESENTATIONS (dinamik takliflar) ================= */
const PRES_STATE: Record<string, { label: string; cls: string; icon: string }> = {
  sent: { label: "Yuborildi", cls: "b-grey", icon: I.send },
  viewed: { label: "Ko'rildi", cls: "b-green", icon: I.eye },
  interested: { label: "Qiziqish bildirdi", cls: "b-amber", icon: I.check },
};

function PresBadge({ p }: { p: any }) {
  const s = PRES_STATE[p.status] || PRES_STATE.sent;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
      <span className={`badge2 ${s.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Ic d={s.icon} s={11} /> {s.label}
      </span>
      {p.openCount > 0 ? <small style={{ color: "#8aa398", fontSize: 11 }}>{p.openCount}×</small> : null}
    </div>
  );
}

/* Brauzer bildirishnomasi — ruxsatni foydalanuvchi o'zi bosib beradi */
function NotifyToggle() {
  const [perm, setPerm] = useState<string>("unsupported");
  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);
  if (perm === "unsupported") return null;
  if (perm === "granted") return <span className="badge2 b-green">Bildirishnoma yoqilgan</span>;
  if (perm === "denied") {
    return <span className="badge2 b-grey" title="Brauzer sozlamalaridan sayt uchun ruxsat bering">Bildirishnoma bloklangan</span>;
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => { void Notification.requestPermission().then(setPerm); }}>
      <Ic d={I.bell} s={14} /> Bildirishnomani yoqish
    </button>
  );
}

/* Telegramга xabarnoma — agent o'z botiga kod yuboradi, o'sha chat manzil bo'lib qoladi */
function TelegramAlertSetup() {
  const [d, setD] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void agencyApi<any>("/telegram").then((r) => { if (r.success) setD(r.data); });
  }, []);
  if (!d || !d.connected || !d.notifyCode) return null;

  if (d.notifyEnabled) {
    return (
      <div className="card" style={{ padding: 12, marginBottom: 12, fontSize: 13.5 }}>
        <b style={{ color: "#1E9E63" }}>Telegram xabarnomasi yoqilgan</b>
        <span style={{ color: "#8aa398" }}> — mijoz taklifni ochganda @{d.username} sizga yozadi.</span>
      </div>
    );
  }

  const cmd = `/xabarnoma ${d.notifyCode}`;
  return (
    <div className="card" style={{ padding: 14, marginBottom: 12, borderColor: "rgba(234,179,8,.4)" }}>
      <b style={{ color: "#EAB308" }}>Telefoningizga xabar keladigan qiling</b>
      <p style={{ margin: "6px 0 10px", fontSize: 13.5, color: "#8aa398" }}>
        Telegramda <b>@{d.username}</b> botini oching va shu buyruqni yuboring. Shundan keyin mijoz taklifni ochishi bilan
        botingiz sizga darhol xabar beradi — CRM ochiq bo&apos;lmasa ham.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <code style={{ padding: "9px 12px", background: "var(--canvas)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13.5 }}>{cmd}</code>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { void navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); }}
        >
          <Ic d={I.copy} s={13} /> {copied ? "Nusxalandi" : "Nusxalash"}
        </button>
        <a className="btn btn-ghost btn-sm" href={`https://t.me/${d.username}`} target="_blank" rel="noopener noreferrer" onClick={onExternalClick(`https://t.me/${d.username}`)}>
          Botni ochish
        </a>
      </div>
    </div>
  );
}

/* Taklif narxi kim uchun — erkin matn emas, tanlov. Mijoz sahifasida aynan
   shu matn chiqadi, shuning uchun imlo/format har taklifda bir xil bo'ladi. */
const OFFER_BASIS: { v: string; label: string }[] = [
  { v: "1 kishi uchun", label: "1 kishi uchun" },
  { v: "2 kishi uchun", label: "2 kishi uchun" },
  { v: "2 kishilik nomer uchun", label: "2 kishilik nomer uchun" },
  { v: "butun guruh uchun", label: "Butun guruh uchun" },
  { v: "", label: "Ko'rsatilmasin" },
];

function Presentations({ show, items, leads, tours, reload, readOnly }: any) {
  const [leadId, setLeadId] = useState("");
  const [tourId, setTourId] = useState("");
  const [title, setTitle] = useState("");
  // Narx: raqam + valyuta + kim uchun — uchtasi tanlov, matn o'zi yasaladi.
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [basis, setBasis] = useState(OFFER_BASIS[0].v);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const [created, setCreated] = useState<any>(null);
  const [sending, setSending] = useState("");
  const [sent, setSent] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [help, setHelp] = useState(false);

  // Tur tanlanganda uning nomi va narxini avtomatik to'ldiramiz — foydalanuvchi keyin o'zgartira oladi.
  function fillFromTour(id: string) {
    const t = tours.find((x: any) => x.id === id);
    if (!t) return;
    setTitle(t.title || "");
    // Narxni turdan olamiz: aniq son bo'lmasa matndagi raqamlardan yig'amiz.
    const num = Number(t.priceMin) || Number(String(t.price || "").replace(/[^\d]/g, "")) || 0;
    setAmount(num ? String(num) : "");
    if (t.priceCurrency === "UZS" || t.priceCurrency === "USD") setCurrency(t.priceCurrency);
  }
  // Mijoz sahifasida ko'rinadigan narx matni — tanlovlardan yasaladi.
  const priceText = (() => {
    const num = Number(String(amount).replace(/[^\d]/g, ""));
    if (!num) return "";
    const money = currency === "UZS"
      ? `${new Intl.NumberFormat("ru-RU").format(num)} so'm`
      : formatMoney(num);
    return basis ? `${money} / ${basis}` : money;
  })();
  function pickTour(id: string) {
    setTourId(id);
    if (id) fillFromTour(id);
  }

  const leadOpts: CrmLead[] = useMemo(() => leads.filter((l: CrmLead) => l.stage !== "lost"), [leads]);
  const leadById = useMemo(() => {
    const m: Record<string, CrmLead> = {};
    for (const l of leads) m[(l as CrmLead).id] = l as CrmLead;
    return m;
  }, [leads]);

  // Lid tanlanganda uning yo'nalishiga mos turni O'ZI tanlaydi.
  // Yo'nalish Telegram botdagi savoldan yoki qo'lda kiritilgandan keladi.
  const selectedLead = leadId ? leadById[leadId] : null;
  const leadDest = String(selectedLead?.tourTitle || "").trim();
  useEffect(() => {
    if (!leadDest) return;
    const d = leadDest.toLowerCase();
    const match = tours.find((t: any) => {
      const title = String(t.title || "").toLowerCase();
      const city = String(t.city || "").toLowerCase();
      if (title && (title.includes(d) || d.includes(title))) return true;
      if (city.length >= 3 && (city.includes(d) || d.includes(city))) return true;
      return false;
    });
    if (match) { setTourId(match.id); fillFromTour(match.id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);
  const stats = useMemo(() => ({
    total: items.length,
    viewed: items.filter((p: any) => p.status === "viewed" || p.status === "interested").length,
    interested: items.filter((p: any) => p.status === "interested").length,
  }), [items]);

  // DIQQAT: qattiq rang YOZILMAYDI. Ilgari chegara rgba(255,255,255,.15) edi —
  // och rejimda oq kartada ko'rinmasdi, maydonlar chegarasiz turardi. Ranglar
  // mavzu tokenlaridan olinadi, shuning uchun ikki rejimda ham to'g'ri.
  const inp: any = { padding: "10px 12px", border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--t1)", borderRadius: 10, fontSize: 14, minWidth: 0, fontFamily: "inherit", outline: "none" };
  const stepLabel: any = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 };
  const stepNum: any = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999, background: "rgba(234,179,8,.15)", color: "#EAB308", fontSize: 12.5, fontWeight: 800, flex: "0 0 auto" };
  const hint: any = { color: "#8aa398", fontSize: 12.5 };

  async function copy(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      /* clipboard yopiq bo'lsa — link baribir ko'rinib turibdi */
    }
  }

  async function submit(e?: any) {
    e?.preventDefault?.();
    if (readOnly || busy) return;
    if (!tourId && !title.trim()) { setErr("Tur tanlang yoki taklif nomini yozing."); return; }
    setBusy(true); setErr("");
    const lead = leads.find((x: CrmLead) => x.id === leadId);
    const res = await agencyApi<any>("/presentations", {
      method: "POST",
      body: JSON.stringify({
        bookingId: leadId || undefined,
        tourId: tourId || undefined,
        title: title.trim() || undefined,
        customerName: lead?.customerName || undefined,
        priceText: priceText || undefined,
        note: note.trim() || undefined,
      }),
    });
    setBusy(false);
    if (!res.success) { setErr(res.message || "Taklif yaratilmadi"); return; }
    setCreated(res.data);
    setTitle(""); setAmount(""); setBasis(OFFER_BASIS[0].v); setNote(""); setTourId(""); setLeadId("");
    await reload();
  }

  async function remove(id: string) {
    if (readOnly) return;
    const res = await agencyApi(`/presentations/${id}`, { method: "DELETE" });
    if (res.success) await reload();
  }

  // Telegramdan kelgan lidga taklifni to'g'ridan-to'g'ri botdan yuborish.
  async function sendTelegram(p: any) {
    if (readOnly || sending) return;
    setSending(p.id); setSendErr("");
    const text = `${p.title}\n\n${p.note ? `${p.note}\n\n` : ""}Taklifni ko'rish: ${p.url}`;
    const res = await agencyApi("/telegram/reply", { method: "POST", body: JSON.stringify({ bookingId: p.bookingId, text }) });
    setSending("");
    if (res.success) { setSent(p.id); setTimeout(() => setSent(""), 2500); }
    else setSendErr(res.message || "Telegramga yuborilmadi");
  }

  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head">
        <div>
          <h2>Takliflar</h2>
          <div className="sub">Mijozga maxsus havola tayyorlaysiz — tanlangan tur, narx va shaxsiy izoh bilan.</div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHelp((v) => !v)}>
          <Ic d={I.info} s={15} /> Bu qanday ishlaydi?
        </button>
      </div>

      {help ? (
        <div className="card" style={{ padding: 16, marginBottom: 12, display: "grid", gap: 8, borderColor: "rgba(234,179,8,.35)" }}>
          <b style={{ color: "#EAB308" }}>Taklif — bu mijoz uchun maxsus sahifa (havola).</b>
          <div style={{ color: "#8aa398", fontSize: 13.5, lineHeight: 1.65 }}>
            Turni, narxni va qisqa izohni tanlaysiz — biz mijoz uchun chiroyli sahifa tayyorlaymiz.
            Havolani unga Telegram yoki WhatsApp orqali yuborasiz. Mijoz sahifani ochsa yoki qiziqsa —
            pastdagi jadvalда «ko&apos;rildi / qiziqish bildirdi» bo&apos;lib ko&apos;rinadi.
            Mijozning telefon raqami va emaili sahifada <b>ko&apos;rinmaydi</b>.
          </div>
        </div>
      ) : null}

      {created ? (
        <div className="card" style={{ padding: 16, marginBottom: 12, borderColor: "rgba(234,179,8,.45)" }}>
          <b style={{ color: "#EAB308" }}>Taklif tayyor — havolani mijozga yuboring</b>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <code style={{ flex: "1 1 260px", padding: "10px 12px", background: "var(--canvas)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, wordBreak: "break-all" }}>{created.url}</code>
            <button className="btn btn-primary btn-sm" onClick={() => void copy(created.url, "new")}>
              <Ic d={I.copy} s={14} /> {copied === "new" ? "Nusxalandi" : "Nusxalash"}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreated(null)}>Yopish</button>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <form className="card" style={{ padding: 18, display: "grid", gap: 16 }} onSubmit={submit}>
          {/* 1 — Kimga */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={stepLabel}><span style={stepNum}>1</span> Kimga yuboramiz?</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} style={inp}>
              <option value="">Mijozni tanlang (ixtiyoriy)</option>
              {leadOpts.map((l) => <option key={l.id} value={l.id}>{l.customerName} · {STAGE_LABEL[l.stage]}</option>)}
            </select>
            <small style={hint}>Telegram lidini tanlasangiz — tayyor havolani to&apos;g&apos;ridan-to&apos;g&apos;ri botdan yuborishingiz mumkin.</small>
          </div>

          {/* 2 — Qaysi tur */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={stepLabel}><span style={stepNum}>2</span> Qaysi turni taklif qilamiz?</label>
            <select value={tourId} onChange={(e) => pickTour(e.target.value)} style={inp}>
              <option value="">Turni tanlang</option>
              {tours.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {leadDest ? (
              <small style={hint}>
                Mijoz qiziqqan yo&apos;nalish: <b style={{ color: "#EAB308" }}>{leadDest}</b>
                {tourId ? " — mos tur o'zi tanlandi, nomi va narxi to'ldirildi." : " — mos tur topilmadi, qo'lda tanlang."}
              </small>
            ) : null}
          </div>

          {/* 3 — Nomi, narx, izoh */}
          <div style={{ display: "grid", gap: 6 }}>
            <label style={stepLabel}><span style={stepNum}>3</span> Nomi, narxi va izoh</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Taklif nomi" style={inp} />
            {/* Narx — erkin matn EMAS: son + valyuta + kim uchun. Mijoz sahifasidagi
                matn shundan yasaladi, har taklifda bir xil ko'rinishda bo'ladi. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="Narx (faqat son)"
                style={{ ...inp, flex: "1 1 150px" }}
              />
              {/* Valyuta kodi — tur qo'shish formasi bilan BIR XIL yozilishi
                  kerak (USD / UZS), aks holda ikki joyda boshqacha ko'rinadi. */}
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...inp, flex: "0 1 110px" }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={basis} onChange={(e) => setBasis(e.target.value)} style={{ ...inp, flex: "1 1 190px" }}>
                {OFFER_BASIS.map((b) => <option key={b.v || "none"} value={b.v}>{b.label}</option>)}
              </select>
            </div>
            <small style={hint}>
              {priceText
                ? <>Mijoz shunday ko&apos;radi: <b style={{ color: "#EAB308" }}>{priceText}</b></>
                : "Narxni yozsangiz — mijoz sahifasida qanday ko'rinishini shu yerda ko'rsatamiz."}
            </small>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Shaxsiy izoh — nega aynan shu tur mos kelishini yozing (ixtiyoriy)…" style={{ ...inp, resize: "vertical", width: "100%", lineHeight: 1.5 }} />
          </div>

          {err ? <div style={{ color: "#F43F5E", fontSize: 13 }}>{err}</div> : null}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Ic d={I.send} s={15} /> {busy ? "Tayyorlanmoqda…" : "Havola tayyorlash"}
            </button>
          </div>
        </form>
      ) : null}

      {sendErr ? <div className="card" style={{ marginTop: 12, padding: 12, color: "#F43F5E", fontSize: 13 }}>{sendErr}</div> : null}

      {stats.total > 0 ? (
        <div style={{ margin: "16px 2px 0", fontSize: 13, color: "#8aa398" }}>
          <b style={{ color: "var(--t1)" }}>Yuborilgan takliflar</b> · {stats.total} ta · {stats.viewed} ko&apos;rildi · {stats.interested} qiziqish bildirdi
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <Empty icon={I.send} text="Hali taklif yuborilmagan. Yuqoridagi shakl orqali mijozga shaxsiy havola tayyorlang." />
        </div>
      ) : (
        <div className="card tbl-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr><th>Taklif</th><th>Mijoz</th><th>Holat</th><th>Ko&apos;rishlar</th><th>Oxirgi ochilish</th><th>Havola</th></tr>
            </thead>
            <tbody>
              {items.map((p: any) => {
                const s = PRES_STATE[p.status] || PRES_STATE.sent;
                return (
                  <tr key={p.id}>
                    <td><b>{p.title}</b>{p.tourTitle && p.tourTitle !== p.title ? <><br /><small style={{ color: "#8aa398" }}>{p.tourTitle}</small></> : null}</td>
                    <td>{p.customerName || <span style={{ color: "#8aa398" }}>—</span>}</td>
                    <td><span className={`badge2 ${s.cls}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Ic d={s.icon} s={11} /> {s.label}</span></td>
                    <td>{p.openCount || 0}</td>
                    <td>{p.lastOpenedAt ? timeAgo(p.lastOpenedAt) : <span style={{ color: "#8aa398" }}>Ochilmagan</span>}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => void copy(p.url, p.id)}>
                          <Ic d={I.copy} s={13} /> {copied === p.id ? "Nusxalandi" : "Nusxalash"}
                        </button>
                        {!readOnly && p.bookingId && leadById[p.bookingId]?.source === "telegram" ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => void sendTelegram(p)} disabled={sending === p.id}>
                            <Ic d={I.send} s={13} /> {sent === p.id ? "Yuborildi" : sending === p.id ? "Yuborilmoqda…" : "Telegram"}
                          </button>
                        ) : null}
                        {!readOnly ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => void remove(p.id)} title="O'chirish" aria-label="O'chirish">
                            <Ic d={I.trash} s={13} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ================= PACKAGES / TOURS ================= */
function Packages({ show, tours, agencyId, refreshTours, readOnly }: any) {
  const [modal, setModal] = useState<{ tour?: any; duplicate?: boolean } | null>(null);
  const [delTour, setDelTour] = useState<any>(null);
  const [delErr, setDelErr] = useState(""); const [delBusy, setDelBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  async function submitTour(t: any) {
    setBusyId(t.id);
    const res = await agencyApi(`/tours/${t.id}/submit`, { method: "POST" });
    if (res.success) { pushNotif(agencyId, { kind: "tour", title: "Tur saytda e'lon qilindi", sub: t.title }); await refreshTours(); }
    setBusyId("");
  }
  async function doDelete() {
    if (!delTour) return;
    setDelBusy(true); setDelErr("");
    const res = await agencyApi(`/tours/${delTour.id}`, { method: "DELETE" });
    setDelBusy(false);
    if (res.success) { pushNotif(agencyId, { kind: "tour", title: "Tur o'chirildi", sub: delTour.title }); setDelTour(null); await refreshTours(); }
    else setDelErr(res.message || "Turni o'chirib bo'lmadi.");
  }
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head">
        <div><h2>Turlar / Paketlar</h2><div className="sub">{tours.length} ta tur</div></div>
        <button className="btn btn-primary" onClick={() => setModal({})} disabled={readOnly} title={readOnly ? "Obuna tugagan — faqat o'qish rejimi" : undefined}><Ic d={I.plus} s={16} /> Yangi tur</button>
      </div>
      {tours.length ? (
        <div className="grid g3">
          {tours.map((t: any, i: number) => (
            <div className="card pkg" key={t.id}>
              <div className="ph" style={t.imageUrl
                ? { backgroundImage: `linear-gradient(180deg,rgba(11,42,30,.1),rgba(11,42,30,.55)),url(${t.imageUrl})` }
                : { backgroundImage: PKG_GRADS[i % PKG_GRADS.length] }}><span className="st">{statusLabel(t.approvalStatus)}</span></div>
              <div className="pb">
                <h3>{t.title}</h3>
                <div className="meta">{t.city}{t.duration ? ` · ${t.duration}` : ""}</div>
                {Array.isArray(t.highlights) && t.highlights.length ? <div className="chips">{t.highlights.slice(0, 4).map((h: string, i: number) => <span className="chip" key={i}>{h}</span>)}</div> : null}
                <div className="pf"><div className="price">{t.price || (t.priceMin ? formatMoney(t.priceMin) : "—")}</div>{t.active ? <span className="badge2 b-green">Faol</span> : <span className="badge2 b-grey">Nofaol</span>}</div>
                {!readOnly ? (
                  <div className="pkg-act">
                    <button className="pkg-abtn" onClick={() => setModal({ tour: t })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Tahrirlash</button>
                    <button className="pkg-abtn" onClick={() => setModal({ tour: t, duplicate: true })} title="Shu turdan nusxa olib yangi tur yaratish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Nusxa</button>
                    <button className="pkg-abtn del" onClick={() => { setDelErr(""); setDelTour(t); }} title="O'chirish" aria-label="O'chirish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                  </div>
                ) : null}
                {!readOnly && t.approvalStatus === "draft" ? (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 8, width: "100%" }} disabled={busyId === t.id} onClick={() => void submitTour(t)}>{busyId === t.id ? "E'lon qilinmoqda..." : "Saytda e'lon qilish"}</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="card"><Empty icon={I.box} text="Hali tur yo'q. 'Yangi tur' tugmasi orqali qo'shing." /></div>}
      {modal ? <AddTour agencyId={agencyId} tour={modal.tour} duplicate={modal.duplicate} onClose={() => setModal(null)} onCreated={refreshTours} /> : null}
      {delTour ? <ConfirmDelete tour={delTour} busy={delBusy} err={delErr} onCancel={() => setDelTour(null)} onConfirm={doDelete} /> : null}
    </section>
  );
}

/* ================= BOOKINGS ================= */
function Bookings({ show, bookings, agencyId, refreshBookings, refresh, readOnly, canExport }: any) {
  const [busyId, setBusyId] = useState("");
  const paid = bookings.filter((b: any) => b.status === "completed" || b.status === "confirmed").length;
  const pend = bookings.filter((b: any) => b.status === "pending").length;
  async function setStatus(b: any, status: string) {
    setBusyId(b.id);
    const res = await agencyApi(`/bookings/${b.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (res.success) {
      if (status === "confirmed") pushNotif(agencyId, { kind: "booking", title: "Bron tasdiqlandi", sub: b.customerName });
      else if (status === "completed") pushNotif(agencyId, { kind: "payment", title: "Bron yakunlandi", sub: b.customerName });
      await refreshBookings(); await refresh(true);
    }
    setBusyId("");
  }
  const bookLabel = (s: string) => (s === "pending" ? "Tasdiqlash kutilmoqda" : statusLabel(s));
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Bronlar</h2><div className="sub">Jami {bookings.length} bron · {paid} tasdiqlangan{pend ? ` · ${pend} kutilmoqda` : ""}</div></div>{canExport ? <ExportBtn rows={bookings} filename="bronlar" columns={BOOK_COLS} /> : null}</div>
      <div className="card tbl-wrap">
        {bookings.length ? (
          <table>
            <thead><tr><th>Mijoz</th><th>Yo&apos;nalish</th><th>Sana</th><th>Kishi</th><th className="r">Summa</th><th>Holat</th><th>Amal</th></tr></thead>
            <tbody>
              {bookings.map((b: any) => (
                <tr key={b.id}>
                  <td><div className="cell"><span className="av-sm">{initials(b.customerName)}</span><b>{b.customerName}</b></div></td>
                  <td>{b.tour?.title || b.tour?.city || b.leadTour || "—"}</td>
                  <td>{b.travelDate ? formatDate(b.travelDate) : "—"}</td>
                  <td>{b.travelers}</td>
                  <td className="r money">{formatMoney(b.totalEstimate)}</td>
                  <td><span className={`badge2 ${b.status === "confirmed" || b.status === "completed" ? "b-green" : b.status === "pending" ? "b-amber" : "b-rose"}`}>{bookLabel(b.status)}</span></td>
                  <td>
                    {readOnly ? <span className="act-dim">—</span> : b.status === "pending" ? (
                      <div className="row-act">
                        <button className="act-btn ok" disabled={busyId === b.id} onClick={() => void setStatus(b, "confirmed")} title="Tasdiqlash" aria-label="Tasdiqlash"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></button>
                        <button className="act-btn no" disabled={busyId === b.id} onClick={() => void setStatus(b, "rejected")} title="Rad etish" aria-label="Rad etish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
                      </div>
                    ) : b.status === "confirmed" ? (
                      <div className="row-act">
                        <button className="act-btn done-btn" disabled={busyId === b.id} onClick={() => void setStatus(b, "completed")}>Yakunlash</button>
                        <button className="act-btn back" disabled={busyId === b.id} onClick={() => void setStatus(b, "pending")} title="Orqaga qaytarish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>Orqaga</button>
                      </div>
                    ) : b.status === "completed" ? (
                      <button className="act-btn back" disabled={busyId === b.id} onClick={() => void setStatus(b, "confirmed")} title="Yakunlashni bekor qilish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>Orqaga</button>
                    ) : b.status === "rejected" ? (
                      <button className="act-btn back" disabled={busyId === b.id} onClick={() => void setStatus(b, "pending")} title="Qayta ochish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>Qayta ochish</button>
                    ) : <span className="act-dim">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={I.cal} text="Hali bron yo'q." />}
      </div>
    </section>
  );
}

/* ================= PAYMENTS ================= */
/* To'lovni tasdiqlash — qancha olinganini kiritish oynasi */
function PayConfirm({ lead, onClose, onConfirm }: { lead: CrmLead; onClose: () => void; onConfirm: (amount: string) => Promise<void> }) {
  const [amount, setAmount] = useState(lead.totalEstimate ? String(lead.totalEstimate) : "");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await onConfirm(amount.replace(/[^\d]/g, ""));
    setBusy(false);
    onClose();
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: "min(400px,100%)", padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 14px" }}><div><h2>To&apos;lovni tasdiqlash</h2><div className="sub">{lead.customerName} — qancha to&apos;landi?</div></div></div>
        <div className="fld"><label>Olingan summa ($)</label><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="masalan 800" autoFocus onKeyDown={(e) => { if (e.key === "Enter") void go(); }} /></div>
        {lead.totalEstimate ? <div style={{ fontSize: 12.5, color: "var(--t3)", marginTop: -4 }}>Taxminiy summa: {formatMoney(lead.totalEstimate)}</div> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Bekor</button>
          <button className="btn btn-primary" onClick={() => void go()} disabled={busy}>{busy ? "Saqlanmoqda…" : "Tasdiqlash"}</button>
        </div>
      </div>
    </div>
  );
}

type FinanceAccount = { id: string; name: string; type: string; currency: string; openingBalance: number };
type FinanceTransaction = {
  id: string; direction: "income" | "expense"; status: "planned" | "paid" | "cancelled"; category: string;
  amount: number; currency: string; counterparty?: string; dueAt?: string; paidAt?: string; note?: string;
  account?: { id: string; name: string } | null; booking?: { id: string; customerName: string } | null;
  businessDocument?: { id: string; number: string } | null;
  supplierId?: string; managerMemberId?: string; commissionSourceId?: string;
  supplier?: { id: string; name: string; type: string } | null; managerMember?: { id: string; name: string } | null;
};
type FinanceSupplier = { id: string; name: string; type: string; currency: string; phone?: string; email?: string; paid?: number; payable?: number; overdue?: number };
type FinanceTeam = { id: string; name: string; role: string; commissionRule?: { percent: number; fixedAmount: number; currency: string; active: boolean } | null };
type ExchangeRatePayload = {
  source: string; baseCurrency: "UZS"; effectiveDate: string; fetchedAt: string; cached: boolean; stale?: boolean;
  rates: { code: string; name: string; nominal: number; rate: number; unitRateUzs: number; difference: number }[];
};
type BankTransactionBrief = { id: string; direction: "income" | "expense"; amount: number; currency: string; category: string; counterparty?: string; status: string; dueAt?: string; paidAt?: string };
type BankStatementImport = { id: string; fileName: string; currency: string; status: string; totalRows: number; suggestedRows: number; matchedRows: number; ignoredRows: number; createdAt: string; account?: { id: string; name: string; currency: string } | null };
type BankStatementRow = {
  id: string; rowNumber: number; transactionDate: string; direction: "income" | "expense"; amount: number; currency: string;
  counterparty?: string; description?: string; externalId?: string; status: "unmatched" | "suggested" | "matched" | "ignored" | "duplicate";
  matchScore?: number; suggestedTransaction?: BankTransactionBrief | null; matchedTransaction?: BankTransactionBrief | null;
};
type ReconciliationPayload = { imports: BankStatementImport[]; activeImport?: BankStatementImport | null; rows: BankStatementRow[] };
type BankCsvInspect = { headers: string[]; sample: string[][]; suggestedMapping: Record<string, string>; delimiter: string; errors: string[] };
type FinancePayload = {
  accounts: FinanceAccount[]; transactions: FinanceTransaction[];
  suppliers: FinanceSupplier[]; team: FinanceTeam[]; supplierBalances: FinanceSupplier[];
  commissions: { memberId: string; name: string; role: string; accrued: number; paid: number; payable: number; rule?: FinanceTeam["commissionRule"] }[];
  calendar: { id: string; dueAt: string; direction: "income" | "expense"; amount: number; currency: string; category: string; counterparty?: string }[];
  summary: { currency: string; received: number; spent: number; profit: number; receivable: number; payable: number; overdue: number; accountBalances: { id: string; name: string; type: string; currency: string; balance: number }[] };
};

function FinanceEntryModal({ kind, currency, accounts, leads, suppliers, team, onClose, onSaved }: {
  kind: "income" | "expense" | "account"; currency: string; accounts: FinanceAccount[]; leads: CrmLead[]; suppliers: FinanceSupplier[]; team: FinanceTeam[];
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(""); const [name, setName] = useState(""); const [category, setCategory] = useState(kind === "income" ? "Mijoz to'lovi" : "Operatsion xarajat");
  const [status, setStatus] = useState("paid"); const [accountId, setAccountId] = useState(""); const [bookingId, setBookingId] = useState("");
  const [supplierId, setSupplierId] = useState(""); const [managerMemberId, setManagerMemberId] = useState("");
  const [dueAt, setDueAt] = useState(""); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const result = kind === "account"
      ? await agencyApi("/crm/finance/accounts", { method: "POST", body: JSON.stringify({ name, type: "cash", currency, openingBalance: amount || 0 }) })
      : await agencyApi("/crm/finance/transactions", { method: "POST", body: JSON.stringify({ direction: kind, status, amount, currency, category, accountId: accountId || null, bookingId: bookingId || null, supplierId: supplierId || null, managerMemberId: managerMemberId || null, counterparty: name || null, dueAt: dueAt || null, note }) });
    setBusy(false);
    if (!result.success) { setErr(result.message || "Saqlab bo'lmadi"); return; }
    await onSaved(); onClose();
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 70, display: "grid", placeItems: "center", padding: 16 }} onClick={onClose}>
      <form className="card" style={{ width: "min(520px,100%)", padding: 22 }} onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 14px" }}><div><h2>{kind === "account" ? "Yangi kassa yoki hisob" : kind === "income" ? "Kirim qo'shish" : "Chiqim qo'shish"}</h2></div></div>
        {err ? <div className="note" style={{ marginBottom: 12, color: "#8f2a20" }}>{err}</div> : null}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="fld" style={{ gridColumn: kind === "account" ? "1 / -1" : undefined }}><label>{kind === "account" ? "Hisob nomi" : "Kontragent"}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "account" ? "Masalan: Asosiy kassa" : "Mijoz yoki hamkor nomi"} required={kind === "account"} /></div>
          <div className="fld"><label>{kind === "account" ? "Boshlang'ich qoldiq" : "Summa"} ({currency})</label><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} required={kind !== "account"} /></div>
          {kind !== "account" ? <>
            <div className="fld"><label>Kategoriya</label><input value={category} onChange={(e) => setCategory(e.target.value)} required /></div>
            <div className="fld"><label>Holat</label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="paid">To'langan</option><option value="planned">Rejalashtirilgan</option></select></div>
            <div className="fld"><label>Kassa / hisob</label><select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Biriktirilmagan</option>{accounts.filter((a) => a.currency === currency).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div className="fld"><label>Lid / bitim</label><select value={bookingId} onChange={(e) => setBookingId(e.target.value)}><option value="">Biriktirilmagan</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.customerName} — {l.tourTitle || "tur"}</option>)}</select></div>
            {kind === "expense" ? <div className="fld"><label>Turoperator / hamkor</label><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Biriktirilmagan</option>{suppliers.filter((s) => s.currency === currency).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div> : null}
            <div className="fld"><label>Mas&apos;ul menejer</label><select value={managerMemberId} onChange={(e) => setManagerMemberId(e.target.value)}><option value="">Avtomatik / yo&apos;q</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            {status === "planned" ? <div className="fld"><label>To'lov muddati</label><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div> : null}
            <div className="fld" style={{ gridColumn: "1 / -1" }}><label>Izoh</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </> : null}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}><button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saqlanmoqda…" : "Saqlash"}</button></div>
      </form>
    </div>
  );
}
function Payments({ show, leads, move, busyId, readOnly, canExport }: any) {
  const [payLead, setPayLead] = useState<CrmLead | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [finance, setFinance] = useState<FinancePayload | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatePayload | null>(null);
  const [ratesBusy, setRatesBusy] = useState(false);
  const [ratesError, setRatesError] = useState("");
  const [reconciliation, setReconciliation] = useState<ReconciliationPayload | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [reconciliationBusyId, setReconciliationBusyId] = useState("");
  const [entryKind, setEntryKind] = useState<"income" | "expense" | "account" | null>(null);
  async function loadFinance() {
    const result = await agencyApi<FinancePayload>(`/crm/finance?currency=${currency}`);
    if (result.success) setFinance(result.data);
  }
  async function loadExchangeRates(refresh = false) {
    setRatesBusy(true); setRatesError("");
    const result = await agencyApi<ExchangeRatePayload>(`/crm/finance/exchange-rates${refresh ? "?refresh=1" : ""}`);
    setRatesBusy(false);
    if (result.success) setExchangeRates(result.data); else setRatesError(result.message || "Valyuta kurslarini olib bo‘lmadi");
  }
  async function loadReconciliation(importId?: string) {
    const result = await agencyApi<ReconciliationPayload>(`/crm/finance/reconciliation${importId ? `?importId=${encodeURIComponent(importId)}` : ""}`);
    if (result.success) setReconciliation(result.data);
  }
  async function reconcileRow(row: BankStatementRow, action: "match" | "create" | "ignore") {
    setReconciliationBusyId(row.id);
    const path = action === "match" ? `/crm/finance/reconciliation/rows/${row.id}/match` : action === "create" ? `/crm/finance/reconciliation/rows/${row.id}/create` : `/crm/finance/reconciliation/rows/${row.id}/ignore`;
    const result = await agencyApi(path, { method: action === "ignore" ? "PATCH" : "POST", body: JSON.stringify(action === "match" ? { transactionId: row.suggestedTransaction?.id } : {}) });
    setReconciliationBusyId("");
    if (!result.success) { alert(result.message); return; }
    await Promise.all([loadFinance(), loadReconciliation(reconciliation?.activeImport?.id)]);
  }
  useEffect(() => { if (show) { void loadFinance(); void loadExchangeRates(); void loadReconciliation(); } }, [show, currency]); // eslint-disable-line react-hooks/exhaustive-deps
  async function setFinanceStatus(row: FinanceTransaction, status: "paid" | "cancelled") {
    const result = await agencyApi(`/crm/finance/transactions/${row.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (result.success) await loadFinance();
  }
  async function addSupplier() {
    const name = window.prompt("Turoperator yoki hamkor nomi:"); if (!name?.trim()) return;
    const result = await agencyApi("/crm/finance/suppliers", { method: "POST", body: JSON.stringify({ name: name.trim(), type: "tour_operator", currency }) });
    if (result.success) await loadFinance(); else alert(result.message);
  }
  async function setCommission(member: FinanceTeam) {
    const percent = window.prompt(`${member.name} uchun komissiya foizi:`, String(member.commissionRule?.percent ?? 0)); if (percent === null) return;
    const fixedAmount = window.prompt(`Qo'shimcha qat'iy summa (${currency}):`, String(member.commissionRule?.fixedAmount ?? 0)); if (fixedAmount === null) return;
    const result = await agencyApi(`/crm/finance/commission-rules/${member.id}`, { method: "PUT", body: JSON.stringify({ percent, fixedAmount, currency, active: true }) });
    if (result.success) await loadFinance(); else alert(result.message);
  }
  const m = useMemo(() => {
    const paid = leads.filter((l: CrmLead) => l.stage === "won" || l.stage === "completed");
    const completed = leads.filter((l: CrmLead) => l.stage === "completed");
    const pending = leads.filter((l: CrmLead) => l.stage === "quoted");
    return {
      received: completed.reduce((a: number, l: CrmLead) => a + (l.paidAmount ?? l.totalEstimate ?? 0), 0),
      pending: pending.reduce((a: number, l: CrmLead) => a + (l.totalEstimate || 0), 0),
      rows: paid,
      paidCount: completed.length,
    };
  }, [leads]);
  const selectedRate = currency === "UZS" ? 1 : exchangeRates?.rates.find((row) => row.code === currency)?.unitRateUzs;
  const headlineRates = ["USD", "EUR", "RUB"].map((code) => exchangeRates?.rates.find((row) => row.code === code)).filter(Boolean) as ExchangeRatePayload["rates"];
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Moliya</h2><div className="sub">Kassa, bank, kirim-chiqim, supplier qarzi va menejer komissiyasi</div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ width: 90 }}><option>USD</option><option>UZS</option><option>EUR</option></select>{!readOnly ? <><button className="btn btn-ghost btn-sm" onClick={() => void addSupplier()}>+ Hamkor</button><button className="btn btn-ghost btn-sm" onClick={() => setEntryKind("account")}>+ Hisob</button><button className="btn btn-ghost btn-sm" onClick={() => setEntryKind("expense")}>− Chiqim</button><button className="btn btn-primary btn-sm" onClick={() => setEntryKind("income")}>+ Kirim</button></> : null}</div></div>
      <div className="grid g3">
        <div className="card kpi gold"><div className="top"><div className="ico"><Ic d={I.check} s={19} /></div></div><div className="val">{formatCurrencyAmount(finance?.summary.received ?? m.received, currency)}</div><div className="lbl">Jami kirim</div></div>
        <div className="card kpi"><div className="top"><div className="ico"><Ic d={I.clock} s={19} /></div></div><div className="val">{formatCurrencyAmount(finance?.summary.receivable ?? m.pending, currency)}</div><div className="lbl">Mijozlardan olinadi</div></div>
        <div className="card kpi"><div className="top"><div className="ico"><Ic d={I.card} s={19} /></div></div><div className="val">{formatCurrencyAmount(finance?.summary.profit ?? 0, currency)}</div><div className="lbl">Sof pul oqimi</div></div>
      </div>
      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div className="section-head" style={{ margin: 0 }}>
          <div><b>Markaziy bank valyuta kurslari</b><div className="sub">Moliyaviy hisob-kitoblar uchun rasmiy UZS kursi{exchangeRates?.effectiveDate ? ` · ${exchangeRates.effectiveDate}` : ""}</div></div>
          <button className="btn btn-ghost btn-sm" disabled={ratesBusy} onClick={() => void loadExchangeRates(true)}>{ratesBusy ? "Yangilanmoqda…" : "Kursni yangilash"}</button>
        </div>
        {ratesError ? <div className="note" style={{ marginTop: 10, color: "#8f2a20" }}>{ratesError}</div> : null}
        {headlineRates.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {headlineRates.map((row) => <span className="badge2 b-grey" key={row.code}>1 {row.code} = <b>{Math.round(row.unitRateUzs).toLocaleString("uz-UZ")} UZS</b> <small style={{ color: row.difference < 0 ? "#b42318" : "var(--primary)" }}>{row.difference > 0 ? "+" : ""}{row.difference.toLocaleString("uz-UZ")}</small></span>)}
          {selectedRate ? <span className="badge2 b-green">Tanlangan: 1 {currency} = <b>{Math.round(selectedRate).toLocaleString("uz-UZ")} UZS</b></span> : null}
          {exchangeRates?.stale ? <span className="badge2 b-amber">Oxirgi saqlangan kurs ko‘rsatildi</span> : null}
        </div> : ratesBusy ? <div className="sub" style={{ marginTop: 10 }}>Kurslar yuklanmoqda…</div> : null}
      </div>
      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div className="section-head" style={{ margin: 0 }}>
          <div><b>Bank ko‘chirmasi va reconciliation</b><div className="sub">CSV operatsiyalarini CRM kirim-chiqimlari bilan avtomatik solishtirish</div></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {reconciliation?.imports.length ? <select value={reconciliation.activeImport?.id || ""} onChange={(event) => void loadReconciliation(event.target.value)} style={{ minWidth: 180 }}>{reconciliation.imports.map((item) => <option value={item.id} key={item.id}>{item.fileName} · {formatDate(item.createdAt)}</option>)}</select> : null}
            {!readOnly ? <button className="btn btn-primary btn-sm" onClick={() => setStatementOpen(true)}>CSV yuklash</button> : null}
          </div>
        </div>
        {reconciliation?.activeImport ? <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span className="badge2 b-grey">Jami: <b>{reconciliation.activeImport.totalRows}</b></span>
            <span className="badge2 b-amber">Tavsiya: <b>{reconciliation.activeImport.suggestedRows}</b></span>
            <span className="badge2 b-green">Moslashtirildi: <b>{reconciliation.activeImport.matchedRows}</b></span>
            <span className="badge2 b-grey">Hisob: <b>{reconciliation.activeImport.account?.name || "biriktirilmagan"}</b></span>
          </div>
          <div className="tbl-wrap" style={{ marginTop: 12 }}><table><thead><tr><th>Sana</th><th>Bank operatsiyasi</th><th className="r">Summa</th><th>Natija</th><th>Amal</th></tr></thead><tbody>
            {reconciliation.rows.slice(0, 100).map((row) => {
              const candidate = row.matchedTransaction || row.suggestedTransaction;
              return <tr key={row.id}><td>{formatDate(row.transactionDate)}</td><td><b>{row.counterparty || "Kontragent ko‘rsatilmagan"}</b><div className="sub">{row.description || row.externalId || `CSV qator ${row.rowNumber}`}</div></td><td className="r money" style={{ color: row.direction === "income" ? "var(--primary)" : "#b42318" }}>{row.direction === "income" ? "+" : "−"}{formatCurrencyAmount(row.amount, row.currency)}</td><td>{row.status === "suggested" ? <><span className="badge2 b-amber">{row.matchScore}% mos</span><div className="sub">{candidate?.category} · {candidate?.counterparty || "CRM tranzaksiya"}</div></> : row.status === "matched" ? <><span className="badge2 b-green">Moslashtirildi</span><div className="sub">{candidate?.category}</div></> : row.status === "duplicate" ? <span className="badge2 b-grey">Dublikat</span> : row.status === "ignored" ? <span className="badge2 b-grey">O‘tkazib yuborildi</span> : <span className="badge2 b-grey">Topilmadi</span>}</td><td>{!readOnly && row.status === "suggested" ? <div className="row-act"><button className="act-btn done-btn" disabled={reconciliationBusyId === row.id} onClick={() => void reconcileRow(row, "match")}>{reconciliationBusyId === row.id ? "..." : "Tasdiqlash"}</button><button className="act-btn no" disabled={reconciliationBusyId === row.id} onClick={() => void reconcileRow(row, "ignore")}>×</button></div> : !readOnly && row.status === "unmatched" ? <div className="row-act"><button className="act-btn done-btn" disabled={reconciliationBusyId === row.id} onClick={() => void reconcileRow(row, "create")}>{reconciliationBusyId === row.id ? "..." : "Yangi tranzaksiya"}</button><button className="act-btn no" disabled={reconciliationBusyId === row.id} onClick={() => void reconcileRow(row, "ignore")}>×</button></div> : "—"}</td></tr>;
            })}
          </tbody></table></div>
        </> : <div className="sub" style={{ marginTop: 12 }}>Bank CSV faylini yuklang — tizim ustunlarni aniqlab, mavjud to‘lovlarni tavsiya qiladi.</div>}
      </div>
      {finance ? <>
        <div className="grid g3" style={{ marginTop: 12 }}>
          <div className="card" style={{ padding: 16 }}><div className="sub">Jami chiqim</div><b className="money" style={{ fontSize: 20 }}>{formatCurrencyAmount(finance.summary.spent, currency)}</b></div>
          <div className="card" style={{ padding: 16 }}><div className="sub">Hamkorlarga to&apos;lanadi</div><b className="money" style={{ fontSize: 20 }}>{formatCurrencyAmount(finance.summary.payable, currency)}</b></div>
          <div className="card" style={{ padding: 16 }}><div className="sub">Muddati o&apos;tgan</div><b className="money" style={{ fontSize: 20, color: finance.summary.overdue ? "#b42318" : undefined }}>{formatCurrencyAmount(finance.summary.overdue, currency)}</b></div>
        </div>
        {finance.summary.accountBalances.length ? <div className="card" style={{ padding: 14, marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>{finance.summary.accountBalances.map((a) => <span className="badge2 b-grey" key={a.id}>{a.name}: <b>{formatCurrencyAmount(a.balance, currency)}</b></span>)}</div> : null}
        <div className="grid g2" style={{ marginTop: 12 }}>
          <div className="card" style={{ padding: 16 }}><b>Turoperator va hamkorlar</b><div className="sub" style={{ margin: "4px 0 10px" }}>Qancha to&apos;landi va qancha qarz qoldi</div>{finance.supplierBalances.length ? finance.supplierBalances.map((s) => <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderTop: "1px solid var(--border)" }}><span>{s.name}</span><span className="money">Qarz: {formatCurrencyAmount(s.payable || 0, currency)}{s.overdue ? <small style={{ color: "#b42318" }}> · kechikkan {formatCurrencyAmount(s.overdue, currency)}</small> : null}</span></div>) : <span className="sub">Hamkor qo&apos;shilmagan</span>}</div>
          <div className="card" style={{ padding: 16 }}><b>Menejer komissiyasi</b><div className="sub" style={{ margin: "4px 0 10px" }}>To&apos;langan bitimdan avtomatik hisoblanadi</div>{finance.commissions.length ? finance.commissions.map((m) => <div key={m.memberId} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderTop: "1px solid var(--border)" }}><span>{m.name} <small className="sub">{m.rule ? `${m.rule.percent}% + ${m.rule.fixedAmount}` : "qoida yo'q"}</small></span><span><b>{formatCurrencyAmount(m.payable, currency)}</b>{!readOnly ? <button className="act-btn" style={{ marginLeft: 6 }} onClick={() => void setCommission(finance.team.find((x) => x.id === m.memberId) || m as unknown as FinanceTeam)}>Sozlash</button> : null}</span></div>) : <span className="sub">Faol xodim yo&apos;q</span>}</div>
        </div>
        <div className="card" style={{ padding: 16, marginTop: 12 }}><b>To&apos;lov kalendari</b><div className="sub" style={{ margin: "4px 0 10px" }}>Kelgusi va muddati o&apos;tgan reja to&apos;lovlari</div>{finance.calendar.length ? <div className="tbl-wrap"><table><thead><tr><th>Sana</th><th>To&apos;lov</th><th>Kontragent</th><th className="r">Summa</th></tr></thead><tbody>{finance.calendar.slice(0, 20).map((row) => <tr key={row.id}><td style={{ color: new Date(row.dueAt) < new Date() ? "#b42318" : undefined }}>{formatDate(row.dueAt)}</td><td>{row.category}</td><td>{row.counterparty || "—"}</td><td className="r money">{row.direction === "income" ? "+" : "−"}{formatCurrencyAmount(row.amount, row.currency)}</td></tr>)}</tbody></table></div> : <span className="sub">Rejalashtirilgan to&apos;lov yo&apos;q</span>}</div>
        <div className="section-head" style={{ marginTop: 20 }}><div><h2>Moliya jurnali</h2><div className="sub">Barcha reja va haqiqiy to&apos;lovlar</div></div>{canExport ? <ExportBtn rows={finance.transactions} filename="moliya-jurnali" columns={[{ label: "Kategoriya", get: (r) => r.category }, { label: "Kontragent", get: (r) => r.counterparty || r.booking?.customerName || "" }, { label: "Tur", get: (r) => r.direction }, { label: "Holat", get: (r) => r.status }, { label: "Summa", get: (r) => r.amount }, { label: "Valyuta", get: (r) => r.currency }]} /> : null}</div>
        <div className="card tbl-wrap">
          {finance.transactions.length ? <table><thead><tr><th>To&apos;lov</th><th>Kontragent</th><th>Hisob / hujjat</th><th>Muddat</th><th className="r">Summa</th><th>Holat</th><th>Amal</th></tr></thead><tbody>{finance.transactions.map((row) => <tr key={row.id}><td><b>{row.category}</b><div className="sub">{row.direction === "income" ? "Kirim" : "Chiqim"}</div></td><td>{row.counterparty || row.booking?.customerName || "—"}</td><td>{row.account?.name || row.businessDocument?.number || "—"}</td><td>{row.dueAt ? formatDate(row.dueAt) : row.paidAt ? formatDate(row.paidAt) : "—"}</td><td className="r money" style={{ color: row.direction === "income" ? "var(--primary)" : "#b42318" }}>{row.direction === "income" ? "+" : "−"}{formatCurrencyAmount(row.amount, row.currency)}</td><td><span className={`badge2 ${row.status === "paid" ? "b-green" : row.status === "planned" ? "b-amber" : "b-grey"}`}>{row.status === "paid" ? "To'langan" : row.status === "planned" ? "Rejada" : "Bekor"}</span></td><td>{!readOnly && row.status === "planned" ? <div className="row-act"><button className="act-btn done-btn" onClick={() => void setFinanceStatus(row, "paid")}>To&apos;landi</button><button className="act-btn no" onClick={() => void setFinanceStatus(row, "cancelled")}>×</button></div> : "—"}</td></tr>)}</tbody></table> : <Empty icon={I.money} text="Hali moliyaviy operatsiya yo'q." />}
        </div>
      </> : null}
      <div className="section-head" style={{ marginTop: 20 }}><div><h2>Bitim to&apos;lovlari</h2><div className="sub">CRM voronkasidan kelgan to&apos;lovlar</div></div></div>
      <div className="card tbl-wrap" style={{ marginTop: 16 }}>
        {m.rows.length ? (
          <table>
            <thead><tr><th>Mijoz</th><th>Yo&apos;nalish</th><th className="r">Summa</th><th>Manba</th><th>Holat</th><th>To&apos;lov</th></tr></thead>
            <tbody>
              {m.rows.map((l: CrmLead) => (
                <tr key={l.id}>
                  <td><div className="cell"><span className="av-sm">{initials(l.customerName)}</span><b>{l.customerName}</b></div></td>
                  <td>{l.tourTitle || "—"}</td>
                  <td className="r money">{formatMoney(l.totalEstimate)}</td>
                  <td><span className="badge2 b-grey">{srcLabel(l.source)}</span></td>
                  <td><span className={`badge2 ${l.stage === "completed" ? "b-green" : "b-amber"}`}>{l.stage === "completed" ? "Yakunlandi" : "Kelishildi"}</span></td>
                  <td>
                    {readOnly ? <span className="act-dim">—</span> : l.stage === "won" ? (
                      <button className="act-btn done-btn" disabled={busyId === l.id} onClick={() => setPayLead(l)}>{busyId === l.id ? "..." : "To'lovni tasdiqlash"}</button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="money" style={{ color: "var(--primary)" }} title="Olingan to'lov">{formatMoney(l.paidAmount ?? l.totalEstimate)} ✓</span>
                        <button className="act-btn back" disabled={busyId === l.id} onClick={() => void move(l, "won")} title="To'lovni bekor qilish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={I.money} text="Hali to'lov yo'q. Lid 'Kelishildi' bosqichiga o'tganda shu yerda ko'rinadi." />}
      </div>
      {payLead ? (
        <PayConfirm lead={payLead} onClose={() => setPayLead(null)}
          onConfirm={async (amount) => { await agencyApi(`/bookings/${payLead.id}`, { method: "PATCH", body: JSON.stringify({ paidAmount: amount === "" ? null : amount }) }); await move(payLead, "completed"); }} />
      ) : null}
      {entryKind ? <FinanceEntryModal kind={entryKind} currency={currency} accounts={finance?.accounts || []} leads={leads} suppliers={finance?.suppliers || []} team={finance?.team || []} onClose={() => setEntryKind(null)} onSaved={loadFinance} /> : null}
      {statementOpen ? <BankStatementImportModal currency={currency} accounts={finance?.accounts || []} onClose={() => setStatementOpen(false)} onImported={async () => { await Promise.all([loadFinance(), loadReconciliation()]); }} /> : null}
    </section>
  );
}

/* ================= REPORTS ================= */
function Reports({ show, leads }: any) {
  const r = useMemo(() => {
    const now = new Date();
    const months: { m: string; v: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ m: UZ_MONTH[d.getMonth()], v: 0 });
    }
    const baseMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
    leads.forEach((l: CrmLead) => {
      if ((l.stage === "won" || l.stage === "completed") && l.totalEstimate && l.createdAt) {
        const t = new Date(l.createdAt);
        const idx = (t.getFullYear() - new Date(baseMonth).getFullYear()) * 12 + (t.getMonth() - new Date(baseMonth).getMonth());
        if (idx >= 0 && idx < 6) months[idx].v += l.totalEstimate;
      }
    });
    const maxRev = Math.max(1, ...months.map((x) => x.v));
    // sources
    const src: Record<string, number> = {};
    leads.forEach((l: CrmLead) => { const k = normalizeSource(l.source); src[k] = (src[k] || 0) + 1; });
    const total = Math.max(1, leads.length);
    // destinations
    const dest: Record<string, number> = {};
    leads.forEach((l: CrmLead) => { const k = (l.tourTitle || l.tourCity || "Boshqa").split(" ")[0]; dest[k] = (dest[k] || 0) + 1; });
    const topDest = Object.entries(dest).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxDest = Math.max(1, ...topDest.map((d) => d[1]));

    // Kanal bo'yicha samaradorlik: qaysi manba faqat lid emas, PUL keltiryapti.
    // utmSource bo'lsa o'sha, aks holda lidning texnik manbasidan kelib chiqamiz.
    const chanMap: Record<string, { leads: number; won: number; revenue: number }> = {};
    leads.forEach((l: CrmLead) => {
      const key =
        String(l.utmSource || "").trim().toLowerCase() ||
        srcLabel(l.source).toLowerCase();
      const row = chanMap[key] || (chanMap[key] = { leads: 0, won: 0, revenue: 0 });
      row.leads += 1;
      if (l.stage === "won" || l.stage === "completed") {
        row.won += 1;
        row.revenue += l.totalEstimate || 0;
      }
    });
    const channels = Object.entries(chanMap)
      .map(([name, v]) => ({ name, ...v, conv: v.leads ? Math.round((v.won / v.leads) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
    const maxChanRev = Math.max(1, ...channels.map((c) => c.revenue));

    return { months, maxRev, src, total, topDest, maxDest, channels, maxChanRev };
  }, [leads]);

  // Doiraviy diagramma: ko'pdan kamga, har manbaga o'z rangi
  const srcEntries = Object.entries(r.src).sort((a, b) => b[1] - a[1]);
  let acc = 0;
  const stops = srcEntries
    .map(([k, v]) => {
      const start = (acc / r.total) * 100;
      acc += v;
      const end = (acc / r.total) * 100;
      return `${SRC_COLOR[k] || "#8899A6"} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <section className={`view reports${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Oylik aylanma</h2><div className="sub">yopilgan bitimlar · so&apos;nggi 6 oy</div></div></div>
      <div className="card">
        <div className="bars">
          {r.months.map((mo, i) => (
            <div className={`b${i === r.months.length - 1 ? " last" : ""}`} key={i}><span className="v">{mo.v ? formatMoney(mo.v).replace("$", "") : "0"}</span><div className="bar" style={{ height: `${(mo.v / r.maxRev) * 100}%` }} /><span className="m">{mo.m}</span></div>
          ))}
        </div>
        <div style={{ height: 16 }} />
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-head" style={{ margin: "16px 20px 0" }}><div><h2>Lid manbalari</h2></div></div>
          <div className="donut-wrap">
            <div className="donut" style={{ background: stops ? `conic-gradient(${stops})` : "#E7F1EB" }} />
            <div className="legend">
              {srcEntries.length ? srcEntries.map(([k, v]) => (
                <div className="l" key={k}>
                  <span className="sw" style={{ background: SRC_COLOR[k] || "#8899A6" }} />
                  {srcLabel(k)}
                  <span className="pc">{v} · {Math.round((v / r.total) * 100)}%</span>
                </div>
              )) : <p style={{ color: "var(--t3)", fontSize: 13 }}>Ma&apos;lumot yo&apos;q</p>}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="section-head" style={{ margin: "16px 20px 0" }}><div><h2>Top yo&apos;nalishlar</h2><div className="sub">lidlar soni</div></div></div>
          <div className="hbars">
            {r.topDest.length ? r.topDest.map(([k, v]) => (
              <div className="hbar" key={k}><span className="nm">{k}</span><div className="tk"><div className="fl" style={{ width: `${(v / r.maxDest) * 100}%` }} /></div><span className="ct">{v}</span></div>
            )) : <p style={{ color: "var(--t3)", fontSize: 13 }}>Ma&apos;lumot yo&apos;q</p>}
          </div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 22 }}>
        <div>
          <h2>Kanal samaradorligi</h2>
          <div className="sub">qaysi manba faqat lid emas, pul ham keltiryapti</div>
        </div>
      </div>
      <div className="card tbl-wrap">
        {r.channels.length ? (
          <table>
            <thead>
              <tr><th>Manba</th><th>Lidlar</th><th>Kelishuv</th><th>Konversiya</th><th className="r">Aylanma</th></tr>
            </thead>
            <tbody>
              {r.channels.map((c) => (
                <tr key={c.name}>
                  <td><b style={{ textTransform: "capitalize" }}>{c.name}</b></td>
                  <td>{c.leads}</td>
                  <td>{c.won}</td>
                  <td>
                    <span className={`badge2 ${c.conv >= 30 ? "b-green" : c.conv >= 10 ? "b-amber" : "b-grey"}`}>{c.conv}%</span>
                  </td>
                  <td className="r">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <div style={{ width: 54, height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ width: `${(c.revenue / r.maxChanRev) * 100}%`, height: "100%", background: "#0F5132" }} />
                      </div>
                      <b>{formatMoney(c.revenue)}</b>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty icon={I.chart} text="Hali lid yo'q — manba tahlili lidlar kelgach paydo bo'ladi." />
        )}
      </div>
    </section>
  );
}

/* ================= SETTINGS ================= */
function SubscriptionCard({ access, onManage }: any) {
  if (!access) return null;
  const { planName, status, readOnly, expired, until, daysLeft, caps } = access;
  const badge = expired
    ? { c: "b-rose", t: "Muddati tugagan" }
    : status === "active"
    ? { c: "b-green", t: "Faol" }
    : status === "trial"
    ? { c: "b-amber", t: "Sinov" }
    : { c: "b-grey", t: "Cheklovsiz" };
  // DIQQAT: `caps.integrations` bu yerda ATAYIN yo'q — u backendda hech qanday
  // route'ni himoya qilmaydi (o'lik bayroq), shuning uchun uni tarif afzalligi
  // sifatida ko'rsatish yolg'on bo'lardi. Instagram va Telegram ikkalasi ham
  // `telegram` imkoniyatiga bog'langan.
  const feats = [
    caps?.telegram && "Instagram va Telegram",
    caps?.broadcast && "Broadcast",
    caps?.analytics && "Analitika / CSV",
    caps?.presentations && "Dinamik takliflar",
    caps?.team && "Jamoa va rollar",
    caps?.ai && "AI yordamchi",
  ].filter(Boolean) as string[];
  return (
    <div className="card sub-card">
      <div className="sub-card__head">
        <div>
          <div className="sub-card__plan">{planName || "Tarif"}</div>
          <div className="sub-card__meta">
            {until
              ? <>Amal qiladi: <b>{formatDate(until)}</b>{typeof daysLeft === "number" ? (daysLeft >= 0 ? ` · ${daysLeft} kun qoldi` : " · muddat o'tgan") : ""}</>
              : "Muddat cheklovi yo'q"}
          </div>
        </div>
        <span className={`badge2 ${badge.c}`}>{badge.t}</span>
      </div>
      {readOnly ? (
        <div className="sub-card__warn">Obuna muddati tugagan — hozir faqat o&apos;qish rejimi. Quyida tarifni tanlab to&apos;lov qilsangiz, kabinet darhol tiklanadi.</div>
      ) : null}
      {feats.length ? <div className="sub-card__feats">{feats.map((f) => <span key={f} className="chip">{f}</span>)}</div> : null}
      {/* To'lash amaliyoti alohida «Obuna va to'lov» ekranida — bu yerda faqat
          holat. onManage berilsa (Sozlamalarда), o'sha ekranga o'tkazadi. */}
      {onManage ? (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={onManage}><Ic d={I.money} s={16} /> Hisobni to&apos;ldirish</button>
        </div>
      ) : null}
    </div>
  );
}

/* Obuna to'lovi — Sozlamalar → «Obuna va tarif» ichida ko'rsatiladi.
   Ilgari alohida sidebar bandi edi, lekin Sozlamalar ham xuddi shu holat
   kartasini ko'rsatardi — bir xil narsa ikki joyda turardi.
   CLICK menejerlari uchun oqim o'zgarmadi: joriy tarif → hisobni to'ldirish
   → to'lov tarixi → ommaviy oferta.
   DIQQAT: «settings» muddat tugaganda ham ochiq (sectionAllowed'ga qarang) —
   aks holda agentlik to'lay olmay kabinetda qamalib qolardi. */
function PlanSection({ access }: { access: any }) {
  return (
    <>
      <div className="note" style={{ marginBottom: 14 }}>
        Bu yerda siz <b>TravelorAI xizmatiga</b> — o&apos;z obunangizga to&apos;laysiz.
        Mijozlardan olingan pul «Mijoz to&apos;lovlari» bo&apos;limida.
      </div>
      <SubscriptionCard access={access} />
      <PayPlan heading="Hisobni to'ldirish" />
      <PaymentHistory />
      <div className="bill-legal">
        To&apos;lov shartlari: <a href="/offer" target="_blank" rel="noreferrer" onClick={onExternalClick("https://travelorai.com/offer")}>ommaviy oferta</a>
        {" · "}
        <a href="/pricing" target="_blank" rel="noreferrer" onClick={onExternalClick("https://travelorai.com/pricing")}>tariflar</a>
      </div>
    </>
  );
}

type PayTx = { merchantTransId: string; tariffSlug?: string | null; months: number; amount: number; state: string; paidAt?: string | null; createdAt: string };
const PAY_STATE: Record<string, { c: string; t: string }> = {
  paid: { c: "b-green", t: "To'landi" },
  prepared: { c: "b-amber", t: "Kutilmoqda" },
  created: { c: "b-grey", t: "Boshlandi" },
  cancelled: { c: "b-rose", t: "Bekor qilindi" },
};

/** To'lov tarixi — agentlikning CLICK tranzaksiyalari. */
function PaymentHistory() {
  const [rows, setRows] = useState<PayTx[] | null>(null);
  useEffect(() => {
    void agencyApi<{ items: PayTx[] }>("/payments/history").then((r) => setRows(r.success ? (r.data.items || []) : []));
  }, []);
  if (rows === null) return null;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="section-head" style={{ marginBottom: 10 }}><div><h2 style={{ fontSize: 16 }}>To&apos;lov tarixi</h2></div></div>
      <div className="card tbl-wrap">
        {rows.length ? (
          <table>
            <thead><tr><th>Sana</th><th>Tarif</th><th>Muddat</th><th className="r">Summa</th><th>Holat</th></tr></thead>
            <tbody>
              {rows.map((t) => {
                const s = PAY_STATE[t.state] || PAY_STATE.created;
                return (
                  <tr key={t.merchantTransId}>
                    <td>{formatDate(t.paidAt || t.createdAt)}</td>
                    <td>{t.tariffSlug || "—"}</td>
                    <td>{t.months} oy</td>
                    <td className="r money">{somUz(t.amount)} so&apos;m</td>
                    <td><span className={`badge2 ${s.c}`}>{s.t}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <Empty icon={I.money} text="Hali to'lov qilinmagan. Yuqorida tarifni tanlab hisobni to'ldiring." />}
      </div>
    </div>
  );
}

const somUz = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const MONTH_OPTS = [1, 3, 6, 12];

/**
 * CLICK'ning «karta bilan, saytdan chiqmasdan» kutubxonasi.
 * Bir marta yuklanadi va keshlanadi; sahifa ochilganda emas, faqat tugma
 * bosilganda — shunda CRM'ning yuklanish tezligiga ta'sir qilmaydi.
 */
let clickSdkLoading: Promise<void> | null = null;
function loadClickSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).createPaymentRequest) return Promise.resolve();
  if (!clickSdkLoading) {
    clickSdkLoading = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://my.click.uz/pay/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { clickSdkLoading = null; reject(new Error("yuklanmadi")); };
      document.head.appendChild(s);
    });
  }
  return clickSdkLoading;
}

/** Obunani CLICK orqali to'lash — tarif + muddat tanlanadi, havolaga o'tadi. */
function PayPlan({ heading = "Obunani to'lash" }: { heading?: string }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [slug, setSlug] = useState("");
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    void agencyApi<any>("/payments/plans").then((r) => {
      if (!r.success) { setEnabled(false); return; }
      setEnabled(!!r.data.clickEnabled);
      const list = Array.isArray(r.data.plans) ? r.data.plans : [];
      setPlans(list);
      if (list.length) setSlug(list[list.length > 1 ? 1 : 0].slug); // odatda "Pro"
    });
  }, []);

  // CLICK `return_url` orqali qaytarganda ?payment=<mti> keladi — natijani
  // ko'rsatamiz. Ilgari bu parametr umuman o'qilmasdi: foydalanuvchi to'lab
  // qaytardi-yu, hech qanday tasdiq ko'rmasdi.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mti = new URLSearchParams(window.location.search).get("payment");
    if (!mti) return;
    // Manzilni tozalaymiz, aks holda har yangilashda qaytadan tekshiriladi.
    window.history.replaceState({}, "", window.location.pathname);
    setBusy(true);
    setInfo("To'lov tekshirilmoqda…");
    void waitForPayment(mti);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => plans.find((p) => p.slug === slug) || null, [plans, slug]);
  const total = active ? Number(active.priceMonthlyUzs) * months : 0;

  /**
   * To'lov holatini kuzatadi. Obunani BIZ emas, CLICK'ning Complete so'rovi
   * faollashtiradi, shuning uchun natijani serverdan so'rab turamiz.
   * 3 daqiqa — QR kodni telefonda skanerlab to'lash uchun yetarli.
   */
  async function waitForPayment(mti: string) {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await agencyApi<any>(`/payments/${encodeURIComponent(mti)}`);
      if (!st.success || !st.data) continue;
      if (st.data.state === "paid") {
        setInfo("To'lov qabul qilindi ✓ Obuna faollashtirildi.");
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
      if (st.data.state === "cancelled") {
        setBusy(false); setInfo(""); setErr("To'lov bekor qilindi.");
        return;
      }
    }
    setBusy(false);
    setInfo("To'lov hali tasdiqlanmadi. To'lagan bo'lsangiz sahifani yangilang — obuna bir necha daqiqada faollashadi.");
  }

  /**
   * CLICK to'lov sahifasi ALOHIDA oynada ochiladi, CRM sahifasi tirik qoladi.
   *
   * Ilgari `window.location.href` ishlatilardi — CRM sahifasi almashtirilib,
   * to'lovni kuzatadigan hech narsa qolmasdi. Mijozlar esa ko'pincha QR kodni
   * TELEFONDA skanerlab to'laydi: u holda to'lov boshqa qurilmada tugaydi va
   * CLICK'ning `return_url`i hech qachon ishlamaydi — odam «to'ladim, lekin
   * hech narsa bo'lmadi» degan ekranda qolib ketardi.
   */
  async function pay() {
    if (!slug || busy) return;
    setBusy(true); setErr(""); setInfo("");
    const res = await agencyApi<any>("/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ tariffSlug: slug, months }),
    });
    if (!res.success) { setBusy(false); setErr(res.message || "To'lov havolasini olib bo'lmadi"); return; }
    const d = res.data;
    if (!openExternal(d.payUrl)) {
      // Yangi oyna bloklandi — hech bo'lmaganda to'lov ketsin.
      window.location.href = d.payUrl;
      return;
    }
    setInfo("To'lov oynasi ochildi. To'laganingizdan keyin shu yerda avtomatik tasdiqlanadi — oynani yopmang.");
    void waitForPayment(d.merchantTransId);
  }

  /**
   * Ikkinchi usul — karta bilan, saytdan CHIQMASDAN: to'lov oynasi CRM ustida
   * ochiladi. CLICK'ga ulanmagan odam ham to'lay oladi, faqat UZCARD/HUMO
   * kartasi bo'lsa bas. Karta ma'lumotlari bizga umuman kelmaydi — hammasi
   * CLICK kutubxonasi ichida qoladi.
   */
  async function payByCard() {
    if (!slug || busy) return;
    setBusy(true); setErr(""); setInfo("");
    const res = await agencyApi<any>("/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ tariffSlug: slug, months }),
    });
    if (!res.success) { setBusy(false); setErr(res.message || "To'lovni boshlab bo'lmadi"); return; }
    const d = res.data;

    try {
      await loadClickSdk();
    } catch {
      // Kutubxona yuklanmasa to'lovni yo'qotmaymiz — oddiy CLICK sahifasiga o'tamiz.
      window.location.href = d.payUrl;
      return;
    }

    setInfo("To'lov oynasi ochildi…");
    (window as any).createPaymentRequest(
      {
        service_id: Number(d.click.serviceId),
        merchant_id: Number(d.click.merchantId),
        merchant_user_id: d.click.merchantUserId || undefined,
        amount: Number(d.amount),
        transaction_param: d.merchantTransId,
      },
      (r: any) => { void afterCardPay(Number(r && r.status), d.merchantTransId); },
    );
  }

  /**
   * Widget holati: <0 xato, 0 yaratildi, 1 jarayonda, 2 muvaffaqiyatli.
   * Muvaffaqiyat bo'lganda ham obunani BIZNING server faollashtiradi — CLICK
   * Complete so'rovini yuborgach. Ikkalasi bir vaqtda bo'lmaydi, shuning
   * uchun holatni so'rab turamiz va faollashgach sahifani yangilaymiz.
   */
  async function afterCardPay(status: number, mti: string) {
    if (status !== 2) {
      setBusy(false); setInfo("");
      if (status < 0) setErr("To'lov amalga oshmadi. Qayta urinib ko'ring.");
      return;
    }
    setInfo("To'lov qabul qilindi, obuna faollashtirilmoqda…");
    await waitForPayment(mti);
  }

  if (enabled === null) return null;
  if (!plans.length) return null;

  return (
    <div className="sub-pay">
      <div className="sub-pay__head">{heading}</div>

      {/* CLICK kaliti hali ulanmagan bo'lsa — oqim baribir KO'RINADI (tarif,
          summa), faqat tugma o'rniga ogohlantirish. Shunda menejerlar to'liq
          to'lov oqimini ko'radi, kalit ulangach tugma darhol ishlaydi. */}
      {!enabled ? (
        <div className="sub-pay__pending">
          <b>CLICK ulanmoqda.</b> Tarif va summani tanlashingiz mumkin — «CLICK orqali to&apos;lash» tugmasi hisob ulangач faollashadi.
        </div>
      ) : null}

      <div className="sub-pay__plans">
        {plans.map((p) => (
          <button
            key={p.slug}
            type="button"
            className={`sub-pay__plan${slug === p.slug ? " on" : ""}`}
            onClick={() => setSlug(p.slug)}
          >
            <b>{p.name}</b>
            <span>{somUz(p.priceMonthlyUzs)} so&apos;m / oy</span>
          </button>
        ))}
      </div>

      <div className="sub-pay__months">
        {MONTH_OPTS.map((m) => (
          <button
            key={m}
            type="button"
            className={`sub-pay__m${months === m ? " on" : ""}`}
            onClick={() => setMonths(m)}
          >
            {m} oy
          </button>
        ))}
      </div>

      {err ? <div className="sub-card__warn" style={{ marginTop: 0 }}>{err}</div> : null}
      {info ? <div className="sub-pay__pending" style={{ marginTop: 0 }}>{info}</div> : null}

      <div className="sub-pay__foot">
        <div className="sub-pay__total">
          Jami: <b>{somUz(total)} so&apos;m</b>
        </div>
        {/* Ikkala tugma ham CLICK talabi bo'yicha turadi: birinchisi CLICK
            ilovasi orqali, ikkinchisi esa har qanday UZCARD/HUMO kartasi
            bilan — CLICK'ga ulanmagan agentlik ham to'lay olishi uchun. */}
        <div className="sub-pay__btns">
          <button
            className="btn btn-primary"
            disabled={busy || !slug || !enabled}
            title={!enabled ? "CLICK hisobi ulangach faollashadi" : undefined}
            onClick={() => void pay()}
          >
            {busy ? "Kuting…" : "CLICK orqali to'lash"}
          </button>
          <button
            className="btn"
            disabled={busy || !slug || !enabled}
            title={!enabled ? "CLICK hisobi ulangach faollashadi" : "Saytdan chiqmasdan, karta raqami bilan"}
            onClick={() => void payByCard()}
          >
            Karta bilan to&apos;lash
          </button>
        </div>
      </div>
      <div className="sub-pay__note">
        To&apos;lov o&apos;tgan zahoti obuna avtomatik faollashadi. To&apos;lov CLICK&apos;ning xavfsiz sahifasida amalga oshiriladi — karta ma&apos;lumotlari bizga saqlanmaydi. Shartlar — <a href="/offer" target="_blank" rel="noreferrer" onClick={onExternalClick("https://travelorai.com/offer")}>ommaviy oferta</a>.
      </div>
    </div>
  );
}

const TEAM_ROLE_LABEL: Record<string, string> = { owner: "Egasi", manager: "Menejer", agent: "Agent", accountant: "Buxgalter" };
// Jamoa: egasi xodim qo'shadi, rol beradi; xodim o'z email/paroli bilan kiradi.
// Backend xodimni AgencyMember orqali topadi (agencyPlan middleware).
// false — «Tez orada ishga tushadi» kartasi ko'rinadi, xodim qo'shib bo'lmaydi.
// Kod, backend va baza joyida; yoqish uchun true qilish kifoya.
const TEAM_LIVE: boolean = false;

function AddMember({ onClose, onAdded }: any) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent"); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setErr("Ism kiriting."); return; }
    if (password.length < 6) { setErr("Parol kamida 6 belgi bo'lsin."); return; }
    setBusy(true); setErr("");
    const r = await agencyApi("/team", { method: "POST", body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password }) });
    setBusy(false);
    if (r.success) { await onAdded?.(); onClose(); }
    else setErr(r.message || "Qo'shib bo'lmadi.");
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Xodim qo&apos;shish</h2>
        <p className="sub" style={{ marginBottom: 14 }}>Xodim shu email va parol bilan kabinetga kiradi. Parolni unga bering.</p>
        <form onSubmit={submit}>
          <div className="fld"><label>Ism *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ism Familiya" /></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld"><label>Email *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="xodim@email.com" /></div>
            <div className="fld"><label>Rol *</label><select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="manager">Menejer</option><option value="agent">Agent</option><option value="accountant">Buxgalter</option>
            </select></div>
          </div>
          <div className="fld"><label>Parol *</label><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="kamida 6 belgi" /></div>
          {err ? <div className="note note-err" style={{ marginBottom: 10 }}>{err}</div> : null}
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Qo'shilyapti..." : "Qo'shish"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamSection({ access }: any) {
  const canManage = !!access?.canManageTeam;
  const hasTeamCap = !!access?.caps?.team;
  const readOnly = !!access?.readOnly;
  const [members, setMembers] = useState<any[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [note, setNote] = useState("");
  const load = async () => {
    const r = await agencyApi<{ items: any[] }>("/team");
    setMembers(r.success ? (r.data.items || []) : []);
  };
  useEffect(() => { if (TEAM_LIVE) void load(); }, []);
  async function changeRole(id: string, role: string) {
    const r = await agencyApi(`/team/${id}`, { method: "PUT", body: JSON.stringify({ role }) });
    if (r.success) void load(); else setNote(r.message || "Xato");
  }
  async function remove(id: string) {
    const r = await agencyApi(`/team/${id}`, { method: "DELETE" });
    if (r.success) void load(); else setNote(r.message || "Xato");
  }

  // Hozircha "tez orada" — funksiya tayyor, lekin hali ochilmagan (eng katta tarif ham).
  if (!TEAM_LIVE) {
    return (
      <>
        {/* Sarlavha Sozlamalar bo'limi tepasida chiqadi — bu yerda takrorlanmaydi */}
        <div className="card team-lock">
          <span className="team-lock__ic"><Ic d={I.clock} s={20} /></span>
          <div><b>{SOON_LABEL}</b><span>Bir nechta xodim qo&apos;shish, rollar berish va lidlarni taqsimlash tez kunda ochiladi.</span></div>
        </div>
        {showAdd ? <AddMember onClose={() => setShowAdd(false)} onAdded={load} /> : null}
      </>
    );
  }

  return (
    <>
      {/* Sarlavha Sozlamalar bo'limi tepasida — bu yerda faqat amal tugmasi */}
      {canManage && hasTeamCap && !readOnly ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Ic d={I.plus} s={16} /> Xodim qo&apos;shish</button>
        </div>
      ) : null}
      {!hasTeamCap ? (
        <div className="card team-lock">
          <span className="team-lock__ic"><Ic d={I.lock} s={20} /></span>
          <div><b>Jamoa — Business tarifda</b><span>Bir nechta xodim qo&apos;shish, rollar berish Business tarifda ochiladi.</span></div>
        </div>
      ) : !canManage ? (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 13, color: "var(--t2)", margin: 0 }}>Sizning rolingiz: <b>{TEAM_ROLE_LABEL[access?.role] || access?.role}</b>. Jamoani faqat agentlik egasi boshqaradi.</p>
        </div>
      ) : (
        <div className="card team-list">
          {(members || []).map((m) => (
            <div className="team-row" key={m.id}>
              <span className="av-sm">{initials(m.name || m.email || "?")}</span>
              <div className="team-row__id"><b>{m.name}</b><small>{m.email || "—"}</small></div>
              {m.isOwner ? <span className="badge2 b-green">Egasi</span> : (
                <>
                  <select className="team-role" value={m.role} onChange={(e) => void changeRole(m.id, e.target.value)} disabled={readOnly}>
                    <option value="manager">Menejer</option><option value="agent">Agent</option><option value="accountant">Buxgalter</option>
                  </select>
                  <button className="team-rm" onClick={() => void remove(m.id)} disabled={readOnly} title="O'chirish" aria-label="O'chirish"><Ic d={I.trash} s={15} /></button>
                </>
              )}
            </div>
          ))}
          {members && members.length === 1 ? <div className="team-empty">Hali xodim yo&apos;q. &quot;Xodim qo&apos;shish&quot; orqali jamoa a&apos;zosini qo&apos;shing.</div> : null}
          {note ? <div className="note note-err" style={{ margin: 10 }}>{note}</div> : null}
        </div>
      )}
      {showAdd ? <AddMember onClose={() => setShowAdd(false)} onAdded={load} /> : null}
    </>
  );
}

/* ================= REVIEWS (sharh -> reyting) ================= */
type Review = { id: string; rating: number; text?: string | null; customerName?: string | null; status: string; createdAt: string };
function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, color: "#EAB308", verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= n ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4">
          <path d={I.star} />
        </svg>
      ))}
    </span>
  );
}
function Reviews({ show, readOnly }: { show: boolean; readOnly?: boolean }) {
  const [data, setData] = useState<{ reviews: Review[]; summary: { count: number; avg: number; dist: number[] } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const load = async () => {
    setLoading(true);
    const res = await agencyApi<{ reviews: Review[]; summary: { count: number; avg: number; dist: number[] } }>("/reviews");
    setLoading(false);
    if (res.success) setData(res.data);
  };
  useEffect(() => { if (show && !data) void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [show]);
  async function toggle(r: Review) {
    setBusy(r.id);
    const next = r.status === "published" ? "hidden" : "published";
    const res = await agencyApi(`/reviews/${r.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    setBusy("");
    if (res.success) await load();
  }
  const s = data?.summary;
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Mijoz sharhlari</h2><div className="sub">Sayohat «Yakunlandi»ga o&apos;tganda mijozga Telegramда ⭐ baho so&apos;rovi boradi — reyting marketplace sahifangizда ko&apos;rinadi</div></div></div>
      {loading && !data ? <div className="card" style={{ padding: 20, color: "var(--t2)" }}>Yuklanmoqda…</div> : null}
      {data ? (
        s && s.count > 0 ? (
          <>
            <div className="card" style={{ padding: 20, display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <div style={{ textAlign: "center", minWidth: 110 }}>
                <div style={{ fontSize: 44, fontWeight: 800, color: "var(--gold-ink)", lineHeight: 1, fontFamily: "var(--disp)" }}>{s.avg.toFixed(1)}</div>
                <div style={{ marginTop: 6 }}><Stars n={Math.round(s.avg)} size={17} /></div>
                <div style={{ color: "var(--t3)", fontSize: 12, marginTop: 5 }}>{s.count} ta sharh</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const c = s.dist[star - 1] || 0;
                  const pct = s.count ? Math.round((c / s.count) * 100) : 0;
                  return (
                    <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, width: 34, color: "var(--t2)", display: "inline-flex", alignItems: "center", gap: 2 }}>{star}<svg width="11" height="11" viewBox="0 0 24 24" fill="#EAB308"><path d={I.star} /></svg></span>
                      <div style={{ flex: 1, height: 8, background: "var(--canvas)", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#EAB308" }} />
                      </div>
                      <span style={{ fontSize: 12, width: 26, textAlign: "right", color: "var(--t3)" }}>{c}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card tbl-wrap">
              <table>
                <thead><tr><th>Mijoz</th><th>Baho</th><th>Sharh</th><th>Sana</th><th>Holat</th></tr></thead>
                <tbody>
                  {data.reviews.map((r) => (
                    <tr key={r.id} style={r.status === "hidden" ? { opacity: 0.5 } : undefined}>
                      <td><b>{r.customerName || "Mijoz"}</b></td>
                      <td><Stars n={r.rating} size={13} /></td>
                      <td style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>{r.text || <span style={{ color: "var(--t3)" }}>—</span>}</td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td><button className="btn btn-ghost btn-sm" disabled={readOnly || busy === r.id} onClick={() => void toggle(r)}>{r.status === "published" ? "Yashirish" : "Ko'rsatish"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: 30, textAlign: "center" }}>
            <div style={{ marginBottom: 8 }}><Stars n={0} size={22} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Hali sharhlar yo&apos;q</div>
            <div style={{ color: "var(--t2)", fontSize: 13.5, maxWidth: 470, margin: "0 auto", lineHeight: 1.6 }}>
              Telegramда bog&apos;langan mijozning sayohatini <b>«Yakunlandi»</b> bosqichiga o&apos;tkazing — bot avtomatik <b>⭐1–5</b> baho va izoh so&apos;raydi. Natija shu yerда, umumiy reyting esa marketplace&apos;dagi agentlik sahifangizда ko&apos;rinadi.
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}

/* ================= HUJJATLAR (matn shablonlarini sozlash) ================= */
function DocFld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="fld" style={{ marginBottom: 10 }}><label>{label}</label>{children}</div>;
}
function TplEditor({ title, onPreview, onReset, readOnly, children }: { title: string; onPreview: () => void; onReset: () => void; readOnly?: boolean; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <b style={{ fontFamily: "var(--disp)", fontSize: 15 }}>{title}</b>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!readOnly ? <button className="btn btn-ghost btn-sm" onClick={onReset}>Standartga qaytarish</button> : null}
          <button className="btn btn-ghost btn-sm" onClick={onPreview}>Namuna ochish</button>
        </div>
      </div>
      {children}
    </div>
  );
}
/**
 * Shartnoma matnini BAND-BANDGA tahrirlash.
 *
 * NEGA: ilgari butun shartnoma bitta katta oynada, «## » belgilari bilan
 * yozilgan holda turardi. Agentlik egasi bu belgilarni bilishi, band
 * raqamlarini (## 3., 3.1., 3.2.) qo'lda tuzatishi kerak edi — bir bandni
 * o'chirsa, qolganlarini qayta raqamlash kerak bo'lardi.
 *
 * Endi: har band alohida — sarlavhasi va matni. Raqamlar avtomatik qo'yiladi,
 * bandni yuqori/pastga ko'chirish yoki o'chirish mumkin. Saqlanish formati
 * O'ZGARMAYDI (parseBody/serializeBody), ya'ni eski shablonlar ham ochiladi.
 */
function BodySections({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const parsed = useMemo(() => parseBody(value), [value]);
  const set = (next: { intro?: string; sections?: DocSection[] }) =>
    onChange(serializeBody({ intro: next.intro ?? parsed.intro, sections: next.sections ?? parsed.sections }));

  const editSection = (i: number, patch: Partial<DocSection>) => {
    const s = parsed.sections.map((x, j) => (j === i ? { ...x, ...patch } : x));
    set({ sections: s });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= parsed.sections.length) return;
    const s = [...parsed.sections];
    [s[i], s[j]] = [s[j], s[i]];
    set({ sections: s });
  };
  const remove = (i: number) => set({ sections: parsed.sections.filter((_, j) => j !== i) });
  const add = () => set({ sections: [...parsed.sections, { title: "Yangi band", text: "" }] });

  return (
    <div className="doc-sec-wrap">
      <div className="fld">
        <label>Kirish qismi — bandlardan oldingi matn</label>
        <textarea rows={3} value={parsed.intro} disabled={readOnly}
          onChange={(e) => set({ intro: e.target.value })} />
      </div>

      <div className="doc-sec-head">
        <b>Bandlar</b>
        <small>Raqamlar avtomatik qo&apos;yiladi — qo&apos;lda yozish shart emas</small>
      </div>

      {parsed.sections.map((s, i) => (
        <div className="doc-sec" key={i}>
          <div className="doc-sec__bar">
            <span className="doc-sec__n">{i + 1}</span>
            <input className="doc-sec__title" value={s.title} disabled={readOnly} placeholder="Band sarlavhasi"
              onChange={(e) => editSection(i, { title: e.target.value })} />
            {!readOnly ? (
              <div className="doc-sec__acts">
                <button type="button" title="Yuqoriga" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" title="Pastga" disabled={i === parsed.sections.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" title="Bandni o'chirish" className="doc-sec__del" onClick={() => remove(i)}>
                  <Ic d={I.trash} s={14} />
                </button>
              </div>
            ) : null}
          </div>
          <textarea rows={Math.min(8, Math.max(2, s.text.split("\n").length + 1))} value={s.text} disabled={readOnly}
            placeholder={`${i + 1}.1. Band matnini yozing…`}
            onChange={(e) => editSection(i, { text: e.target.value })} />
        </div>
      ))}

      {!readOnly ? (
        <button type="button" className="doc-sec-add" onClick={add}>
          <Ic d={I.plus} s={15} /> Band qo&apos;shish
        </button>
      ) : null}
    </div>
  );
}

type BusinessDocumentRow = {
  id: string; number: string; type: string; status: string; title: string; customerName?: string; amount?: number; currency: string;
  issuedAt: string; dueAt?: string; signedAt?: string; paidAt?: string; currentVersion: number;
  booking?: { id: string; customerName: string; leadTour?: string } | null; _count?: { versions: number; transactions: number };
  payments?: { amount: number; paidAt: string }[];
  approvals?: { id: string; status: string; comment?: string }[];
  signatures?: { id: string; status: string; signerName: string; signerEmail: string; verifiedAt?: string }[];
  archives?: { id: string; version: number; filename: string; size: number; sha256: string; createdAt: string }[];
};

const BANK_MAPPING_FIELDS = [
  ["date", "Sana *"], ["credit", "Kirim"], ["debit", "Chiqim"], ["amount", "Umumiy summa"], ["direction", "Kirim/chiqim turi"],
  ["currency", "Valyuta"], ["counterparty", "Kontragent"], ["description", "To‘lov izohi"], ["externalId", "Bank operatsiya ID"],
] as const;

function BankStatementImportModal({ currency, accounts, onClose, onImported }: { currency: string; accounts: FinanceAccount[]; onClose: () => void; onImported: () => Promise<void> }) {
  const [fileName, setFileName] = useState(""); const [csv, setCsv] = useState(""); const [inspection, setInspection] = useState<BankCsvInspect | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}); const [accountId, setAccountId] = useState(""); const [defaultCurrency, setDefaultCurrency] = useState(currency);
  const [busy, setBusy] = useState(false); const [errorText, setErrorText] = useState("");
  async function chooseFile(file?: File) {
    if (!file) return; setErrorText(""); setInspection(null); setFileName(file.name);
    if (file.size > 8 * 1024 * 1024) { setErrorText("CSV hajmi 8 MB dan oshmasligi kerak"); return; }
    const text = await file.text(); setCsv(text); setBusy(true);
    const result = await agencyApi<BankCsvInspect>("/crm/finance/reconciliation/inspect", { method: "POST", body: JSON.stringify({ csv: text }) });
    setBusy(false);
    if (!result.success) { setErrorText(result.message || "CSV o‘qilmadi"); return; }
    setInspection(result.data); setMapping(result.data.suggestedMapping || {});
  }
  async function importCsv() {
    if (!inspection || !csv) return;
    if (!mapping.date) { setErrorText("Sana ustunini tanlang"); return; }
    if (!mapping.amount && !mapping.credit && !mapping.debit) { setErrorText("Summa yoki Kirim/Chiqim ustunini tanlang"); return; }
    setBusy(true); setErrorText("");
    const result = await agencyApi("/crm/finance/reconciliation/import", { method: "POST", body: JSON.stringify({ csv, fileName, mapping, accountId: accountId || null, currency: defaultCurrency }) });
    setBusy(false);
    if (!result.success) { setErrorText(result.message || "CSV import qilinmadi"); return; }
    await onImported(); onClose();
  }
  return <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 75, display: "grid", placeItems: "center", padding: 16 }} onClick={onClose}>
    <div className="card" style={{ width: "min(760px,100%)", maxHeight: "92vh", overflow: "auto", padding: 22 }} onClick={(event) => event.stopPropagation()}>
      <div className="section-head" style={{ margin: "0 0 14px" }}><div><h2>Bank ko‘chirmasini yuklash</h2><div className="sub">CSV ustunlarini moslang — tizim to‘lovlarni CRM bilan solishtiradi</div></div><button className="act-btn no" onClick={onClose}>×</button></div>
      {errorText ? <div className="note" style={{ marginBottom: 12, color: "#8f2a20" }}>{errorText}</div> : null}
      <div className="fld"><label>CSV fayl</label><input type="file" accept=".csv,text/csv,text/plain" onChange={(event) => void chooseFile(event.target.files?.[0])} /></div>
      {busy && !inspection ? <div className="sub" style={{ marginTop: 10 }}>CSV tekshirilmoqda…</div> : null}
      {inspection ? <>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <div className="fld"><label>Bank hisobi</label><select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Biriktirilmagan</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></div>
          <div className="fld"><label>Standart valyuta</label><select value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value)}><option>UZS</option><option>USD</option><option>EUR</option><option>RUB</option></select></div>
        </div>
        <div className="grid g3" style={{ marginTop: 10 }}>
          {BANK_MAPPING_FIELDS.map(([field, label]) => <div className="fld" key={field}><label>{label}</label><select value={mapping[field] || ""} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}><option value="">Tanlanmagan</option>{inspection.headers.map((header, index) => <option value={header} key={`${field}-${index}`}>{header}</option>)}</select></div>)}
        </div>
        {inspection.sample.length ? <div className="tbl-wrap card" style={{ marginTop: 14 }}><table><thead><tr>{inspection.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead><tbody>{inspection.sample.slice(0, 5).map((row, rowIndex) => <tr key={rowIndex}>{inspection.headers.map((_, index) => <td key={index}>{row[index] || "—"}</td>)}</tr>)}</tbody></table></div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button className="btn btn-ghost" onClick={onClose}>Bekor</button><button className="btn btn-primary" disabled={busy} onClick={() => void importCsv()}>{busy ? "Import qilinmoqda…" : "Import va solishtirish"}</button></div>
      </> : null}
    </div>
  </div>;
}
type BusinessDocumentsPayload = { documents: BusinessDocumentRow[]; totals: Record<string, number> };

function NewBusinessDocument({ leads, onClose, onSaved }: { leads: CrmLead[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState("contract"); const [bookingId, setBookingId] = useState(""); const [title, setTitle] = useState("Sayohat xizmatlari shartnomasi");
  const [amount, setAmount] = useState(""); const [currency, setCurrency] = useState("USD"); const [dueAt, setDueAt] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  function changeType(value: string) {
    setType(value); setTitle(({ contract: "Sayohat xizmatlari shartnomasi", invoice: "Hisob-faktura", voucher: "Turistik voucher", act: "Bajarilgan ishlar dalolatnomasi", other: "Hujjat" } as Record<string, string>)[value] || "Hujjat");
  }
  function chooseLead(id: string) {
    setBookingId(id); const lead = leads.find((item) => item.id === id); if (lead) { setAmount(lead.totalEstimate ? String(lead.totalEstimate) : ""); setCurrency(lead.currency || "USD"); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const lead = leads.find((item) => item.id === bookingId);
    const result = await agencyApi("/crm/business-documents", { method: "POST", body: JSON.stringify({
      type, bookingId: bookingId || null, title, amount: amount || null, currency, dueAt: dueAt || null, notes,
      customerName: lead?.customerName, content: { title, customerName: lead?.customerName || null, tour: lead?.tourTitle || null, amount: amount || null, currency, notes },
    }) });
    setBusy(false); if (!result.success) { setErr(result.message || "Hujjatni yaratib bo'lmadi"); return; }
    await onSaved(); onClose();
  }
  return <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 70, display: "grid", placeItems: "center", padding: 16 }} onClick={onClose}>
    <form className="card" style={{ width: "min(620px,100%)", padding: 22 }} onSubmit={save} onClick={(e) => e.stopPropagation()}>
      <div className="section-head" style={{ margin: "0 0 14px" }}><div><h2>Yangi hujjat</h2><div className="sub">Hujjat raqami va birinchi versiya avtomatik yaratiladi</div></div></div>
      {err ? <div className="note" style={{ color: "#8f2a20", marginBottom: 12 }}>{err}</div> : null}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fld"><label>Hujjat turi</label><select value={type} onChange={(e) => changeType(e.target.value)}><option value="contract">Shartnoma</option><option value="invoice">Hisob-faktura</option><option value="voucher">Voucher</option><option value="act">Dalolatnoma</option><option value="other">Boshqa</option></select></div>
        <div className="fld"><label>Lid / mijoz</label><select value={bookingId} onChange={(e) => chooseLead(e.target.value)}><option value="">Biriktirilmagan</option>{leads.map((lead) => <option value={lead.id} key={lead.id}>{lead.customerName} — {lead.tourTitle || "tur"}</option>)}</select></div>
        <div className="fld" style={{ gridColumn: "1 / -1" }}><label>Sarlavha</label><input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div className="fld"><label>Summa</label><input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} /></div>
        <div className="fld"><label>Valyuta</label><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option>USD</option><option>UZS</option><option>EUR</option></select></div>
        <div className="fld"><label>To&apos;lov / amal muddati</label><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
        <div className="fld" style={{ gridColumn: "1 / -1" }}><label>Izoh</label><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      {type === "invoice" ? <div className="note" style={{ marginTop: 8 }}>Hisob-faktura saqlanganda moliyada mijozdan olinadigan rejalashtirilgan kirim avtomatik yaratiladi.</div> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button><button className="btn btn-primary" disabled={busy}>{busy ? "Yaratilmoqda…" : "Hujjat yaratish"}</button></div>
    </form>
  </div>;
}

function DocumentsSection({ show, agencyId, leads, readOnly }: { show: boolean; agencyId: string; leads: CrmLead[]; readOnly?: boolean }) {
  const { me } = useAgencySession();
  const [tpl, setTpl] = useState<DocTemplates>(DEFAULT_DOC_TEMPLATES);
  const [msg, setMsg] = useState("");
  const [doc, setDoc] = useState<{ html: string; filename: string; title: string } | null>(null);
  const [copiedPh, setCopiedPh] = useState("");
  const [registry, setRegistry] = useState<BusinessDocumentsPayload>({ documents: [], totals: {} });
  const [newDocument, setNewDocument] = useState(false);
  useEffect(() => { setTpl(getTemplates(agencyId)); }, [agencyId]);
  async function loadRegistry() { const result = await agencyApi<BusinessDocumentsPayload>("/crm/business-documents"); if (result.success) setRegistry(result.data); }
  useEffect(() => { if (show) void loadRegistry(); }, [show, agencyId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function setDocumentStatus(row: BusinessDocumentRow, status: string) {
    const result = await agencyApi(`/crm/business-documents/${row.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (result.success) await loadRegistry(); else alert(result.message);
  }
  async function addDocumentPayment(row: BusinessDocumentRow) {
    const paid = (row.payments || []).reduce((sum, item) => sum + item.amount, 0);
    const amount = window.prompt(`To'lov summasi (${row.currency}). Qoldiq: ${Math.max(0, Number(row.amount || 0) - paid)}`); if (!amount) return;
    const result = await agencyApi(`/crm/business-documents/${row.id}/payments`, { method: "POST", body: JSON.stringify({ amount }) });
    if (result.success) await loadRegistry(); else alert(result.message);
  }
  async function makeDocumentPdf(row: BusinessDocumentRow) {
    const result = await agencyApi<{ dataUrl: string }>(`/crm/business-documents/${row.id}/pdf`, { method: "POST" });
    if (!result.success) { alert(result.message); return; }
    const link = document.createElement("a"); link.href = result.data.dataUrl; link.download = `${row.number}.pdf`; document.body.appendChild(link); link.click(); link.remove();
    await loadRegistry();
  }
  async function submitApproval(row: BusinessDocumentRow) {
    const pending = row.approvals?.find((item) => item.status === "pending");
    const result = pending
      ? await agencyApi(`/crm/business-documents/approvals/${pending.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) })
      : await agencyApi(`/crm/business-documents/${row.id}/approval`, { method: "POST", body: JSON.stringify({ comment: "Tasdiqlash uchun yuborildi" }) });
    if (result.success) await loadRegistry(); else alert(result.message);
  }
  async function signatureFlow(row: BusinessDocumentRow) {
    const pending = row.signatures?.find((item) => item.status === "pending");
    if (pending) {
      const code = window.prompt(`${pending.signerEmail} manziliga yuborilgan 6 xonali kod:`); if (!code) return;
      const result = await agencyApi(`/crm/business-documents/signatures/${pending.id}/verify`, { method: "POST", body: JSON.stringify({ code }) });
      if (result.success) await loadRegistry(); else alert(result.message); return;
    }
    const signerEmail = window.prompt("Imzolovchi emaili:", ""); if (!signerEmail) return;
    const signerName = window.prompt("Imzolovchi F.I.Sh.:", row.customerName || row.booking?.customerName || ""); if (!signerName) return;
    const result = await agencyApi(`/crm/business-documents/${row.id}/signature`, { method: "POST", body: JSON.stringify({ signerEmail, signerName }) });
    if (result.success) { alert("Tasdiqlash kodi emailga yuborildi."); await loadRegistry(); } else alert(result.message);
  }
  function setField(type: DocType, key: string, val: string) {
    setTpl((p) => ({ ...p, [type]: { ...(p as Record<string, Record<string, string>>)[type], [key]: val } }) as DocTemplates);
    setMsg("");
  }
  async function save() {
    const result = await agencyApi("/crm/documents", { method: "PUT", body: JSON.stringify({ templates: tpl }) });
    if (!result.success) { setMsg(result.message); return; }
    saveTemplates(agencyId, tpl); setMsg("Serverga saqlandi ✓"); setTimeout(() => setMsg(""), 1800);
  }
  function resetType(type: DocType) {
    setTpl((p) => ({ ...p, [type]: JSON.parse(JSON.stringify((DEFAULT_DOC_TEMPLATES as Record<string, unknown>)[type])) }) as DocTemplates);
    setMsg("");
  }
  function preview(type: DocType) {
    saveTemplates(agencyId, tpl);
    if (!me) return;
    // Ko'rib chiqish ham CRM ichida — pop-up talab qilmaydi (desktopda ham ishlaydi)
    const { html, filename } = buildDocumentFile({
      type, agencyId, me,
      lead: { customerName: "Aziz Karimov (namuna)", customerPhone: "+998 90 123 45 67", customerEmail: "aziz@example.com", travelers: 2, travelDate: "2026-08-15", tourTitle: "Dubay dam olish", tourCity: "Dubay", totalEstimate: 1500, currency: "USD" },
    });
    setDoc({ html, filename, title: `${DOC_LABEL[type]} — namuna` });
  }
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Hujjatlar</h2><div className="sub">Reyestr, status va versiyalar — shartnoma va invoice bitta joyda</div></div>{!readOnly ? <button className="btn btn-primary" onClick={() => setNewDocument(true)}><Ic d={I.plus} s={16} /> Yangi hujjat</button> : null}</div>

      <div className="grid g3">
        <div className="card kpi"><div className="val">{registry.documents.length}</div><div className="lbl">Jami hujjat</div></div>
        <div className="card kpi"><div className="val">{registry.totals.signed || 0}</div><div className="lbl">Imzolangan</div></div>
        <div className="card kpi gold"><div className="val">{registry.totals.paid || 0}</div><div className="lbl">To&apos;langan invoice</div></div>
      </div>
      <div className="card tbl-wrap" style={{ marginTop: 16 }}>
        {registry.documents.length ? <table><thead><tr><th>Raqam</th><th>Hujjat / mijoz</th><th>Sana</th><th className="r">Summa</th><th>Versiya</th><th>Holat</th><th>Amal</th></tr></thead><tbody>{registry.documents.map((row) => <tr key={row.id}><td><b>{row.number}</b>{row.archives?.length ? <div className="sub">PDF v{row.archives[0].version} arxivda</div> : null}</td><td><b>{row.title}</b><div className="sub">{row.customerName || row.booking?.customerName || "Mijoz biriktirilmagan"}</div></td><td>{formatDate(row.issuedAt)}</td><td className="r money">{row.amount ? <>{formatCurrencyAmount((row.payments || []).reduce((sum, item) => sum + item.amount, 0), row.currency)} / {formatCurrencyAmount(row.amount, row.currency)}</> : "—"}</td><td>v{row.currentVersion} <span className="sub">({row._count?.versions || 1})</span></td><td><span className={`badge2 ${row.status === "paid" || row.status === "signed" ? "b-green" : row.status === "sent" || row.status === "partially_paid" ? "b-amber" : "b-grey"}`}>{({ draft: "Qoralama", sent: "Yuborilgan", partially_paid: "Qisman to'langan", signed: "Imzolangan", paid: "To'langan", cancelled: "Bekor" } as Record<string, string>)[row.status] || row.status}</span></td><td>{!readOnly && row.status !== "cancelled" ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap", minWidth: 250 }}><select value={row.status} onChange={(e) => void setDocumentStatus(row, e.target.value)} style={{ minWidth: 115 }}><option value="draft">Qoralama</option><option value="sent">Yuborildi</option><option value="signed">Imzolandi</option>{row.type === "invoice" ? <><option value="partially_paid">Qisman</option><option value="paid">To&apos;landi</option></> : null}<option value="cancelled">Bekor</option></select>{row.type === "invoice" && row.status !== "paid" ? <button className="act-btn" onClick={() => void addDocumentPayment(row)}>+ To&apos;lov</button> : null}<button className="act-btn" onClick={() => void makeDocumentPdf(row)}>PDF</button><button className="act-btn" onClick={() => void submitApproval(row)}>{row.approvals?.some((x) => x.status === "pending") ? "Tasdiqlash" : "Tasdiqqa"}</button><button className="act-btn done-btn" onClick={() => void signatureFlow(row)}>{row.signatures?.some((x) => x.status === "pending") ? "OTP kiritish" : "E-imzo"}</button></div> : "—"}</td></tr>)}</tbody></table> : <Empty icon={I.doc} text="Hali hujjat yaratilmagan." />}
      </div>

      <div className="section-head" style={{ marginTop: 22 }}><div><h2>Rekvizitlar</h2><div className="sub">STIR, bank, direktor, manzil — barcha hujjatga qo&apos;yiladi</div></div></div>
      <DocRequisitesCard agencyId={agencyId} readOnly={readOnly} />

      {/* Belgilar — bosilsa nusxalanadi, keyin matnga qo'yish mumkin.
          Ilgari faqat ro'yxat edi: qanday ishlatilishi tushunarsiz edi. */}
      <div className="card doc-ph-card">
        <div className="doc-ph-card__head">
          <b>Avtomatik to&apos;ladigan belgilar</b>
          <small>Matnga shu belgini yozsangiz — hujjat tayyorlanganda o&apos;rniga haqiqiy ma&apos;lumot qo&apos;yiladi.
            Masalan <code>{"{mijoz}"}</code> → mijozning ismi. Belgini bosib nusxalab oling.</small>
        </div>
        <div className="doc-ph-list">
          {DOC_PLACEHOLDERS.map((p) => (
            <button type="button" key={p.key} className="doc-ph" title="Nusxalash uchun bosing"
              onClick={() => { void navigator.clipboard?.writeText(p.key).then(() => { setCopiedPh(p.key); setTimeout(() => setCopiedPh(""), 1400); }).catch(() => {}); }}>
              <code>{p.key}</code>
              <span>{copiedPh === p.key ? "nusxalandi ✓" : p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <TplEditor title="Shartnoma" onPreview={() => preview("shartnoma")} onReset={() => resetType("shartnoma")} readOnly={readOnly}>
        <DocFld label="Sarlavha"><input value={tpl.shartnoma.title} onChange={(e) => setField("shartnoma", "title", e.target.value)} disabled={readOnly} /></DocFld>
        <BodySections value={tpl.shartnoma.body} readOnly={readOnly}
          onChange={(v) => setField("shartnoma", "body", v)} />
      </TplEditor>

      <TplEditor title="Hisob-faktura" onPreview={() => preview("invoice")} onReset={() => resetType("invoice")} readOnly={readOnly}>
        <DocFld label="Sarlavha"><input value={tpl.invoice.title} onChange={(e) => setField("invoice", "title", e.target.value)} disabled={readOnly} /></DocFld>
        <DocFld label="To&apos;lov izohi"><textarea rows={3} value={tpl.invoice.note} onChange={(e) => setField("invoice", "note", e.target.value)} disabled={readOnly} /></DocFld>
      </TplEditor>

      {!readOnly ? (
        <div style={{ position: "sticky", bottom: 0, background: "var(--canvas)", padding: "12px 0 4px", display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={() => void save()}>Barchasini saqlash</button>
          {msg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</span> : null}
          <span style={{ color: "var(--t3)", fontSize: 12, marginLeft: "auto" }}>«Namuna ochish» — o&apos;zgarishlarni saqlab, chop etish oynasini ko&apos;rsatadi</span>
        </div>
      ) : null}
      {doc ? <DocViewer {...doc} onClose={() => setDoc(null)} /> : null}
      {newDocument ? <NewBusinessDocument leads={leads} onClose={() => setNewDocument(false)} onSaved={loadRegistry} /> : null}
    </section>
  );
}

/* Hujjat rekvizitlari — agentlikning huquqiy ma'lumoti (localStorage'да saqlanadi) */
function DocRequisitesCard({ agencyId, readOnly }: { agencyId: string; readOnly?: boolean }) {
  const [r, setR] = useState<DocRequisites>(EMPTY_REQUISITES);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setR(getRequisites(agencyId)); }, [agencyId]);
  function set(k: keyof DocRequisites, v: string) { setR((p) => ({ ...p, [k]: v })); setSaved(false); }
  async function save() {
    const result = await agencyApi("/crm/documents", { method: "PUT", body: JSON.stringify({ requisite: r }) });
    if (!result.success) { alert(result.message); return; }
    saveRequisites(agencyId, r); setSaved(true); setTimeout(() => setSaved(false), 1800);
  }
  const F: { k: keyof DocRequisites; label: string; ph: string; full?: boolean }[] = [
    { k: "legalName", label: "To'liq huquqiy nom", ph: "«Guli Travel» MChJ", full: true },
    { k: "director", label: "Direktor F.I.Sh.", ph: "Abdullayev Aziz" },
    { k: "stir", label: "STIR (INN)", ph: "300123456" },
    { k: "phone", label: "Telefon", ph: "+998 90 123 45 67" },
    { k: "address", label: "Yuridik manzil", ph: "Toshkent sh., Chilonzor t., ...", full: true },
    { k: "bankName", label: "Bank nomi va filiali", ph: "Ipoteka Bank, Chilonzor f." },
    { k: "account", label: "Hisob raqami (h/r)", ph: "2020 8000 ..." },
    { k: "mfo", label: "MFO", ph: "00401" },
  ];
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {F.map((f) => (
          <div className="fld" key={f.k} style={f.full ? { gridColumn: "1 / -1" } : undefined}>
            <label>{f.label}</label>
            <input value={r[f.k]} onChange={(e) => set(f.k, e.target.value)} placeholder={f.ph} disabled={readOnly} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={() => void save()} disabled={readOnly}>Saqlash</button>
        {saved ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>Saqlandi ✓</span> : null}
        <span style={{ color: "var(--t3)", fontSize: 12, marginLeft: "auto" }}>To&apos;ldirilmagan maydonlar hujjatда bo&apos;sh chiziq bo&apos;lib qoladi</span>
      </div>
    </div>
  );
}
/* Sozlamalar bo'limlari. Ilgari hammasi bitta uzun sahifada ustma-ust
   turardi — nima qayerda ekanini topish qiyin edi. Endi menyu: bo'limni
   bosasiz → faqat o'sha bo'lim ochiladi, orqaga qaytish tugmasi bilan. */
const SETTINGS_MENU: { key: string; icon: string; label: string; desc: string }[] = [
  { key: "plan", icon: I.money, label: "Obuna va to'lov", desc: "Joriy tarif, amal muddati, hisobni to'ldirish va to'lov tarixi" },
  { key: "profile", icon: I.box, label: "Agentlik ma'lumotlari", desc: "Nomi, logotipi, telefoni va tavsifi" },
  { key: "links", icon: I.send, label: "Ulanishlar", desc: "Telegram bot va Instagram Direct" },
  { key: "team", icon: I.users, label: "Jamoa va rollar", desc: "Xodimlarni qo'shish, huquqlarni belgilash" },
  { key: "account", icon: I.lock, label: "Hisob", desc: "Tizimdan chiqish" },
];

function Settings({ show, agency, go, refresh, logout, access, readOnly }: any) {
  const [tab, setTab] = useState("");
  const active = SETTINGS_MENU.find((m) => m.key === tab);

  // Bo'limdan chiqilganda menyuga qaytamiz (masalan boshqa bo'limga o'tib kelsa)
  useEffect(() => { if (!show) setTab(""); }, [show]);

  return (
    <section className={`view${show ? " active" : ""}`}>
      {!active ? (
        <>
          <div className="section-head"><div><h2>Sozlamalar</h2><div className="sub">Kerakli bo&apos;limni tanlang</div></div></div>
          <div className="set-menu">
            {SETTINGS_MENU.map((m) => (
              <button type="button" key={m.key} className="set-item" aria-label={`${m.label} — ${m.desc}`} onClick={() => setTab(m.key)}>
                <span className="set-item__ic"><Ic d={m.icon} s={18} /></span>
                <span className="set-item__tx">
                  <b>{m.label}</b>
                  <small>{m.desc}</small>
                </span>
                <span className="set-item__go" aria-hidden><Ic d="M9 6l6 6-6 6" s={16} /></span>
              </button>
            ))}
          </div>
          <div style={{ height: 16 }} />
        </>
      ) : (
        <>
          <div className="section-head">
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <button type="button" className="set-back" onClick={() => setTab("")} aria-label="Sozlamalarga qaytish">
                <Ic d="M15 6l-6 6 6 6" s={17} />
              </button>
              <div style={{ minWidth: 0 }}>
                <h2>{active.label}</h2>
                <div className="sub">{active.desc}</div>
              </div>
            </div>
          </div>

          {/* Obuna to'lovi ilgari alohida sidebar bandida edi va bu yerda faqat
              holat kartasi turardi — bir xil narsa ikki joyda. Endi to'liq oqim
              shu yerda: holat → to'lash → tarix → huquqiy havolalar. */}
          {tab === "plan" ? <PlanSection access={access} /> : null}
          {tab === "profile" ? <ProfileForm agency={agency} refresh={refresh} readOnly={readOnly} /> : null}
          {tab === "links" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <TelegramCard go={go} />
              <InstagramCard go={go} />
              <WhatsappCard go={go} />
            </div>
          ) : null}
          {tab === "team" ? <TeamSection access={access} /> : null}
          {tab === "account" ? (
            <div className="card" style={{ padding: 18, display: "grid", gap: 12 }}>
              <div style={{ color: "var(--t2)", fontSize: 13.5, lineHeight: 1.6 }}>
                Hisobdan chiqsangiz, keyingi kirishda emailingiz va parolingiz qayta so&apos;raladi.
                Ma&apos;lumotlaringiz saqlanib qoladi.
              </div>
              <div>
                <button className="btn btn-ghost" onClick={() => void logout()}><Ic d={I.out} s={16} /> Chiqish</button>
              </div>
            </div>
          ) : null}
          <div style={{ height: 16 }} />
        </>
      )}
    </section>
  );
}

/* ================= ADD LEAD MODAL ================= */
function AddLead({ onClose, onCreated }: any) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [tour, setTour] = useState(""); const [sum, setSum] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState("offline"); // mijoz qayerdan keldi
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setErr("Mijoz ismini kiriting."); return; }
    setBusy(true); setErr("");
    const res = await agencyApi("/leads", {
      method: "POST",
      body: JSON.stringify({
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        leadTour: tour.trim() || undefined,
        totalEstimate: sum ? sum.replace(/[^\d]/g, "") : undefined,
        source: src,
      }),
    });
    setBusy(false);
    if (res.success) { await onCreated?.(); onClose(); }
    else setErr(res.message || "Lid qo'shib bo'lmadi.");
  }
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,42,30,.42)", backdropFilter: "blur(3px)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: "min(480px,100%)", padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 12px" }}><div><h2>Yangi lid qo&apos;shish</h2><div className="sub">Instagram/telefondan kelgan mijozni ham shu yerda yuriting</div></div></div>
        {err ? <div className="note" style={{ marginBottom: 12, background: "var(--rose-soft)", color: "#8f2a20", borderColor: "#f3c9c4" }}>{err}</div> : null}
        <form onSubmit={save}>
          <div className="fld"><label>Mijoz ismi *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Aziz Karimov" /></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld"><label>Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998..." /></div>
            <div className="fld"><label>Summa ($)</label><input value={sum} onChange={(e) => setSum(e.target.value)} placeholder="masalan 800" /></div>
          </div>
          <div className="fld"><label>Tur / yo&apos;nalish</label><input value={tour} onChange={(e) => setTour(e.target.value)} placeholder="Masalan: Dubay 5 kun" /></div>
          <div className="fld">
            <label>Qayerdan keldi (manba)</label>
            <select value={src} onChange={(e) => setSrc(e.target.value)}>
              {LEAD_SOURCE_OPTIONS.map((sv) => <option key={sv} value={sv}>{LEAD_SOURCE_LABEL[sv]}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Qo'shilmoqda..." : "Qo'shish"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= ADD TOUR MODAL ================= */
/* Joy qidirish (OSM Nominatim) — marshrut va kun rejasida bir xil ishlaydi */
type GeoPlace = { name: string; lat: number; lng: number };
function PlacePicker({ onPick, onError, placeholder, small }: {
  onPick: (place: GeoPlace) => void;
  onError?: (message: string) => void;
  placeholder?: string;
  small?: boolean;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<(GeoPlace & { full?: string })[]>([]);

  async function search() {
    const term = q.trim();
    if (term.length < 2 || busy) return;
    setBusy(true); setHits([]);
    const res = await agencyApi<{ items: (GeoPlace & { full?: string })[] }>(`/geocode?q=${encodeURIComponent(term)}`);
    setBusy(false);
    if (!res.success) { onError?.(res.message || "Manzil topilmadi"); return; }
    const items = res.data.items || [];
    if (!items.length) onError?.(`«${term}» topilmadi. Boshqacha yozib ko'ring (masalan inglizcha).`);
    setHits(items);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          placeholder={placeholder || "Joy nomi — masalan: Masjid al-Haram"}
          style={{ flex: 1, minWidth: 0, ...(small ? { padding: "8px 10px", fontSize: 13.5 } : {}) }}
        />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || q.trim().length < 2} onClick={() => void search()}>
          {busy ? "Qidirilmoqda…" : "Qidirish"}
        </button>
      </div>
      {hits.length ? (
        <div className="card" style={{ marginTop: 8, padding: 6 }}>
          {hits.map((h, i) => (
            <button
              key={`${h.lat}-${h.lng}-${i}`}
              type="button"
              onClick={() => { onPick({ name: h.name, lat: h.lat, lng: h.lng }); setHits([]); setQ(""); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 11px", background: "transparent", border: 0, borderRadius: 8, color: "inherit", cursor: "pointer", fontSize: 14 }}
            >
              <b>{h.name}</b>
              {h.full && h.full !== h.name ? <small style={{ display: "block", marginTop: 2, opacity: 0.6, fontSize: 12.5 }}>{h.full}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Tanlov ro'yxatlari — filtrlar aniq ishlashi uchun erkin matn EMAS.
   Yo'nalish/shahar YAGONA manbadan (lib/travelData REGIONS) olinadi — katalog
   filtri ham shu manbaga qaraydi, shuning uchun 100% mos keladi. */
const MEAL_PLANS: { v: string; label: string }[] = [
  { v: "", label: "Ko'rsatilmagan" },
  { v: "RO", label: "RO — ovqatsiz" },
  { v: "BB", label: "BB — nonushta" },
  { v: "HB", label: "HB — nonushta + kechki" },
  { v: "FB", label: "FB — 3 mahal" },
  { v: "AI", label: "AI — All inclusive" },
  { v: "UAI", label: "UAI — Ultra all inclusive" },
];
const HOTEL_CATS: string[] = ["", "2*", "3*", "4*", "5*", "Apartament", "Villa", "Hostel"];
const CURRENCIES: string[] = ["USD", "UZS"];
const DAY_OPTS = Array.from({ length: 30 }, (_, i) => i + 1);
const NIGHT_OPTS = Array.from({ length: 31 }, (_, i) => i);
const OTHER_CITY = "__other__";
/** Ro'yxatda yo'q davlat — erkin yozish uchun. Hech qanday yo'nalish bloklanmaydi. */
const OTHER_REGION = "__other_region__";

/** Tur shahri qaysi yo'nalishga tegishli — tahrirlashda tanlovni tiklash uchun. */
function regionKeyForCity(city?: string | null, country?: string | null): string {
  const hay = `${city || ""} ${country || ""}`.toLowerCase();
  const hit = REGIONS.find((r) => r.cities.some((c) => c.toLowerCase() === String(city || "").toLowerCase()))
    || REGIONS.find((r) => r.match.some((m) => hay.includes(m)));
  if (hit) return hit.key;
  // Ro'yxatda yo'q, lekin davlat yozilgan bo'lsa — «Boshqa davlat» rejimida ochamiz.
  return String(country || "").trim() ? OTHER_REGION : "";
}

function AddTour({ agencyId, tour, duplicate, onClose, onCreated }: any) {
  const editing = !!tour && !duplicate;
  const initRegion = regionKeyForCity(tour?.city, tour?.destinationCountry);
  const initCityKnown = initRegion && initRegion !== OTHER_REGION
    ? (regionByKey(initRegion)?.cities || []).some((c) => c.toLowerCase() === String(tour?.city || "").toLowerCase())
    : false;
  const [f, setF] = useState({
    title: duplicate && tour?.title ? `${tour.title} (nusxa)` : (tour?.title || ""), city: tour?.city || "", subtitle: tour?.subtitle || "",
    duration: tour?.duration || "", price: tour?.price || (tour?.priceMin ? `$${tour.priceMin}` : ""),
    highlights: Array.isArray(tour?.highlights) ? tour.highlights.join(", ") : "",
    mapAddress: tour?.mapAddress || "",
    // ── Dropdown bilan boshqariladigan maydonlar
    region: initRegion,
    countryText: initRegion === OTHER_REGION ? String(tour?.destinationCountry || "") : "",
    citySelect: initCityKnown ? String(tour?.city || "") : (tour?.city ? OTHER_CITY : ""),
    days: tour?.days ? String(tour.days) : "",
    nights: tour?.nights !== undefined && tour?.nights !== null ? String(tour.nights) : "",
    priceAmount: tour?.priceMin ? String(tour.priceMin) : "",
    currency: tour?.priceCurrency || "USD",
    mealPlan: tour?.mealPlan || "",
    hotelCategory: tour?.hotelCategory || "",
  });
  const [hotelIncluded, setHotelIncluded] = useState<boolean>(!!tour?.hotelIncluded);
  const [flightIncluded, setFlightIncluded] = useState<boolean>(!!tour?.flightIncluded);
  const [transferIncluded, setTransferIncluded] = useState<boolean>(!!tour?.transferIncluded);
  const [insuranceIncluded, setInsuranceIncluded] = useState<boolean>(!!tour?.insuranceIncluded);
  // Yangi tur — forma yig'iq (tezkor: 4-5 maydon + rasm). Tahrir/nusxa — batafsil ochiq.
  const [advanced, setAdvanced] = useState(!!tour);
  const [img, setImg] = useState(tour?.imageUrl || "");
  const [gallery, setGallery] = useState<string[]>(Array.isArray(tour?.images) ? tour.images : []);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  // Xizmatlar uchun tez tanlov chiplari — bosib qo'shiladi, yozib o'tirilmaydi.
  // DIQQAT: mehmonxona / aviabilet / transfer / sug'urta bu yerda YO'Q — ular
  // yuqoridagi checkbox'lar bilan belgilanadi (takror kiritishga hojat yo'q) va
  // sayt tur sahifasidagi «Nimalar kiritilgan» ro'yxatiga tushadi. doSave
  // ularni xizmatlar ro'yxatiga ham o'zi qo'shib qo'yadi.
  const HL_CHIPS = ["Gid", "Ovqat", "Viza", "Ekskursiya", "SIM-karta", "Muzey chiptalari"];
  const hlHas = (c: string) => String(f.highlights).split(",").map((s: string) => s.trim().toLowerCase()).includes(c.toLowerCase());
  const toggleHl = (c: string) => setF((p) => {
    const arr = String(p.highlights).split(",").map((s: string) => s.trim()).filter(Boolean);
    const i = arr.findIndex((x: string) => x.toLowerCase() === c.toLowerCase());
    if (i >= 0) arr.splice(i, 1); else arr.push(c);
    return { ...p, highlights: arr.join(", ") };
  });
  async function pickImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setImg(await readImage(file)); } catch (er) { setErr(er instanceof Error ? er.message : "Rasm xato"); }
  }
  // ── Marshrut nuqtalari ──
  type Stop = { name: string; lat: number; lng: number };
  const STOPS_MAX = 12;
  const [stops, setStops] = useState<Stop[]>(Array.isArray(tour?.routeStops) ? tour.routeStops : []);

  function addStop(hit: Stop) {
    if (stops.length >= STOPS_MAX) { setErr(`Marshrutga eng ko'pi ${STOPS_MAX} nuqta sig'adi.`); return; }
    setStops((p) => [...p, hit]);
    setErr("");
  }
  function moveStop(i: number, dir: -1 | 1) {
    setStops((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // ── Kun bo'yicha reja (har kun o'z joylari bilan → sahifada mini-xarita) ──
  type Day = { day: number; title: string; places: Stop[] };
  const DAY_PLACES_MAX = 8;
  const [days, setDays] = useState<Day[]>(
    Array.isArray(tour?.itinerary)
      ? tour.itinerary
          .map((d: any, i: number) => ({
            day: Number(d?.day) || i + 1,
            title: String(d?.title || d?.text || "").trim(),
            places: Array.isArray(d?.places) ? d.places : [],
          }))
          .filter((d: Day) => d.title)
      : []
  );

  const patchDay = (i: number, patch: Partial<Day>) =>
    setDays((p) => p.map((d, x) => (x === i ? { ...d, ...patch } : d)));

  function addDayPlace(i: number, place: Stop) {
    setDays((p) =>
      p.map((d, x) => (x === i && d.places.length < DAY_PLACES_MAX ? { ...d, places: [...d.places, place] } : d))
    );
    setErr("");
  }

  const GALLERY_MAX = 6;
  async function pickGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!files.length) return;
    const room = GALLERY_MAX - gallery.length;
    if (room <= 0) { setErr(`Galereyaga eng ko'pi ${GALLERY_MAX} ta rasm sig'adi.`); return; }
    try {
      const added: string[] = [];
      for (const file of files.slice(0, room)) added.push(await readImage(file));
      setGallery((p) => [...p, ...added]);
      setErr(files.length > room ? `Faqat ${room} ta rasm qo'shildi — chegara ${GALLERY_MAX} ta.` : "");
    } catch (er) { setErr(er instanceof Error ? er.message : "Rasm xato"); }
  }
  function validate() {
    if (f.title.trim().length < 3) { setErr("Tur nomi kamida 3 harf bo'lsin."); return false; }
    if (!f.region) { setErr("Yo'nalishni tanlang."); return false; }
    if (f.region === OTHER_REGION && f.countryText.trim().length < 3) { setErr("Davlat nomini yozing."); return false; }
    if (f.city.trim().length < 2) { setErr("Shaharni tanlang (yoki 'Boshqa' tanlab yozing)."); return false; }
    if (!f.days) { setErr("Necha kunlik turligini tanlang."); return false; }
    if (f.subtitle.trim().length < 3) { setErr("Qisqa tavsif kiriting."); return false; }
    setErr(""); return true;
  }
  async function doSave(publish: boolean) {
    setBusy(true); setErr("");
    // Narx: raqam + valyuta (filtr priceMin'ga qaraydi)
    const priceMin = f.priceAmount ? Number(String(f.priceAmount).replace(/[^\d]/g, "")) || undefined : undefined;
    // DIQQAT: pastda `days` nomi kun bo'yicha REJA massivi uchun ishlatiladi —
    // shuning uchun kun/kecha SONI boshqa nom bilan.
    const dayCount = f.days ? Number(f.days) : undefined;
    const nightCount = f.nights !== "" ? Number(f.nights) : undefined;
    // Davomiylik matni kun/kechadan yasaladi — qo'lda yozilmaydi (filtr toza bo'lsin)
    const duration = dayCount ? `${dayCount} kun${nightCount ? ` ${nightCount} kecha` : ""}` : String(f.duration || "").trim();
    // Yo'nalish: ro'yxatdan yoki «Boshqa davlat» — erkin yozilgan nom.
    const countryLabel = f.region === OTHER_REGION ? f.countryText.trim() : regionByKey(f.region)?.label;
    // Xizmatlar ro'yxati. Mehmonxona/Aviabilet checkbox'dan keladi — agent
    // ularni ikkinchi marta yozmaydi. Belgi olib tashlansa — ro'yxatdan ham chiqadi.
    const hlSet = String(f.highlights).split(",").map((s: string) => s.trim()).filter((s: string) => s.length >= 2);
    const syncFlag = (on: boolean, word: string) => {
      const i = hlSet.findIndex((x) => x.toLowerCase() === word.toLowerCase());
      if (on && i < 0) hlSet.unshift(word);
      if (!on && i >= 0) hlSet.splice(i, 1);
    };
    syncFlag(hotelIncluded, "Mehmonxona");
    syncFlag(flightIncluded, "Aviabilet");
    syncFlag(transferIncluded, "Transfer");
    syncFlag(insuranceIncluded, "Sug'urta");
    const highlights = hlSet.slice(0, 20);
    const body: Record<string, unknown> = {
      title: f.title.trim(), city: f.city.trim(), subtitle: f.subtitle.trim(), duration,
      priceMin, highlights,
      // Filtrlar uchun aniq qiymatlar
      destinationCountry: countryLabel || undefined,
      days: dayCount, nights: nightCount,
      priceCurrency: f.currency || undefined,
      price: priceMin ? `${f.currency === "UZS" ? "" : "$"}${priceMin}${f.currency === "UZS" ? " so'm" : ""}` : undefined,
      mealPlan: f.mealPlan || undefined,
      hotelCategory: f.hotelCategory || undefined,
      hotelIncluded,
      flightIncluded,
      transferIncluded,
      insuranceIncluded,
    };
    if (!editing || img !== (tour?.imageUrl || "")) body.imageUrl = img || null;
    body.images = gallery;
    body.mapAddress = f.mapAddress.trim();
    body.routeStops = stops;
    body.itinerary = days
      .filter((d) => d.title.trim())
      .map((d, i) => ({ day: i + 1, title: d.title.trim(), places: d.places }));
    const res = editing
      ? await agencyApi<{ id: string }>(`/tours/${tour.id}`, { method: "PUT", body: JSON.stringify(body) })
      : await agencyApi<{ id: string }>("/tours", { method: "POST", body: JSON.stringify(body) });
    if (!res.success) { setBusy(false); setConfirming(false); setErr(res.message || "Saqlab bo'lmadi."); return; }
    const tourId = editing ? tour.id : res.data.id;
    if (publish && tourId) {
      const pub = await agencyApi(`/tours/${tourId}/submit`, { method: "POST" });
      if (!pub.success) { setBusy(false); setConfirming(false); setErr(pub.message || "E'lon qilib bo'lmadi."); return; }
    }
    setBusy(false);
    pushNotif(agencyId, { kind: "tour", title: publish ? "Tur saytda e'lon qilindi" : "Tur qoralama saqlandi", sub: f.title.trim() });
    await onCreated?.(); onClose();
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 12px" }}><div><h2>{editing ? "Turni tahrirlash" : duplicate ? "Turdan nusxa" : "Yangi tur qo'shish"}</h2><div className="sub">{duplicate ? "Barcha ma'lumot nusxalandi — narx/nom/sanani o'zgartirib e'lon qiling." : "To'ldirib «E'lon qilish»ni bossangiz — tur to'g'ridan-to'g'ri saytda ko'rinadi. Yoki qoralama saqlab keyin e'lon qilasiz."}</div></div></div>
        {err ? <div className="note note-err">{err}</div> : null}
        {confirming ? (
          <div className="pub-confirm">
            <div className="pub-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg></div>
            <b>Turni e&apos;lon qilamizmi?</b>
            <p>&laquo;{f.title.trim()}&raquo; darhol travelorai.com&apos;da barcha foydalanuvchilarga ko&apos;rinadi. Keyin istalgan vaqtda tahrirlashingiz mumkin.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>Orqaga</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void doSave(true)}>{busy ? "E'lon qilinmoqda..." : "Ha, e'lon qilish"}</button>
            </div>
          </div>
        ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (validate()) setConfirming(true); }}>
          <div className="fld"><label>Tur nomi *</label><input value={f.title} onChange={set("title")} placeholder="Masalan: Dubay 5 kun" /></div>
          {/* Yo'nalish + shahar — YAGONA manbadan (travelData). Katalog filtri ham
              shu manbaga qaraydi, shuning uchun tanlangan tur filtrga aniq tushadi. */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld">
              <label>Yo&apos;nalish *</label>
              <select
                value={f.region}
                onChange={(e) => setF((p) => ({ ...p, region: e.target.value, countryText: "", citySelect: "", city: "" }))}
              >
                <option value="">Tanlang…</option>
                {REGION_GROUPS.filter((g) => g.regions.length > 0).map((g) => (
                  <optgroup key={g.group} label={g.label}>
                    {g.regions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </optgroup>
                ))}
                <optgroup label="Ro'yxatda yo'q">
                  <option value={OTHER_REGION}>Boshqa davlat…</option>
                </optgroup>
              </select>
            </div>
            {f.region === OTHER_REGION ? (
              <div className="fld"><label>Davlat nomi *</label><input value={f.countryText} onChange={set("countryText")} placeholder="Masalan: Islandiya" /></div>
            ) : (
              <div className="fld">
                <label>Shahar *</label>
                <select
                  value={f.citySelect}
                  disabled={!f.region}
                  onChange={(e) => {
                    const v = e.target.value;
                    setF((p) => ({ ...p, citySelect: v, city: v === OTHER_CITY ? "" : v }));
                  }}
                >
                  <option value="">{f.region ? "Tanlang…" : "Avval yo'nalishni tanlang"}</option>
                  {(regionByKey(f.region)?.cities || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  {f.region ? <option value={OTHER_CITY}>Boshqa shahar…</option> : null}
                </select>
              </div>
            )}
          </div>
          {f.citySelect === OTHER_CITY || f.region === OTHER_REGION ? (
            <div className="fld"><label>Shahar nomi *</label><input value={f.city} onChange={set("city")} placeholder="Masalan: Sharm-ash-Shayx" /></div>
          ) : null}

          {/* Davomiylik — raqamli tanlov. Filtr «1-3 / 4-7 / 7+ kun» aynan kun soniga qaraydi. */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld">
              <label>Necha kun *</label>
              <select value={f.days} onChange={set("days")}>
                <option value="">Tanlang…</option>
                {DAY_OPTS.map((d) => <option key={d} value={d}>{d} kun</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Necha kecha</label>
              <select value={f.nights} onChange={set("nights")}>
                <option value="">Ko&apos;rsatilmagan</option>
                {NIGHT_OPTS.map((n) => <option key={n} value={n}>{n} kecha</option>)}
              </select>
            </div>
          </div>

          <div className="fld"><label>Qisqa tavsif *</label><input value={f.subtitle} onChange={set("subtitle")} placeholder="All inclusive, aviabilet + mehmonxona" /></div>

          {/* Narx — raqam + valyuta (filtr priceMin'ga qaraydi, matnni parse qilmaydi) */}
          <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div className="fld"><label>Narx (kishi boshiga)</label><input type="number" min={0} value={f.priceAmount} onChange={set("priceAmount")} placeholder="900" /></div>
            <div className="fld">
              <label>Valyuta</label>
              <select value={f.currency} onChange={set("currency")}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Ovqatlanish va mehmonxona toifasi — standart kodlar (BB/HB/AI…) */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld">
              <label>Ovqatlanish</label>
              <select value={f.mealPlan} onChange={set("mealPlan")}>
                {MEAL_PLANS.map((m) => <option key={m.v || "none"} value={m.v}>{m.label}</option>)}
              </select>
            </div>
            <div className="fld">
              <label>Mehmonxona toifasi</label>
              <select value={f.hotelCategory} onChange={set("hotelCategory")}>
                {HOTEL_CATS.map((c) => <option key={c || "none"} value={c}>{c || "Ko'rsatilmagan"}</option>)}
              </select>
            </div>
          </div>

          {/* Kiritilganmi — tur sahifasidagi «Nimalar kiritilgan» shundan yasaladi */}
          <div className="fld" style={{ marginBottom: 12 }}>
            <label>Narxga nimalar kiritilgan</label>
            <div className="kv-checkrow">
              <label className="kv-check"><input type="checkbox" checked={hotelIncluded} onChange={(e) => setHotelIncluded(e.target.checked)} /> Mehmonxona</label>
              <label className="kv-check"><input type="checkbox" checked={flightIncluded} onChange={(e) => setFlightIncluded(e.target.checked)} /> Aviabilet</label>
              <label className="kv-check"><input type="checkbox" checked={transferIncluded} onChange={(e) => setTransferIncluded(e.target.checked)} /> Transfer</label>
              <label className="kv-check"><input type="checkbox" checked={insuranceIncluded} onChange={(e) => setInsuranceIncluded(e.target.checked)} /> Sug&apos;urta</label>
            </div>
            <small className="fld-hint">Belgilanganlari tur sahifasida «Nimalar kiritilgan» bo&apos;limida belgichalar bilan chiqadi.</small>
          </div>

          <div className="fld">
            <label>Qo&apos;shimcha xizmatlar</label>
            <input value={f.highlights} onChange={set("highlights")} placeholder="Gid, Ovqat, Viza" />
            <small className="fld-hint">Mehmonxona, aviabilet, transfer va sug&apos;urtani yuqoridagi belgilar bilan tanlaysiz — bu yerga qayta yozish shart emas.</small>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "-4px 0 2px" }}>
            {HL_CHIPS.map((c) => {
              const on = hlHas(c);
              return (
                <button type="button" key={c} onClick={() => toggleHl(c)}
                  style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary-soft)" : "var(--surface)", color: on ? "var(--primary)" : "var(--t2)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                  {on ? "✓ " : "+ "}{c}
                </button>
              );
            })}
          </div>
          <div className="fld">
            <label>Rasm (ixtiyoriy)</label>
            <label className="filepick">
              <span className="filepick-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg></span>
              <span className="filepick-tx"><b>{img ? "Boshqa rasm tanlash" : "Rasm tanlash"}</b><small>PNG yoki JPG &middot; 8 MB gacha</small></span>
              <input type="file" accept="image/*" onChange={pickImg} hidden />
            </label>
            {img ? <img className="filepick-preview" src={img} alt="" /> : null}
          </div>

          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 2 }} onClick={() => setAdvanced((v) => !v)}>
            {advanced ? "▾ Batafsil ma'lumotni yopish" : "▸ Batafsil qo'shish (ixtiyoriy) — galereya, marshrut, kun bo'yicha reja"}
          </button>
          {advanced ? (
          <>
          <div className="fld">
            <label>Galereya — {gallery.length}/{GALLERY_MAX} rasm</label>
            <label className="filepick">
              <span className="filepick-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></span>
              <span className="filepick-tx"><b>Rasm qo&apos;shish</b><small>Mehmonxona, xona, ko&apos;rinish &middot; bir vaqtda bir nechtasini tanlash mumkin</small></span>
              <input type="file" accept="image/*" multiple onChange={pickGallery} hidden />
            </label>
            {gallery.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {gallery.map((src, i) => (
                  <div key={`${src.slice(0, 24)}-${i}`} style={{ position: "relative", width: 84, height: 64, borderRadius: 10, overflow: "hidden", background: "var(--canvas)" }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <button
                      type="button"
                      onClick={() => setGallery((p) => p.filter((_, x) => x !== i))}
                      aria-label={`${i + 1}-rasmni o'chirish`}
                      style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: 0, cursor: "pointer", background: "rgba(8,20,14,.72)", color: "#fff", fontSize: 13, lineHeight: 1, display: "grid", placeItems: "center" }}
                    >×</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="fld">
            <label>Manzil — xaritada ko&apos;rsatish uchun (ixtiyoriy)</label>
            <input value={f.mapAddress} onChange={set("mapAddress")} placeholder="Masalan: Swissotel Al Maqam, Makkah" />
            <small style={{ display: "block", marginTop: 6, color: "#8aa398", fontSize: 12.5 }}>
              Mehmonxona nomi yoki aniq manzilni yozing — taklif sahifasida xarita chiqadi. Bo&apos;sh qoldirsangiz mehmonxona nomi yoki shahar ishlatiladi.
            </small>
          </div>

          <div className="fld">
            <label>Marshrut — {stops.length}/{STOPS_MAX} nuqta (ixtiyoriy)</label>
            <PlacePicker onPick={addStop} onError={setErr} placeholder="Joy nomi — masalan: Makkah yoki Samarqand" />

            {stops.length ? (
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {stops.map((s, i) => (
                  <div key={`${s.lat}-${s.lng}-${i}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: "var(--canvas)", border: "1px solid var(--border)" }}>
                    <span style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", background: "#0F5132", color: "#fff", fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center" }}>{i + 1}</span>
                    <input
                      value={s.name}
                      onChange={(e) => setStops((p) => p.map((x, xi) => (xi === i ? { ...x, name: e.target.value } : x)))}
                      aria-label={`${i + 1}-nuqta nomi`}
                      title="Nomni o'zgartirishingiz mumkin — mijoz aynan shuni ko'radi"
                      style={{ flex: 1, minWidth: 0, padding: "5px 9px", fontSize: 14, fontFamily: "inherit", background: "var(--field-bg)", border: "1px solid var(--field-border)", borderRadius: 7, color: "var(--t1)", outline: "none" }}
                    />
                    <button type="button" onClick={() => moveStop(i, -1)} disabled={i === 0} aria-label="Yuqoriga" style={{ background: "transparent", border: 0, color: "inherit", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.25 : 0.6, padding: 3 }}>↑</button>
                    <button type="button" onClick={() => moveStop(i, 1)} disabled={i === stops.length - 1} aria-label="Pastga" style={{ background: "transparent", border: 0, color: "inherit", cursor: i === stops.length - 1 ? "default" : "pointer", opacity: i === stops.length - 1 ? 0.25 : 0.6, padding: 3 }}>↓</button>
                    <button type="button" onClick={() => setStops((p) => p.filter((_, x) => x !== i))} aria-label="O'chirish" style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", opacity: 0.45, padding: 3, display: "inline-flex" }}><Ic d={I.trash} s={14} /></button>
                  </div>
                ))}
              </div>
            ) : null}

            <small style={{ display: "block", marginTop: 6, color: "#8aa398", fontSize: 12.5 }}>
              Borib keladigan joylarni tartib bilan qo&apos;shing — taklif sahifasida ular xaritada raqamlanib, chiziq bilan bog&apos;lanadi.
            </small>
          </div>

          <div className="fld">
            <label>Kun bo&apos;yicha reja — {days.length} kun (ixtiyoriy)</label>

            {days.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {days.map((d, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 12, background: "var(--canvas)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                      <span style={{ flex: "0 0 auto", padding: "5px 11px", borderRadius: 999, background: "#0F5132", color: "#fff", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{i + 1}-kun</span>
                      <input
                        value={d.title}
                        onChange={(e) => patchDay(i, { title: e.target.value })}
                        placeholder="Masalan: Masjid al-Haram, umra amallari"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button type="button" onClick={() => setDays((p) => p.filter((_, x) => x !== i))} aria-label={`${i + 1}-kunni o'chirish`} style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", opacity: 0.45, padding: 3, display: "inline-flex" }}>
                        <Ic d={I.trash} s={14} />
                      </button>
                    </div>

                    {d.places.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 9 }}>
                        {d.places.map((pl, pi) => (
                          <span key={`${pl.lat}-${pl.lng}-${pi}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 11px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13 }}>
                            {pl.name}
                            <button type="button" onClick={() => patchDay(i, { places: d.places.filter((_, y) => y !== pi) })} aria-label={`${pl.name} — o'chirish`} style={{ width: 17, height: 17, borderRadius: "50%", border: 0, cursor: "pointer", background: "rgba(0,0,0,.28)", color: "inherit", fontSize: 12, lineHeight: 1, display: "grid", placeItems: "center" }}>×</button>
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {d.places.length < DAY_PLACES_MAX ? (
                      <PlacePicker small onPick={(place) => addDayPlace(i, place)} onError={setErr} placeholder="Shu kunning joyi — mehmonxona, masjid, ziyoratgoh" />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: days.length ? 10 : 0 }}
              onClick={() => setDays((p) => [...p, { day: p.length + 1, title: "", places: [] }])}
            >
              <Ic d={I.plus} s={14} /> Kun qo&apos;shish
            </button>

            <small style={{ display: "block", marginTop: 6, color: "#8aa398", fontSize: 12.5 }}>
              Har bir kunga joy qo&apos;shsangiz — taklif sahifasida o&apos;sha kun uchun <b>alohida kichik xarita</b> chiziladi va mijoz qayerda bo&apos;lishini ko&apos;radi.
            </small>
          </div>
          </>
          ) : null}

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button>
            <button type="button" className="btn btn-ghost" disabled={busy} title="Saqlanadi, lekin saytda ko'rinmaydi — keyin tugatib e'lon qilasiz" onClick={() => { if (validate()) void doSave(false); }}>Qoralama saqlash</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{editing ? "Saqlash va e'lon qilish" : "E'lon qilish"}</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

/* ================= CONFIRM DELETE ================= */
function ConfirmDelete({ tour, busy, err, onCancel, onConfirm }: any) {
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div className="card modal-card" style={{ maxWidth: 430 }} onClick={(e) => e.stopPropagation()}>
        <div className="section-head" style={{ margin: "0 0 10px" }}><div><h2>Turni o&apos;chirish</h2><div className="sub">&laquo;{tour.title}&raquo; butunlay o&apos;chiriladi. Buni qaytarib bo&apos;lmaydi.</div></div></div>
        {err ? <div className="note note-err">{err}</div> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Bekor</button>
          <button className="btn btn-danger" disabled={busy} onClick={onConfirm}>{busy ? "O'chirilmoqda..." : "O'chirish"}</button>
        </div>
      </div>
    </div>
  );
}

/* ================= TELEGRAM CHAT (drawer) ================= */
function TelegramChat({ lead, onClose, onBack, readOnly }: { lead: CrmLead; onClose: () => void; onBack?: () => void; readOnly?: boolean }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [canReply, setCanReply] = useState(false);
  // Bitta chat oynasi ikkala kanalga xizmat qiladi — sarlavha va xato
  // matnlari shunga qarab o'zgaradi.
  const [channel, setChannel] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TgTpl[]>([]);
  const [waTemplates, setWaTemplates] = useState<{ id: string; name: string; language: string; status: string }[]>([]);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const isIg = channel === "instagram";
  const isWa = channel === "whatsapp";

  useEffect(() => {
    void agencyApi<{ templates: TgTpl[] }>("/telegram/config").then((r) => { if (r.success) setTemplates(r.data.templates || []); });
  }, []);
  useEffect(() => {
    if (!isWa) return;
    void agencyApi<{ templates: { id: string; name: string; language: string; status: string }[] }>("/whatsapp/templates").then((r) => {
      if (r.success) setWaTemplates((r.data.templates || []).filter((t) => t.status === "APPROVED"));
    });
  }, [isWa]);

  const load = async () => {
    const res = await agencyApi<{ messages: any[]; canReply: boolean; channel: string | null }>(`/telegram/messages?bookingId=${encodeURIComponent(lead.id)}`);
    if (res.success) { setMessages(res.data.messages || []); setCanReply(!!res.data.canReply); setChannel(res.data.channel || null); }
    setLoading(false);
  };
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 8000); return () => window.clearInterval(t); }, [lead.id]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !selectedWaTemplate) return;
    setBusy(true); setSendErr("");
    const selected = waTemplates.find((t) => t.name === selectedWaTemplate);
    const res = await agencyApi("/telegram/reply", { method: "POST", body: JSON.stringify({ bookingId: lead.id, text: text.trim(), templateName: selectedWaTemplate || undefined, language: selected?.language || undefined }) });
    setBusy(false);
    if (res.success) { setText(""); setSelectedWaTemplate(""); await load(); }
    // Instagram'da eng ko'p uchraydigan holat — 24 soatlik oyna yopilgani.
    // Ilgari xato jimgina yutilardi va agent xabar ketdi deb o'ylardi.
    else setSendErr(res.message || "Yuborib bo'lmadi");
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card tg-chat" onClick={(e) => e.stopPropagation()}>
        <div className="tg-chat-head">
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {onBack ? <button className="icon-btn" onClick={onBack} aria-label="Orqaga" title="Mijoz ma'lumotiga qaytish"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button> : null}
            <div style={{ minWidth: 0 }}><b>{lead.customerName}</b><small>{isIg ? "Instagram Direct" : isWa ? "WhatsApp Cloud API" : "Telegram suhbat"}</small></div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Yopish"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
        </div>
        <div className="tg-chat-body" ref={bodyRef}>
          {loading ? <div className="tg-empty">Yuklanmoqda…</div>
            : messages.length === 0 ? <div className="tg-empty">Hozircha xabar yo&apos;q</div>
            : messages.map((m) => (
              <div key={m.id} className={`tg-msg ${m.direction === "out" ? "out" : "in"}`}>
                <div className="tg-bubble">{m.text}</div>
                <span className="tg-meta">{m.fromName || ""} · {timeAgo(m.createdAt)}</span>
              </div>
            ))}
        </div>
        {readOnly ? (
          <div className="tg-noreply">Faqat o&apos;qish rejimi — obuna muddati tugagan, javob yozib bo&apos;lmaydi.</div>
        ) : canReply ? (
          <div className="tg-reply">
            {sendErr ? <div className="tg-senderr">{sendErr}</div> : null}
            {isWa && waTemplates.length ? <div className="tg-quick">{waTemplates.map((t) => <button key={t.id} type="button" className={`tg-quick-btn${selectedWaTemplate === t.name ? " active" : ""}`} onClick={() => setSelectedWaTemplate(t.name)}>{t.name}</button>)}</div>
              : templates.length ? <div className="tg-quick">{templates.map((t) => <button key={t.id} type="button" className="tg-quick-btn" onClick={() => setText(t.text)}>{t.title}</button>)}</div> : null}
            <form className="tg-chat-input" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Javob yozing…" />
              <button type="submit" className="btn btn-primary" disabled={busy || (!text.trim() && !selectedWaTemplate)}>Yuborish</button>
            </form>
          </div>
        ) : (
          <div className="tg-noreply">
            {isIg
              ? "Instagram ulanmagan — Sozlamalar → Ulanishlar bo'limidan ulang."
              : isWa ? "WhatsApp ulanmagan — WhatsApp bo‘limidan Cloud API’ni ulang."
              : "Bu lidda yozishma kanali yo'q"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= TELEGRAM (settings card + dedicated page) ================= */
const TG_ICON = "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z";

function TelegramCard({ go }: { go: (v: string) => void }) {
  const [st, setSt] = useState<{ connected: boolean; username: string | null } | null>(null);
  useEffect(() => {
    void agencyApi<{ connected: boolean; username: string | null }>("/telegram").then((r) => {
      if (r.success) setSt({ connected: r.data.connected, username: r.data.username });
    });
  }, []);
  return (
    <button className="int-card" onClick={() => go("telegram")}>
      <span className="int-ic tg"><Ic d={TG_ICON} s={22} /></span>
      <span className="int-main">
        <b>Telegram bot</b>
        <small>{st?.connected ? `Ulangan · @${st.username}` : "Ulash · salomlashish, buyruqlar, shablonlar"}</small>
      </span>
      {st?.connected ? <span className="int-badge">Faol</span> : null}
      <svg className="int-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  );
}

/* ================= INSTAGRAM (settings card + dedicated page) ================= */
const IG_ICON = "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z";
const WA_ICON = "M17.5 14.4c-.3-.15-1.7-.85-2-.95-.26-.1-.45-.15-.64.15-.19.28-.73.94-.9 1.13-.16.19-.33.21-.61.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.29-.02-.44.13-.59.13-.13.3-.34.44-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.08-.15-.64-1.55-.88-2.12-.23-.55-.47-.48-.64-.49h-.55c-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.38s1.02 2.76 1.17 2.95c.14.19 2.01 3.08 4.88 4.32.68.29 1.21.47 1.63.6.68.22 1.3.19 1.79.11.55-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34zM12 2a10 10 0 0 0-8.6 15.06L2 22l5.06-1.33A10 10 0 1 0 12 2z";

/* Hali ochilmagan funksiyalar uchun yagona belgi. Ilgari har joyda har xil
   yozilardi («Tez orada», «Tez orada ishga tushadi», «tasdiqdan o'tmoqda») —
   agentlik nima kutayotganini tushunmasdi. */
const SOON_LABEL = "Ishga tushirilmoqda";

type IgState = { configured: boolean; connected: boolean; username: string | null; welcome: string; expiresAt: string | null };

function InstagramCard({ go }: { go: (v: string) => void }) {
  const [st, setSt] = useState<IgState | null>(null);
  useEffect(() => {
    void agencyApi<IgState>("/instagram").then((r) => { if (r.success) setSt(r.data); });
  }, []);
  return (
    <button className="int-card" onClick={() => go("instagram")}>
      <span className="int-ic ig"><Ic d={IG_ICON} s={22} /></span>
      <span className="int-main">
        <b>Instagram Direct</b>
        <small>
          {st?.connected
            ? `Ulangan · @${st.username}`
            : st && !st.configured
              ? "Direct xabarlar avtomatik lid bo'ladi — ulanish tayyorlanmoqda"
              : "Ulash · Direct xabarlar avtomatik lid bo'ladi"}
        </small>
      </span>
      {st?.connected
        ? <span className="int-badge">Faol</span>
        : st && !st.configured
          ? <span className="int-badge int-badge--soon">{SOON_LABEL}</span>
          : null}
      <svg className="int-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  );
}

function WhatsappCard({ go }: { go: (v: string) => void }) {
  const [st, setSt] = useState<{ connected: boolean; displayPhone?: string } | null>(null);
  useEffect(() => { void agencyApi<{ connected: boolean; displayPhone?: string }>("/whatsapp").then((r) => { if (r.success) setSt(r.data); }); }, []);
  return (
    <button className="int-card" onClick={() => go("whatsapp")}>
      <span className="int-ic wa"><Ic d={WA_ICON} s={22} /></span>
      <span className="int-main">
        <b>WhatsApp Business</b>
        <small>{st?.connected ? `Ulangan · ${st.displayPhone || "Cloud API"}` : "Ulash · xabarlar avtomatik lid bo‘ladi"}</small>
      </span>
      {st?.connected ? <span className="int-badge">Faol</span> : null}
      <svg className="int-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  );
}

function InstagramPage({ show, go, readOnly }: { show: boolean; go: (v: string) => void; readOnly?: boolean }) {
  const [st, setSt] = useState<IgState | null>(null);
  const [welcome, setWelcome] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await agencyApi<IgState>("/instagram");
    if (res.success) { setSt(res.data); setWelcome(res.data.welcome || ""); }
  };
  useEffect(() => { if (show) void load(); }, [show]);
  // Ulanish tizim brauzerida ochiladi (desktop ilovada ham) — foydalanuvchi
  // qaytib kelganda holatni qayta o'qiymiz, aks holda «Ulanmagan» bo'lib turardi.
  useEffect(() => {
    if (!show) return;
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [show]);

  async function connect() {
    setBusy("connect"); setErr("");
    const res = await agencyApi<{ url: string }>("/instagram/authorize");
    setBusy("");
    if (!res.success) { setErr(res.message || "Ulash manzilini olib bo'lmadi"); return; }
    // openExternal: desktop ilovada Tauri window.open'ni bloklaydi, shuning
    // uchun tizim brauzerida ochamiz. Brauzerda oddiy window.open ishlaydi.
    if (res.data.url) openExternal(res.data.url);
    else setErr("Ulash manzili bo'sh keldi");
  }
  async function disconnect() {
    setBusy("disconnect"); setErr("");
    const res = await agencyApi("/instagram/disconnect", { method: "POST" });
    setBusy("");
    if (res.success) await load(); else setErr(res.message || "Uzib bo'lmadi");
  }
  async function saveWelcome() {
    setBusy("welcome"); setMsg("");
    const res = await agencyApi("/instagram/welcome", { method: "PUT", body: JSON.stringify({ text: welcome }) });
    setBusy("");
    setMsg(res.success ? "Saqlandi ✓" : (res.message || "Xato"));
  }

  if (!show) return null;
  const expiry = st?.expiresAt ? new Date(st.expiresAt) : null;

  return (
    <section>
      <div className="section-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button type="button" className="set-back" onClick={() => go("settings")} aria-label="Sozlamalarga qaytish">
            <Ic d="M15 6l-6 6 6 6" s={17} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h2>Instagram Direct</h2>
            <div className="sub">Direct xabarlar avtomatik lid bo&apos;ladi</div>
          </div>
        </div>
      </div>

      <div className="card tg-set">
        <div className="tg-set-top">
          <div className="tg-ic ig"><Ic d={IG_ICON} s={22} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>Instagram biznes akkaunt</b>
            {st?.connected
              ? <small style={{ color: "var(--primary)" }}>Ulangan · @{st.username}</small>
              : <small>Akkauntingizga kelgan Direct xabarlar CRM&apos;da ko&apos;rinadi</small>}
          </div>
          {st?.connected && !readOnly
            ? <button className="btn btn-ghost btn-sm" disabled={busy === "disconnect"} onClick={() => void disconnect()}>{busy === "disconnect" ? "..." : "Uzish"}</button>
            : null}
        </div>

        {err ? <div className="note note-err" style={{ margin: "12px 0 0" }}>{err}</div> : null}

        {st && !st.configured ? (
          <div className="tg-connect">
            <div className="note" style={{ margin: 0 }}>
              <b>{SOON_LABEL}.</b> Integratsiya tayyor va Meta tomonida ro&apos;yxatdan
              o&apos;tkazilmoqda. Ishga tushgach shu yerda «Ulash» tugmasi paydo bo&apos;ladi —
              sizdan qo&apos;shimcha hech narsa talab qilinmaydi.
              <br /><br />
              Shu vaqt ichida mijozlar bilan <b>Telegram</b> orqali ishlashingiz mumkin —
              u to&apos;liq ishlaydi va xabarlar avtomatik lid bo&apos;lib tushadi.
            </div>
          </div>
        ) : !st?.connected ? (
          <div className="tg-connect">
            <div className="tg-hint">
              Ulash uchun Instagram <b>biznes</b> yoki <b>creator</b> akkaunti kerak
              (Instagram → Sozlamalar → Akkaunt turi). Facebook sahifasi shart emas.
            </div>
            <button className="btn btn-primary" disabled={busy === "connect" || readOnly} onClick={() => void connect()}>
              {busy === "connect" ? "Ochilmoqda..." : "Instagram'ni ulash"}
            </button>
          </div>
        ) : (
          <>
            <div className="tg-welcome">
              <label>Avtomatik salomlashish (mijozning birinchi xabaridan keyin yuboriladi)</label>
              <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={2} disabled={readOnly}
                placeholder="Salom! Xabaringiz uchun rahmat, tez orada bog'lanamiz." />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === "welcome" || readOnly} onClick={() => void saveWelcome()}>{busy === "welcome" ? "..." : "Saqlash"}</button>
                {msg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</span> : null}
              </div>
            </div>
            <div className="fld-hint" style={{ marginTop: 14 }}>
              <b>Bilib qo&apos;ying:</b> Instagram qoidasiga ko&apos;ra mijozga faqat uning oxirgi
              xabaridan keyingi <b>24 soat</b> ichida javob yozish mumkin. Muddat o&apos;tsa,
              mijoz qayta yozmaguncha Direct orqali javob ketmaydi — telefon yoki
              Telegram orqali bog&apos;lanishingiz mumkin.
              {expiry ? <><br />Ulanish tokeni avtomatik yangilanadi (joriy muddat: {expiry.toLocaleDateString("uz-UZ")}).</> : null}
            </div>
          </>
        )}
      </div>
      <div style={{ height: 16 }} />
    </section>
  );
}

/* ================= TELEGRAM BROADCAST (ommaviy xabar) ================= */
function TelegramBroadcast({ tgLeads, readOnly }: { tgLeads: CrmLead[]; readOnly?: boolean }) {
  const [text, setText] = useState("");
  const [stage, setStage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [err, setErr] = useState("");
  const count = useMemo(() => (stage ? tgLeads.filter((l) => l.stage === stage).length : tgLeads.length), [tgLeads, stage]);
  const fld: any = { padding: "10px 12px", border: "1px solid var(--field-border)", background: "var(--field-bg)", color: "var(--t1)", borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none" };

  async function send() {
    setBusy(true); setErr(""); setResult(null);
    const res = await agencyApi<{ total: number; sent: number; failed: number }>("/telegram/broadcast", { method: "POST", body: JSON.stringify({ text: text.trim(), stage: stage || undefined }) });
    setBusy(false); setConfirm(false);
    if (res.success) { setResult(res.data); setText(""); }
    else setErr(res.message || "Yuborib bo'lmadi");
  }

  return (
    <div className="card" style={{ padding: 16, marginTop: 10 }}>
      <div className="section-head" style={{ margin: "0 0 10px" }}><div><h2>Ommaviy xabar (broadcast)</h2><div className="sub">Bot orqali barcha yoki tanlangan bosqichdagi lidlarga bir vaqtda xabar yuboring</div></div></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={readOnly || busy} rows={4} maxLength={3000} placeholder="Xabar matni… (masalan: Yangi Turkiya paketlari 20% chegirma bilan!)" style={{ ...fld, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <select value={stage} onChange={(e) => setStage(e.target.value)} disabled={readOnly || busy} style={fld}>
          <option value="">Barcha Telegram lidlar</option>
          {CRM_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label} bosqichi</option>)}
        </select>
        <span className="sub" style={{ fontSize: 13 }}><b>{count}</b> ta qabul qiluvchi</span>
        <div style={{ marginLeft: "auto" }}>
          {!confirm ? (
            <button className="btn btn-primary btn-sm" disabled={readOnly || busy || !text.trim() || count === 0} onClick={() => setConfirm(true)}><Ic d={TG_ICON} s={15} /> Yuborish</button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="sub" style={{ fontSize: 13 }}>{count} ta lidga yuborilsinmi?</span>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirm(false)}>Bekor</button>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void send()}>{busy ? "Yuborilmoqda…" : "Ha, yubor"}</button>
            </div>
          )}
        </div>
      </div>
      {err ? <div className="sub" style={{ color: "#F43F5E", marginTop: 8 }}>{err}</div> : null}
      {result ? <div className="sub" style={{ color: "#22C55E", marginTop: 8 }}>✅ {result.sent} ta yuborildi{result.failed ? ` · ${result.failed} ta xato` : ""} (jami {result.total} qabul qiluvchi)</div> : null}
    </div>
  );
}

function TelegramPage({ show, leads, go, readOnly }: { show: boolean; leads: CrmLead[]; go: (v: string) => void; readOnly?: boolean }) {
  const [chat, setChat] = useState<CrmLead | null>(null);
  const tgLeads = useMemo(
    () => (leads || []).filter((l) => l.source === "telegram").sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [leads]
  );
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head">
        <div className="head-back">
          <button className="kv-back" onClick={() => go("settings")} aria-label="Orqaga"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
          <div><h2>Telegram bot</h2><div className="sub">Botni to&apos;liq boshqaring — ulash, salomlashish, profil, buyruqlar va shablonlar</div></div>
        </div>
      </div>

      <fieldset disabled={readOnly} className="kv-fieldset">
        <TelegramSettings />
      </fieldset>

      <TelegramBroadcast tgLeads={tgLeads} readOnly={readOnly} />

      <div className="section-head" style={{ marginTop: 10 }}><div><h2>Telegram suhbatlar</h2><div className="sub">{readOnly ? "Faqat o'qish — obuna tugagan" : "Bot orqali kelgan lidlar — bosib javob yozing"}</div></div></div>
      <div className="card tbl-wrap">
        {tgLeads.length ? (
          <table>
            <thead><tr><th>Mijoz</th><th>Xabar / yo&apos;nalish</th><th>Bosqich</th><th>Vaqt</th><th className="r">Suhbat</th></tr></thead>
            <tbody>
              {tgLeads.map((l) => (
                <tr key={l.id}>
                  <td><div className="cell"><span className="av-sm">{initials(l.customerName)}</span><b>{l.customerName}</b></div></td>
                  <td>{l.tourTitle || l.message || "—"}</td>
                  <td><span className={`badge2 s-${l.stage}`}>{STAGE_LABEL[l.stage] || l.stage}</span></td>
                  <td>{timeAgo(l.createdAt || "")}</td>
                  <td className="r"><button className="tg-chat-btn" onClick={() => setChat(l)}><Ic d={TG_ICON} s={15} />Suhbat</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={I.list} text="Hali Telegram suhbat yo'q. Bot ulangach, mijoz yozganda shu yerda ko'rinadi." />}
      </div>
      {chat ? <TelegramChat lead={chat} onClose={() => setChat(null)} readOnly={readOnly} /> : null}
    </section>
  );
}

/* ================= TELEGRAM SETTINGS ================= */
type TgCmd = { command: string; description: string; reply: string };
type TgTpl = { id: string; title: string; text: string };
function TelegramSettings() {
  const [state, setState] = useState<{ connected: boolean; username: string | null; welcome: string }>({ connected: false, username: null, welcome: "" });
  const [token, setToken] = useState("");
  const [welcome, setWelcome] = useState("");
  const [birthday, setBirthday] = useState("");
  const [birthdayDefault, setBirthdayDefault] = useState("");
  const [bMsg, setBMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(""); const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [profOpen, setProfOpen] = useState(false);
  const [profLoading, setProfLoading] = useState(false);
  const [prof, setProf] = useState({ name: "", desc: "", short: "" });
  const [profMsg, setProfMsg] = useState("");
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfg, setCfg] = useState<{ commands: TgCmd[]; templates: TgTpl[] }>({ commands: [], templates: [] });
  const [cfgMsg, setCfgMsg] = useState("");

  const load = async () => {
    const res = await agencyApi<{ connected: boolean; username: string | null; welcome: string; birthdayTemplate?: string; birthdayDefault?: string }>("/telegram");
    if (res.success) {
      setState(res.data);
      setWelcome(res.data.welcome || "");
      setBirthday(res.data.birthdayTemplate || "");
      setBirthdayDefault(res.data.birthdayDefault || "");
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  async function connect() {
    if (!token.trim()) { setErr("Bot tokenini kiriting"); return; }
    setBusy("connect"); setErr(""); setMsg("");
    const res = await agencyApi<{ connected: boolean; username: string }>("/telegram/connect", { method: "POST", body: JSON.stringify({ token: token.trim() }) });
    setBusy("");
    if (res.success) { setToken(""); setMsg("Ulandi ✓"); await load(); }
    else setErr(res.message || "Ulab bo'lmadi");
  }
  async function disconnect() {
    setBusy("disconnect"); setErr(""); setMsg("");
    const res = await agencyApi("/telegram/disconnect", { method: "POST" });
    setBusy("");
    if (res.success) await load();
  }
  async function saveWelcome() {
    setBusy("welcome"); setErr(""); setMsg("");
    const res = await agencyApi("/telegram/welcome", { method: "PUT", body: JSON.stringify({ text: welcome }) });
    setBusy("");
    if (res.success) setMsg("Saqlandi ✓");
  }
  async function saveBirthday() {
    setBusy("birthday"); setBMsg("");
    const res = await agencyApi("/telegram/birthday-template", { method: "PUT", body: JSON.stringify({ text: birthday }) });
    setBusy("");
    if (res.success) setBMsg("Saqlandi ✓");
  }
  // Namuna ko'rsatish: shablonni (yoki standartни) real ism bilan to'ldirib beradi
  const bdayPreview = (birthday.trim() || birthdayDefault)
    .replace(/\{name\}/g, "Aziz Karimov")
    .replace(/\{agency\}/g, state.username ? state.username : "Agentligingiz");
  async function loadProfile() {
    setProfLoading(true);
    const res = await agencyApi<{ name: string; description: string; shortDescription: string }>("/telegram/profile");
    if (res.success) { const d = res.data; setProf({ name: d.name || "", desc: d.description || "", short: d.shortDescription || "" }); }
    setProfLoading(false);
  }
  async function saveProfile() {
    setBusy("profile"); setProfMsg("");
    const res = await agencyApi("/telegram/profile", { method: "PUT", body: JSON.stringify({ name: prof.name.trim(), description: prof.desc, shortDescription: prof.short }) });
    setBusy("");
    setProfMsg(res.success ? "Saqlandi ✓" : (res.message || "Xato"));
  }
  async function loadConfig() {
    setCfgLoading(true);
    const res = await agencyApi<{ commands: TgCmd[]; templates: TgTpl[] }>("/telegram/config");
    if (res.success) setCfg({ commands: res.data.commands || [], templates: res.data.templates || [] });
    setCfgLoading(false);
  }
  async function saveConfig() {
    setBusy("cfg"); setCfgMsg("");
    const res = await agencyApi("/telegram/config", { method: "PUT", body: JSON.stringify(cfg) });
    setBusy("");
    setCfgMsg(res.success ? "Saqlandi ✓" : (res.message || "Xato"));
  }
  const addCmd = () => setCfg((c) => ({ ...c, commands: [...c.commands, { command: "", description: "", reply: "" }] }));
  const updCmd = (i: number, k: keyof TgCmd, v: string) => setCfg((c) => ({ ...c, commands: c.commands.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const delCmd = (i: number) => setCfg((c) => ({ ...c, commands: c.commands.filter((_, j) => j !== i) }));
  const addTpl = () => setCfg((c) => ({ ...c, templates: [...c.templates, { id: Math.random().toString(36).slice(2, 9), title: "", text: "" }] }));
  const updTpl = (i: number, k: keyof TgTpl, v: string) => setCfg((c) => ({ ...c, templates: c.templates.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const delTpl = (i: number) => setCfg((c) => ({ ...c, templates: c.templates.filter((_, j) => j !== i) }));
  if (loading) return <div className="card" style={{ padding: 18, color: "var(--t2)", fontSize: 13 }}>Yuklanmoqda…</div>;
  return (
    <div className="card tg-set">
      <div className="tg-set-top">
        <div className="tg-ic"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>Telegram bot</b>
          {state.connected
            ? <small style={{ color: "var(--primary)" }}>Ulangan · @{state.username}</small>
            : <small>Botingizga kelgan xabarlar avtomatik lid bo&apos;ladi</small>}
        </div>
        {state.connected ? <button className="btn btn-ghost btn-sm" disabled={busy === "disconnect"} onClick={() => void disconnect()}>{busy === "disconnect" ? "..." : "Uzish"}</button> : null}
      </div>
      {err ? <div className="note note-err" style={{ margin: "12px 0 0" }}>{err}</div> : null}
      {msg && !state.connected ? <div style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600, marginTop: 10 }}>{msg}</div> : null}
      {!state.connected ? (
        <div className="tg-connect">
          <div className="tg-hint">Telegram&apos;da <b>@BotFather</b> → <code>/newbot</code> → tokenni bu yerga qo&apos;ying:</div>
          <div className="tg-connect-row">
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA..." />
            <button className="btn btn-primary" disabled={busy === "connect"} onClick={() => void connect()}>{busy === "connect" ? "Ulanmoqda..." : "Ulash"}</button>
          </div>
        </div>
      ) : (
        <>
        <div className="tg-welcome">
          <label>Avtomatik salomlashish (birinchi xabarda / start bosilganda bot yuboradi)</label>
          <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={2} placeholder="Salom! So'rovingiz qabul qilindi, tez orada bog'lanamiz." />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy === "welcome"} onClick={() => void saveWelcome()}>{busy === "welcome" ? "..." : "Saqlash"}</button>
            {msg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</span> : null}
          </div>
        </div>

        {/* Tug'ilgan kun tabrigi — BIRTHDAY_LIVE bayrog'i bilan yashirilgan.
            Matn serverda saqlanib turadi, qayta yoqilganda o'z joyida bo'ladi. */}
        <div className="tg-welcome" style={{ marginTop: 14, display: BIRTHDAY_LIVE ? undefined : "none" }}>
          <label>🎂 Tug&apos;ilgan kun tabrigi matni (mijoz tug&apos;ilgan kuni bot avtomatik yuboradi)</label>
          <textarea value={birthday} onChange={(e) => setBirthday(e.target.value)} rows={5} placeholder={birthdayDefault || "Standart matn ishlatiladi"} />
          <div style={{ fontSize: 12.5, color: "#8aa398", marginTop: 6 }}>
            Belgilar: <code>{"{name}"}</code> = mijoz ismi · <code>{"{agency}"}</code> = agentlik nomi. Bo&apos;sh qoldirsangiz standart matn ishlatiladi.
          </div>
          {bdayPreview ? (
            <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(234,179,8,.08)", border: "1px solid rgba(234,179,8,.3)", borderRadius: 10, fontSize: 13.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em", color: "#CA8A04", marginBottom: 5 }}>NAMUNA</div>
              {bdayPreview}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy === "birthday"} onClick={() => void saveBirthday()}>{busy === "birthday" ? "..." : "Saqlash"}</button>
            {birthday.trim() ? <button className="btn btn-ghost btn-sm" onClick={() => { setBirthday(""); }}>Standartga qaytarish</button> : null}
            {bMsg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{bMsg}</span> : null}
          </div>
        </div>
        <div className="tg-profile">
          <button type="button" className="tg-prof-toggle" onClick={() => { if (!profOpen) void loadProfile(); setProfOpen((o) => !o); }}>
            <span>Bot profili — nom va tavsif</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: profOpen ? "rotate(180deg)" : "none", transition: ".2s" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {profOpen ? (profLoading ? <div className="tg-empty" style={{ padding: 14 }}>Yuklanmoqda…</div> : (
            <div className="tg-prof-body">
              <div className="fld"><label>Bot nomi</label><input value={prof.name} maxLength={64} onChange={(e) => setProf((p) => ({ ...p, name: e.target.value }))} /></div>
              <div className="fld"><label>Tavsif — «What can this bot do?» (start&apos;dan oldin ko&apos;rinadi)</label><textarea value={prof.desc} maxLength={512} rows={2} onChange={(e) => setProf((p) => ({ ...p, desc: e.target.value }))} /></div>
              <div className="fld"><label>Qisqa tavsif (profil ostidagi bio)</label><textarea value={prof.short} maxLength={120} rows={2} onChange={(e) => setProf((p) => ({ ...p, short: e.target.value }))} /></div>
              <div className="tg-prof-note">Logotip (rasm/avatar) faqat <b>@BotFather → /setuserpic</b> orqali o&apos;zgartiriladi — Telegram Bot API bunga ruxsat bermaydi.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === "profile"} onClick={() => void saveProfile()}>{busy === "profile" ? "Saqlanmoqda..." : "Bot profilini saqlash"}</button>
                {profMsg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{profMsg}</span> : null}
              </div>
            </div>
          )) : null}
        </div>
        <div className="tg-profile">
          <button type="button" className="tg-prof-toggle" onClick={() => { if (!cfgOpen) void loadConfig(); setCfgOpen((o) => !o); }}>
            <span>Buyruqlar va xabar shablonlari</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: cfgOpen ? "rotate(180deg)" : "none", transition: ".2s" }}><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {cfgOpen ? (cfgLoading ? <div className="tg-empty" style={{ padding: 14 }}>Yuklanmoqda…</div> : (
            <div className="tg-cfg">
              <div className="tg-cfg-h"><b>Buyruqlar</b><button type="button" className="tg-add" onClick={addCmd}>+ Buyruq</button></div>
              <div className="tg-cfg-hint">Menyuga chiqadi; avto-javob yozsangiz bot o&apos;sha buyruqqa avtomatik javob beradi.</div>
              {cfg.commands.length === 0 ? <div className="tg-cfg-empty">Buyruq yo&apos;q</div> : cfg.commands.map((c, i) => (
                <div className="tg-cfg-row" key={i}>
                  <div className="tg-cfg-top">
                    <input className="tg-cfg-cmd" placeholder="buyruq (masalan: narx)" value={c.command} onChange={(e) => updCmd(i, "command", e.target.value)} />
                    <input placeholder="Menyu izohi" value={c.description} onChange={(e) => updCmd(i, "description", e.target.value)} />
                    <button type="button" className="tg-cfg-del" onClick={() => delCmd(i)} aria-label="O'chirish">×</button>
                  </div>
                  <textarea placeholder="Avto-javob (ixtiyoriy)" value={c.reply} rows={2} onChange={(e) => updCmd(i, "reply", e.target.value)} />
                </div>
              ))}
              <div className="tg-cfg-h" style={{ marginTop: 16 }}><b>Xabar shablonlari</b><button type="button" className="tg-add" onClick={addTpl}>+ Shablon</button></div>
              <div className="tg-cfg-hint">Suhbatda bir bosishda qo&apos;yiladigan tayyor javoblar.</div>
              {cfg.templates.length === 0 ? <div className="tg-cfg-empty">Shablon yo&apos;q</div> : cfg.templates.map((t, i) => (
                <div className="tg-cfg-row" key={t.id || i}>
                  <div className="tg-cfg-top">
                    <input placeholder="Nomi (masalan: Ish vaqti)" value={t.title} onChange={(e) => updTpl(i, "title", e.target.value)} />
                    <button type="button" className="tg-cfg-del" onClick={() => delTpl(i)} aria-label="O'chirish">×</button>
                  </div>
                  <textarea placeholder="Xabar matni" value={t.text} rows={2} onChange={(e) => updTpl(i, "text", e.target.value)} />
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" disabled={busy === "cfg"} onClick={() => void saveConfig()}>{busy === "cfg" ? "Saqlanmoqda..." : "Saqlash"}</button>
                {cfgMsg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{cfgMsg}</span> : null}
              </div>
            </div>
          )) : null}
        </div>
        </>
      )}
    </div>
  );
}

/* ================= PROFILE FORM (settings) ================= */
function ProfileForm({ agency, refresh, readOnly }: any) {
  const [name, setName] = useState(agency?.name || "");
  const [city, setCity] = useState(agency?.city || "");
  const [specialty, setSpecialty] = useState(agency?.specialty || "");
  const [phone, setPhone] = useState(agency?.phone || "");
  const [telegram, setTelegram] = useState(agency?.telegram || "");
  const [website, setWebsite] = useState(agency?.website || "");
  const [description, setDescription] = useState(agency?.description || "");
  const [img, setImg] = useState(agency?.imageUrl || "");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => {
    setName(agency?.name || ""); setCity(agency?.city || ""); setSpecialty(agency?.specialty || "");
    setPhone(agency?.phone || ""); setTelegram(agency?.telegram || ""); setWebsite(agency?.website || "");
    setDescription(agency?.description || ""); setImg(agency?.imageUrl || "");
  }, [agency]);
  // Logotip saqlanganidan farq qiladimi — foydalanuvchiga saqlash kerakligini
  // ko'rsatish uchun. save() ham aynan shu shartga qarab imageUrl yuboradi.
  const logoChanged = img !== (agency?.imageUrl || "");
  async function pickImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setImg(await readImage(file)); setMsg(""); } catch (er) { setErr(er instanceof Error ? er.message : "Rasm xato"); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setErr("Agentlik nomini kiriting."); return; }
    setBusy(true); setErr(""); setMsg("");
    const body: Record<string, unknown> = {
      name: name.trim(), phone: phone.trim() || null,
      telegram: telegram.trim() || null, website: website.trim() || null,
      description: description.trim() || null,
    };
    if (city.trim()) body.city = city.trim();
    if (specialty.trim()) body.specialty = specialty.trim();
    if (img !== (agency?.imageUrl || "")) body.imageUrl = img || null;
    const res = await agencyApi("/profile", { method: "PUT", body: JSON.stringify(body) });
    setBusy(false);
    if (res.success) { setMsg("Saqlandi ✓"); await refresh(true); }
    else setErr(res.message || "Saqlab bo'lmadi.");
  }
  return (
    <form className="card prof" onSubmit={save}>
      <div className="prof-logo">
        {img ? <img src={img} alt="" /> : <span className="prof-ini">{initials(name || "AG")}</span>}
        <div className="prof-logo-tx">
          <label className="prof-pick">{img ? "Logotipni almashtirish" : "Logotip yuklash"}<input type="file" accept="image/*" onChange={pickImg} style={{ display: "none" }} disabled={readOnly} /></label>
          <small>PNG yoki JPG · kvadrat rasm tavsiya etiladi</small>
          {img && !readOnly ? <button type="button" className="prof-logo-rm" onClick={() => setImg("")}>Olib tashlash</button> : null}
        </div>
      </div>
      {/* Logotip almashtirilsa/olib tashlansa — u faqat formada o'zgaradi,
          bazaga «Saqlash» bosilgandan keyin yoziladi. Ilgari bu ko'rinmasdi:
          «O'chirish» bosilardi, sahifa yangilanardi va eski logotip qaytardi. */}
      {logoChanged && !readOnly ? (
        <div className="prof-logo-warn">
          {img ? "Yangi logotip tanlandi" : "Logotip olib tashlandi"} — o&apos;zgarish hali saqlanmagan.
          Pastdagi <b>«Saqlash»</b> tugmasini bosing.
        </div>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fld"><label>Agentlik nomi *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Travel CRM" /></div>
        <div className="fld"><label>Shahar</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Toshkent" /></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fld"><label>Yo&apos;nalish (ixtisos)</label><input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ichki va xalqaro turlar" /></div>
        <div className="fld"><label>Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000 00 00" /></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fld"><label>Telegram</label><input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@agentlik yoki t.me/..." /></div>
        <div className="fld"><label>Vebsayt</label><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." /></div>
      </div>
      <div className="fld"><label>Agentlik haqida (tavsif)</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Agentligingiz, yo'nalishlaringiz va afzalliklaringiz haqida qisqacha — marketpleysda mijozlar shuni ko'radi." /></div>
      {err ? <div className="note note-err" style={{ marginBottom: 10 }}>{err}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={busy || readOnly} title={readOnly ? "Obuna tugagan — faqat o'qish rejimi" : undefined}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
        {msg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</span> : null}
      </div>
    </form>
  );
}
