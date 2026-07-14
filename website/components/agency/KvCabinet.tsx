"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgencySession } from "@/lib/agency/session";
import { useCrm } from "@/lib/agency/useCrm";
import { agencyApi, formatMoney, formatDate, statusLabel, readImage } from "@/lib/agency/api";
import { getNotifs, markRead, markAllRead, pushNotif, seedNotifs, type KvNotif } from "@/lib/agency/notify";
import {
  CRM_STAGES,
  toggleTask,
  timeAgo,
  type CrmLead,
  type CrmStage,
} from "@/lib/agency/crm";

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
};
function Ic({ d, s = 18 }: { d: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const NAV: { key: string; label: string; icon: string; group: string; badge?: "leads" | "tasks" }[] = [
  { key: "dashboard", label: "Boshqaruv paneli", icon: I.grid, group: "Asosiy" },
  { key: "leads", label: "Lidlar / Voronka", icon: I.list, group: "Asosiy", badge: "leads" },
  { key: "customers", label: "Mijozlar", icon: I.users, group: "Asosiy" },
  { key: "packages", label: "Turlar / Paketlar", icon: I.box, group: "Sotuv" },
  { key: "bookings", label: "Bronlar", icon: I.cal, group: "Sotuv" },
  { key: "payments", label: "To'lovlar", icon: I.card, group: "Sotuv" },
  { key: "reports", label: "Hisobotlar", icon: I.chart, group: "Boshqa" },
  { key: "settings", label: "Sozlamalar", icon: I.gear, group: "Boshqa" },
];
const TITLES: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.key, n.label]));
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
        <div className="notif-head"><b>Bildirishnomalar</b>{unread > 0 ? <button className="notif-allread" onClick={() => markAllRead(agencyId)}>Barchasini o&apos;qish</button> : null}</div>
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

export default function KvCabinet() {
  const { phase, me, tours, bookings, bookingStats, logout, refresh, refreshBookings, refreshTours } = useAgencySession();
  const { agencyId, leads, tasks, customers, move, busyId } = useCrm();
  const [view, setView] = useState("dashboard");
  const [showAdd, setShowAdd] = useState(false);
  const [dragId, setDragId] = useState("");
  const [over, setOver] = useState<CrmStage | "">("");

  useEffect(() => {
    const id = "kv-fonts";
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(l);
    }
  }, []);

  if (phase === "loading") {
    return <div className="kv"><div className="kv-center"><svg className="kv-spin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.2-8.5" /></svg><p>Yuklanmoqda…</p></div></div>;
  }
  if (phase === "guest") {
    return <div className="kv"><div className="kv-center"><h2>Agentlik kabineti</h2><p>Davom etish uchun hamkor sifatida tizimga kiring.</p><a className="btn btn-primary" href="/signin">Kirish</a></div></div>;
  }
  if (phase === "onboarding") {
    return <div className="kv"><div className="kv-center"><h2>Hisobingiz ko'rib chiqilmoqda</h2><p>Agentligingiz tasdiqlangach, CRM kabineti ochiladi.</p><button className="btn btn-ghost" onClick={() => void logout()}>Chiqish</button></div></div>;
  }

  const agency = me?.agency;
  const openLeads = leads.filter((l) => OPEN.includes(l.stage)).length;

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
              {NAV.filter((n) => n.group === g).map((n) => (
                <button key={n.key} className={`nav-item${view === n.key ? " active" : ""}`} onClick={() => setView(n.key)}>
                  <Ic d={n.icon} />{n.label}
                  {n.badge === "leads" && openLeads > 0 ? <span className="badge">{openLeads}</span> : null}
                </button>
              ))}
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
              <NotificationBell agencyId={agencyId} leads={leads} go={setView} />
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Ic d={I.plus} s={16} /> Yangi lid</button>
            </div>
          </header>

          <div className="content">
            <Dashboard show={view === "dashboard"} leads={leads} tasks={tasks} stats={bookingStats} agencyId={agencyId} go={setView} />
            <Leads show={view === "leads"} leads={leads} move={move} busyId={busyId} dragId={dragId} setDragId={setDragId} over={over} setOver={setOver} />
            <Customers show={view === "customers"} customers={customers} />
            <Packages show={view === "packages"} tours={tours} agencyId={agencyId} refreshTours={refreshTours} />
            <Bookings show={view === "bookings"} bookings={bookings} agencyId={agencyId} refreshBookings={refreshBookings} refresh={refresh} />
            <Payments show={view === "payments"} leads={leads} move={move} busyId={busyId} />
            <Reports show={view === "reports"} leads={leads} />
            <Settings show={view === "settings"} agency={agency} agencyId={agencyId} refresh={refresh} logout={logout} />
          </div>
        </div>
      </div>

      {showAdd ? <AddLead agencyId={agencyId} onClose={() => setShowAdd(false)} onCreated={refreshBookings} /> : null}
    </div>
  );
}

/* ================= DASHBOARD ================= */
function Dashboard({ show, leads, tasks, stats, agencyId, go }: any) {
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
  const [, setV] = useState(0);
  const doneTasks = tasks.filter((t: any) => t.done).length;

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

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
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
        <div className="card">
          <div className="section-head" style={{ margin: "16px 18px 2px" }}><div><h2>Vazifalar</h2><div className="sub">{tasks.length - doneTasks} ochiq</div></div></div>
          <div className="list">
            {tasks.length ? tasks.slice(0, 5).map((t: any) => (
              <div className={`task${t.done ? " done" : ""}`} key={t.id}>
                <button className="box" onClick={() => { toggleTask(agencyId, t.id); setV((x) => x + 1); }}><Ic d={I.check} s={13} /></button>
                <span className="tx">{t.title}</span>
                <span className="time">{t.dueAt ? timeAgo(t.dueAt) : "—"}</span>
              </div>
            )) : <Empty icon={I.check} text="Hozircha vazifa yo'q." />}
          </div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="section-head" style={{ margin: "16px 18px 2px" }}><div><h2>Yaqinlashayotgan sayohatlar</h2></div><button className="link" onClick={() => go("bookings")}>Barchasi →</button></div>
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

/* ================= LEADS / KANBAN ================= */
const SRC_BADGE: Record<string, string> = { manual: "b-amber", marketplace: "b-green", telegram: "b-sky" };
const srcLabel = (s: string) => (s === "manual" ? "Qo'lda" : s === "telegram" ? "Telegram" : "Marketplace");
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

function Leads({ show, leads, move, busyId, dragId, setDragId, over, setOver }: any) {
  const [chat, setChat] = useState<CrmLead | null>(null);
  const byStage = useMemo(() => {
    const map: Record<CrmStage, CrmLead[]> = { new: [], contacted: [], quoted: [], won: [], completed: [], lost: [] };
    for (const l of leads) map[(l as CrmLead).stage].push(l);
    return map;
  }, [leads]);
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Sotuv voronkasi</h2><div className="sub">Jami {leads.length} ta lid — kartani suring yoki bosqichni tanlang</div></div></div>
      <div className="kanban">
        {CRM_STAGES.map((s, i) => (
          <div key={s.key} className={`kcol c${i}${over === s.key ? " over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
            onDragLeave={() => setOver((c: string) => (c === s.key ? "" : c))}
            onDrop={() => { const l = leads.find((x: CrmLead) => x.id === dragId); setOver(""); setDragId(""); if (l) void move(l, s.key); }}>
            <div className="khead"><span className="acc" /><b>{s.label}</b><span className="n">{byStage[s.key as CrmStage].length}</span></div>
            {byStage[s.key as CrmStage].map((l) => (
              <article key={l.id} className="kcard" draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId("")} style={busyId === l.id ? { opacity: 0.5 } : undefined}>
                <b>{l.customerName}</b>
                <div className="dir">{l.tourTitle || "Tur ko'rsatilmagan"}</div>
                {l.totalEstimate ? <span className="sum">{formatMoney(l.totalEstimate)}</span> : <span className="dir">Summa yo'q</span>}
                <div className="foot"><span className={`badge2 ${SRC_BADGE[l.source] || "b-grey"}`}>{srcLabel(l.source)}</span><small>{timeAgo(l.createdAt)}</small></div>
                <StageSelect value={l.stage} onChange={(s) => void move(l, s)} disabled={busyId === l.id} />
                {l.source === "telegram" ? <button className="tg-chat-btn" onClick={() => setChat(l)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>Telegram suhbat</button> : null}
              </article>
            ))}
            {byStage[s.key as CrmStage].length === 0 ? <div style={{ textAlign: "center", color: "#aab6b0", fontSize: 12, padding: "10px 0" }}>Bo&apos;sh</div> : null}
          </div>
        ))}
      </div>
      {chat ? <TelegramChat lead={chat} onClose={() => setChat(null)} /> : null}
    </section>
  );
}

/* ================= CUSTOMERS ================= */
function Customers({ show, customers }: any) {
  const vip = customers.filter((c: any) => c.totalValue >= 1500).length;
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Mijozlar bazasi</h2><div className="sub">Jami {customers.length} mijoz · {vip} yuqori qiymatli</div></div></div>
      <div className="card tbl-wrap">
        {customers.length ? (
          <table>
            <thead><tr><th>Mijoz</th><th>Telefon</th><th>So&apos;rovlar</th><th className="r">Jami qiymat</th><th>Holat</th></tr></thead>
            <tbody>
              {customers.map((c: any) => (
                <tr key={c.keyId}>
                  <td><div className="cell"><span className="av-sm">{initials(c.name)}</span><b>{c.name}</b></div></td>
                  <td>{c.phone || "—"}</td>
                  <td>{c.leads.length}</td>
                  <td className="r money">{formatMoney(c.totalValue)}</td>
                  <td><span className={`badge2 ${c.totalValue >= 1500 ? "b-amber" : c.wonCount > 1 ? "b-green" : c.wonCount ? "b-grey" : "b-sky"}`}>{c.totalValue >= 1500 ? "VIP" : c.wonCount > 1 ? "Doimiy" : c.wonCount ? "Faol" : "Yangi"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={I.users} text="Hali mijoz yo'q. Birinchi lid kelganda shu yerda paydo bo'ladi." />}
      </div>
    </section>
  );
}

/* ================= PACKAGES / TOURS ================= */
function Packages({ show, tours, agencyId, refreshTours }: any) {
  const [modal, setModal] = useState<{ tour?: any } | null>(null);
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
        <button className="btn btn-primary" onClick={() => setModal({})}><Ic d={I.plus} s={16} /> Yangi tur</button>
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
                <div className="pkg-act">
                  <button className="pkg-abtn" onClick={() => setModal({ tour: t })}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>Tahrirlash</button>
                  <button className="pkg-abtn del" onClick={() => { setDelErr(""); setDelTour(t); }} title="O'chirish" aria-label="O'chirish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                </div>
                {t.approvalStatus === "draft" ? (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 8, width: "100%" }} disabled={busyId === t.id} onClick={() => void submitTour(t)}>{busyId === t.id ? "E'lon qilinmoqda..." : "Saytda e'lon qilish"}</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="card"><Empty icon={I.box} text="Hali tur yo'q. 'Yangi tur' tugmasi orqali qo'shing." /></div>}
      {modal ? <AddTour agencyId={agencyId} tour={modal.tour} onClose={() => setModal(null)} onCreated={refreshTours} /> : null}
      {delTour ? <ConfirmDelete tour={delTour} busy={delBusy} err={delErr} onCancel={() => setDelTour(null)} onConfirm={doDelete} /> : null}
    </section>
  );
}

/* ================= BOOKINGS ================= */
function Bookings({ show, bookings, agencyId, refreshBookings, refresh }: any) {
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
      <div className="section-head"><div><h2>Bronlar</h2><div className="sub">Jami {bookings.length} bron · {paid} tasdiqlangan{pend ? ` · ${pend} kutilmoqda` : ""}</div></div></div>
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
                    {b.status === "pending" ? (
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
function Payments({ show, leads, move, busyId }: any) {
  const m = useMemo(() => {
    const paid = leads.filter((l: CrmLead) => l.stage === "won" || l.stage === "completed");
    const pending = leads.filter((l: CrmLead) => l.stage === "quoted");
    return {
      accepted: paid.reduce((a: number, l: CrmLead) => a + (l.totalEstimate || 0), 0),
      pending: pending.reduce((a: number, l: CrmLead) => a + (l.totalEstimate || 0), 0),
      rows: paid,
    };
  }, [leads]);
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>To&apos;lovlar</h2></div></div>
      <div className="grid g3">
        <div className="card kpi gold"><div className="top"><div className="ico"><Ic d={I.check} s={19} /></div></div><div className="val">{formatMoney(m.accepted)}</div><div className="lbl">Qabul qilingan (kelishilgan)</div></div>
        <div className="card kpi"><div className="top"><div className="ico"><Ic d={I.clock} s={19} /></div></div><div className="val">{formatMoney(m.pending)}</div><div className="lbl">Kutilayotgan (taklifda)</div></div>
        <div className="card kpi"><div className="top"><div className="ico"><Ic d={I.card} s={19} /></div></div><div className="val">{m.rows.length}</div><div className="lbl">To&apos;langan bronlar</div></div>
      </div>
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
                  <td><span className="badge2 b-green">{l.stage === "completed" ? "Yakunlandi" : "Kelishildi"}</span></td>
                  <td>
                    {l.stage === "won" ? (
                      <button className="act-btn done-btn" disabled={busyId === l.id} onClick={() => void move(l, "completed")}>{busyId === l.id ? "..." : "To'lovni tasdiqlash"}</button>
                    ) : (
                      <button className="act-btn back" disabled={busyId === l.id} onClick={() => void move(l, "won")} title="To'lovni bekor qilish"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></svg>Bekor qilish</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Empty icon={I.money} text="Hali to'lov yo'q. Lid 'Kelishildi' bosqichiga o'tganda shu yerda ko'rinadi." />}
      </div>
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
    leads.forEach((l: CrmLead) => { const k = l.source === "manual" ? "Qo'lda" : "Marketplace"; src[k] = (src[k] || 0) + 1; });
    const total = Math.max(1, leads.length);
    // destinations
    const dest: Record<string, number> = {};
    leads.forEach((l: CrmLead) => { const k = (l.tourTitle || l.tourCity || "Boshqa").split(" ")[0]; dest[k] = (dest[k] || 0) + 1; });
    const topDest = Object.entries(dest).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxDest = Math.max(1, ...topDest.map((d) => d[1]));
    return { months, maxRev, src, total, topDest, maxDest };
  }, [leads]);

  const srcColors: Record<string, string> = { Marketplace: "var(--primary)", "Qo'lda": "var(--gold)" };
  const srcEntries = Object.entries(r.src);
  let acc = 0;
  const stops = srcEntries.map(([k, v]) => { const start = (acc / r.total) * 100; acc += v; const end = (acc / r.total) * 100; return `${srcColors[k] || "var(--sky)"} ${start}% ${end}%`; }).join(", ");

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
                <div className="l" key={k}><span className="sw" style={{ background: srcColors[k] || "var(--sky)" }} />{k}<span className="pc">{Math.round((v / r.total) * 100)}%</span></div>
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
    </section>
  );
}

/* ================= SETTINGS ================= */
function Settings({ show, agency, refresh, logout }: any) {
  return (
    <section className={`view${show ? " active" : ""}`}>
      <div className="section-head"><div><h2>Sozlamalar</h2></div></div>

      <div className="section-head"><div><h2>Agentlik ma&apos;lumoti</h2><div className="sub">Nomi, logotipi va telefoni — sidebar va CRM&apos;da shu ma&apos;lumot ko&apos;rinadi</div></div></div>
      <ProfileForm agency={agency} refresh={refresh} />

      <div className="section-head"><div><h2>Telegram bot</h2><div className="sub">Botni ulang — mijoz xabarlari avtomatik lid bo&apos;ladi, javobni ham shu yerdan yozasiz</div></div></div>
      <TelegramSettings />

      <div className="section-head"><div><h2>Rollar va ruxsatlar</h2></div></div>
      <div className="card mini" style={{ padding: 6 }}>
        <div className="r"><span className="av-sm" style={{ background: "var(--gold-soft)", color: "var(--gold-ink)" }}>A</span><div><b>Administrator</b><small>To&apos;liq boshqaruv, sozlamalar, moliya</small></div></div>
        <div className="r"><span className="av-sm">M</span><div><b>Menejer</b><small>Lidlar, bronlar va agentlar nazorati</small></div></div>
        <div className="r"><span className="av-sm">A</span><div><b>Agent</b><small>O&apos;z lidlari va bronlari bilan ishlaydi</small></div></div>
        <div className="r"><span className="av-sm" style={{ background: "var(--sky-soft)", color: "#255d7d" }}>B</span><div><b>Buxgalter</b><small>To&apos;lovlar va hisobotlarni ko&apos;radi</small></div></div>
      </div>
      <div style={{ marginTop: 18 }}><button className="btn btn-ghost" onClick={() => void logout()}><Ic d={I.out} s={16} /> Chiqish</button></div>
      <div style={{ height: 16 }} />
    </section>
  );
}

/* ================= ADD LEAD MODAL ================= */
function AddLead({ onClose, onCreated }: any) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [tour, setTour] = useState(""); const [sum, setSum] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
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
function AddTour({ agencyId, tour, onClose, onCreated }: any) {
  const editing = !!tour;
  const [f, setF] = useState({
    title: tour?.title || "", city: tour?.city || "", subtitle: tour?.subtitle || "",
    duration: tour?.duration || "", price: tour?.price || (tour?.priceMin ? `$${tour.priceMin}` : ""),
    highlights: Array.isArray(tour?.highlights) ? tour.highlights.join(", ") : "",
  });
  const [img, setImg] = useState(tour?.imageUrl || "");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function pickImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setImg(await readImage(file)); } catch (er) { setErr(er instanceof Error ? er.message : "Rasm xato"); }
  }
  function validate() {
    if (f.title.trim().length < 3) { setErr("Tur nomi kamida 3 harf bo'lsin."); return false; }
    if (f.city.trim().length < 2) { setErr("Shahar / yo'nalishni kiriting."); return false; }
    if (f.subtitle.trim().length < 3) { setErr("Qisqa tavsif kiriting."); return false; }
    if (f.duration.trim().length < 2) { setErr("Davomiylikni kiriting (masalan: 5 kun)."); return false; }
    setErr(""); return true;
  }
  async function doSave(publish: boolean) {
    setBusy(true); setErr("");
    const priceMin = f.price ? Number(f.price.replace(/[^\d]/g, "")) || undefined : undefined;
    const highlights = String(f.highlights).split(",").map((s: string) => s.trim()).filter((s: string) => s.length >= 2).slice(0, 20);
    const body: Record<string, unknown> = {
      title: f.title.trim(), city: f.city.trim(), subtitle: f.subtitle.trim(), duration: f.duration.trim(),
      price: f.price.trim() || undefined, priceMin, highlights,
    };
    if (img !== (tour?.imageUrl || "")) body.imageUrl = img || null;
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
        <div className="section-head" style={{ margin: "0 0 12px" }}><div><h2>{editing ? "Turni tahrirlash" : "Yangi tur qo'shish"}</h2><div className="sub">To'ldirib «E'lon qilish»ni bossangiz — tur to'g'ridan-to'g'ri saytda ko'rinadi. Yoki qoralama saqlab keyin e'lon qilasiz.</div></div></div>
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
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld"><label>Shahar / yo&apos;nalish *</label><input value={f.city} onChange={set("city")} placeholder="Dubay" /></div>
            <div className="fld"><label>Davomiyligi *</label><input value={f.duration} onChange={set("duration")} placeholder="5 kun 4 kecha" /></div>
          </div>
          <div className="fld"><label>Qisqa tavsif *</label><input value={f.subtitle} onChange={set("subtitle")} placeholder="All inclusive, aviabilet + mehmonxona" /></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fld"><label>Narx</label><input value={f.price} onChange={set("price")} placeholder="$900" /></div>
            <div className="fld"><label>Xizmatlar (vergul bilan)</label><input value={f.highlights} onChange={set("highlights")} placeholder="Aviabilet, Transfer, Gid" /></div>
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
          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Bekor</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { if (validate()) void doSave(false); }}>Qoralama saqlash</button>
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
function TelegramChat({ lead, onClose }: { lead: CrmLead; onClose: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [canReply, setCanReply] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TgTpl[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void agencyApi<{ templates: TgTpl[] }>("/telegram/config").then((r) => { if (r.success) setTemplates(r.data.templates || []); });
  }, []);

  const load = async () => {
    const res = await agencyApi<{ messages: any[]; canReply: boolean }>(`/telegram/messages?bookingId=${encodeURIComponent(lead.id)}`);
    if (res.success) { setMessages(res.data.messages || []); setCanReply(!!res.data.canReply); }
    setLoading(false);
  };
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 8000); return () => window.clearInterval(t); }, [lead.id]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const res = await agencyApi("/telegram/reply", { method: "POST", body: JSON.stringify({ bookingId: lead.id, text: text.trim() }) });
    setBusy(false);
    if (res.success) { setText(""); await load(); }
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card tg-chat" onClick={(e) => e.stopPropagation()}>
        <div className="tg-chat-head">
          <div><b>{lead.customerName}</b><small>Telegram suhbat</small></div>
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
        {canReply ? (
          <div className="tg-reply">
            {templates.length ? <div className="tg-quick">{templates.map((t) => <button key={t.id} type="button" className="tg-quick-btn" onClick={() => setText(t.text)}>{t.title}</button>)}</div> : null}
            <form className="tg-chat-input" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Javob yozing…" />
              <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>Yuborish</button>
            </form>
          </div>
        ) : <div className="tg-noreply">Bu lidda Telegram identifikatori yo&apos;q</div>}
      </div>
    </div>
  );
}

/* ================= TELEGRAM SETTINGS ================= */
type TgCmd = { command: string; description: string; reply: string };
type TgTpl = { id: string; title: string; text: string };
function TelegramSettings() {
  const [state, setState] = useState<{ connected: boolean; username: string | null; welcome: string }>({ connected: false, username: null, welcome: "" });
  const [token, setToken] = useState("");
  const [welcome, setWelcome] = useState("");
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
    const res = await agencyApi<{ connected: boolean; username: string | null; welcome: string }>("/telegram");
    if (res.success) { setState(res.data); setWelcome(res.data.welcome || ""); }
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
function ProfileForm({ agency, refresh }: any) {
  const [name, setName] = useState(agency?.name || "");
  const [city, setCity] = useState(agency?.city || "");
  const [phone, setPhone] = useState(agency?.phone || "");
  const [img, setImg] = useState(agency?.imageUrl || "");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => {
    setName(agency?.name || ""); setCity(agency?.city || ""); setPhone(agency?.phone || ""); setImg(agency?.imageUrl || "");
  }, [agency]);
  async function pickImg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setImg(await readImage(file)); setMsg(""); } catch (er) { setErr(er instanceof Error ? er.message : "Rasm xato"); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setErr("Agentlik nomini kiriting."); return; }
    setBusy(true); setErr(""); setMsg("");
    const body: Record<string, unknown> = { name: name.trim(), phone: phone.trim() || null };
    if (city.trim()) body.city = city.trim();
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
        <label className="prof-pick">Logotip tanlash<input type="file" accept="image/*" onChange={pickImg} style={{ display: "none" }} /></label>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="fld"><label>Agentlik nomi *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Demo Travel CRM" /></div>
        <div className="fld"><label>Shahar</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Toshkent" /></div>
      </div>
      <div className="fld"><label>Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000 00 00" /></div>
      {err ? <div className="note note-err" style={{ marginBottom: 10 }}>{err}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
        {msg ? <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 600 }}>{msg}</span> : null}
      </div>
    </form>
  );
}
