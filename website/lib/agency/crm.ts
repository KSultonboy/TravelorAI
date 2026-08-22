"use client";

import type { BookingItem } from "./types";

/* ============================================================================
 * TravelorAI Agency CRM — client-side store
 * ----------------------------------------------------------------------------
 * Real bookings (marketplace leads) come from the backend session. Their core
 * status (confirm / reject / complete / cancel) is persisted server-side via the
 * existing /bookings/:id/status endpoint. Everything a CRM adds on top —
 * pipeline sub-stages, tags, activity notes, tasks/reminders and manually added
 * leads — is stored per-agency in localStorage behind this thin abstraction, so
 * a future server sync is a drop-in replacement.
 * ========================================================================== */

export type CrmStage = string;

export type PipelineStageDefinition = {
  id: string;
  key: CrmStage;
  name: string;
  label: string;
  hint: string;
  color: string;
  position: number;
  systemType?: string | null;
  isSystem: boolean;
};

export const CRM_STAGES: PipelineStageDefinition[] = [
  { id: "new", key: "new", name: "Yangi", label: "Yangi", hint: "Endi kelgan, hali bog'lanilmagan", color: "#2563EB", position: 10, systemType: "new", isSystem: true },
  { id: "contacted", key: "contacted", name: "Bog'lanildi", label: "Bog'lanildi", hint: "Mijoz bilan aloqaga chiqildi", color: "#0891B2", position: 20, systemType: "contacted", isSystem: true },
  { id: "quoted", key: "quoted", name: "Taklif berildi", label: "Taklif berildi", hint: "Narx / paket taklifi yuborildi", color: "#CA8A04", position: 30, systemType: "quoted", isSystem: true },
  { id: "won", key: "won", name: "Kelishildi", label: "Kelishildi", hint: "Mijoz rozi — bandlov tasdiqlandi", color: "#16A34A", position: 40, systemType: "won", isSystem: true },
  { id: "completed", key: "completed", name: "Yakunlandi", label: "Yakunlandi", hint: "Sayohat bo'lib o'tdi", color: "#0F766E", position: 50, systemType: "completed", isSystem: true },
  { id: "lost", key: "lost", name: "Yo'qotilgan", label: "Yo'qotilgan", hint: "Rad etildi yoki bekor bo'ldi", color: "#DC2626", position: 60, systemType: "lost", isSystem: true },
];

export const STAGE_LABEL: Record<string, string> = CRM_STAGES.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<string, string>
);

export type Activity = {
  id: string;
  at: string; // ISO
  type: "note" | "stage" | "call" | "message" | "created";
  text: string;
};

export type LeadOverride = Partial<{
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalEstimate: number | null;
  tourTitle: string;
  travelers: number;
  travelDate: string | null;
}>;

export type LeadMeta = {
  stage?: CrmStage; // local override (only meaningful for still-pending / manual leads)
  tags: string[];
  activities: Activity[];
  hidden?: boolean; // archived (marketplace leads can't be hard-deleted)
  override?: LeadOverride; // local edits/enrichment on top of server data
};

export type Task = {
  id: string;
  leadId?: string;
  leadName?: string;
  title: string;
  dueAt?: string; // ISO
  done: boolean;
  createdAt: string;
};

export type ManualLead = {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  travelers: number;
  travelDate?: string | null;
  message?: string;
  tourTitle?: string;
  totalEstimate?: number | null;
  currency: string;
  stage: CrmStage;
  createdAt: string;
};

/**
 * Lid manbasi — mijoz qayerdan kelgani. Agent qo'lda ham belgilay oladi.
 * `manual` — eski lidlar uchun qoldirilgan (yangi ro'yxatda "offline" bor).
 */
export const LEAD_SOURCES = ["marketplace", "telegram", "instagram", "whatsapp", "offline", "manual"] as const;
export type CrmSource = (typeof LEAD_SOURCES)[number];

/** Tanlash uchun ko'rsatiladigan manbalar (eski `manual` ro'yxatda yo'q). */
export const LEAD_SOURCE_OPTIONS: CrmSource[] = ["offline", "telegram", "instagram", "whatsapp", "marketplace"];

export const LEAD_SOURCE_LABEL: Record<CrmSource, string> = {
  marketplace: "Marketplace",
  telegram: "Telegram",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  offline: "Offline",
  manual: "Qo'lda",
};

/** Serverdan kelgan qiymatni kanoniy manbaga keltiradi. */
export function normalizeSource(value?: string | null): CrmSource {
  const v = String(value || "").trim().toLowerCase();
  return (LEAD_SOURCES as readonly string[]).includes(v) ? (v as CrmSource) : "marketplace";
}

/** Normalized lead used everywhere in the CRM UI. */
export type CrmLead = {
  id: string;
  source: CrmSource;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  travelers: number;
  travelDate?: string | null;
  message?: string | null;
  tourTitle?: string | null;
  tourCity?: string | null;
  totalEstimate?: number | null;
  currency: string;
  createdAt?: string | null;
  serverStatus?: string; // marketplace only
  responseDeadlineAt?: string | null;
  stage: CrmStage;
  tags: string[];
  activities: Activity[];
  hidden: boolean;
  // Manba (qaysi reklama/kanal olib kelgan) — Hisobotlar bo'limida ishlatiladi
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  customerBirthday?: string | null;
  telegramHandle?: string | null;
  whatsappNumber?: string | null;
  paidAmount?: number | null;
  archived?: boolean;
  assignedMemberId?: string | null;
  assignedMemberName?: string | null;
};

/* ----------------------------------- keys --------------------------------- */

const NS = "travelorai_crm";
const key = (agencyId: string, bucket: string) => `${NS}_${agencyId}_${bucket}`;

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(value));
    window.dispatchEvent(new Event("crm:changed"));
  } catch {
    /* ignore quota errors */
  }
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* --------------------------------- lead meta ------------------------------ */

export type MetaMap = Record<string, LeadMeta>;

export function getMetaMap(agencyId: string): MetaMap {
  return read<MetaMap>(key(agencyId, "meta"), {});
}
function saveMetaMap(agencyId: string, map: MetaMap) {
  write(key(agencyId, "meta"), map);
}
export function getMeta(agencyId: string, leadId: string): LeadMeta {
  return getMetaMap(agencyId)[leadId] || { tags: [], activities: [] };
}
function mutateMeta(agencyId: string, leadId: string, fn: (m: LeadMeta) => LeadMeta) {
  const map = getMetaMap(agencyId);
  const current = map[leadId] || { tags: [], activities: [] };
  map[leadId] = fn({ ...current, tags: [...current.tags], activities: [...current.activities] });
  saveMetaMap(agencyId, map);
}

export function setLocalStage(agencyId: string, leadId: string, stage: CrmStage) {
  mutateMeta(agencyId, leadId, (m) => {
    m.stage = stage;
    m.activities = [
      { id: uid("act"), at: new Date().toISOString(), type: "stage", text: `Bosqich: ${STAGE_LABEL[stage] || stage}` },
      ...m.activities,
    ];
    return m;
  });
}

export function addActivity(agencyId: string, leadId: string, type: Activity["type"], text: string) {
  mutateMeta(agencyId, leadId, (m) => {
    m.activities = [{ id: uid("act"), at: new Date().toISOString(), type, text }, ...m.activities];
    return m;
  });
}

export function toggleTag(agencyId: string, leadId: string, tag: string) {
  mutateMeta(agencyId, leadId, (m) => {
    m.tags = m.tags.includes(tag) ? m.tags.filter((t) => t !== tag) : [...m.tags, tag];
    return m;
  });
}

export const SUGGESTED_TAGS = ["VIP", "Oila", "Umra", "Biznes", "Guruh", "Takroriy", "Chet el", "Ichki"];

export function setHidden(agencyId: string, leadId: string, hidden: boolean) {
  mutateMeta(agencyId, leadId, (m) => {
    m.hidden = hidden;
    m.activities = [
      { id: uid("act"), at: new Date().toISOString(), type: "stage", text: hidden ? "Arxivlandi" : "Arxivdan tiklandi" },
      ...m.activities,
    ];
    return m;
  });
}

export function setOverride(agencyId: string, leadId: string, patch: LeadOverride) {
  mutateMeta(agencyId, leadId, (m) => {
    m.override = { ...(m.override || {}), ...patch };
    m.activities = [
      { id: uid("act"), at: new Date().toISOString(), type: "note", text: "Ma'lumot tahrirlandi" },
      ...m.activities,
    ];
    return m;
  });
}

export function removeMeta(agencyId: string, leadId: string) {
  const map = getMetaMap(agencyId);
  if (map[leadId]) {
    delete map[leadId];
    saveMetaMap(agencyId, map);
  }
}

/* --------------------------------- tasks ---------------------------------- */

export function getTasks(agencyId: string): Task[] {
  return read<Task[]>(key(agencyId, "tasks"), []);
}
function saveTasks(agencyId: string, tasks: Task[]) {
  write(key(agencyId, "tasks"), tasks);
}
export function addTask(agencyId: string, task: Omit<Task, "id" | "createdAt" | "done">) {
  const tasks = getTasks(agencyId);
  tasks.unshift({ ...task, id: uid("task"), done: false, createdAt: new Date().toISOString() });
  saveTasks(agencyId, tasks);
}
export function toggleTask(agencyId: string, taskId: string) {
  saveTasks(
    agencyId,
    getTasks(agencyId).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
  );
}
export function deleteTask(agencyId: string, taskId: string) {
  saveTasks(
    agencyId,
    getTasks(agencyId).filter((t) => t.id !== taskId)
  );
}

/* ------------------------------- manual leads ----------------------------- */

export function getManualLeads(agencyId: string): ManualLead[] {
  return read<ManualLead[]>(key(agencyId, "manual"), []);
}
function saveManualLeads(agencyId: string, list: ManualLead[]) {
  write(key(agencyId, "manual"), list);
}
export function addManualLead(
  agencyId: string,
  data: Omit<ManualLead, "id" | "createdAt" | "stage"> & { stage?: CrmStage }
): string {
  const list = getManualLeads(agencyId);
  const id = uid("manual");
  list.unshift({ ...data, id, stage: data.stage || "new", createdAt: new Date().toISOString() });
  saveManualLeads(agencyId, list);
  mutateMeta(agencyId, id, (m) => {
    m.activities = [
      { id: uid("act"), at: new Date().toISOString(), type: "created", text: "Qo'lda qo'shildi" },
      ...m.activities,
    ];
    return m;
  });
  return id;
}
export function setManualStage(agencyId: string, id: string, stage: CrmStage) {
  saveManualLeads(
    agencyId,
    getManualLeads(agencyId).map((l) => (l.id === id ? { ...l, stage } : l))
  );
  setLocalStage(agencyId, id, stage);
}
export function updateManualLead(agencyId: string, id: string, patch: Partial<ManualLead>) {
  saveManualLeads(
    agencyId,
    getManualLeads(agencyId).map((l) => (l.id === id ? { ...l, ...patch } : l))
  );
  addActivity(agencyId, id, "note", "Ma'lumot tahrirlandi");
}
export function deleteManualLead(agencyId: string, id: string) {
  saveManualLeads(
    agencyId,
    getManualLeads(agencyId).filter((l) => l.id !== id)
  );
  removeMeta(agencyId, id);
}

/** Unified remove: manual → hard delete; marketplace → archive (server data preserved). */
export function removeLead(agencyId: string, lead: CrmLead) {
  if (lead.source === "manual") deleteManualLead(agencyId, lead.id);
  else setHidden(agencyId, lead.id, true);
}

/* --------------------------- booking → stage map -------------------------- */

export function stageFromBooking(booking: BookingItem): CrmStage {
  const s = String(booking.pipelineStage || "").trim();
  if (s) return s;
  // fallback (eski qatorlar): status'dan
  if (booking.status === "confirmed") return "won";
  if (booking.status === "completed") return "completed";
  if (booking.status === "rejected" || booking.status === "cancelled") return "lost";
  return "new";
}

/**
 * Barcha leadlar — SERVERDAN (marketplace + qo'lda, ikkovi ham TourBooking).
 * Bosqich (pipelineStage) va manba (source) serverda saqlanadi.
 * Teglar/izohlar/vazifalar hozircha localStorage'da (meta) — kelajakda serverga.
 */
export function buildLeads(agencyId: string, bookings: BookingItem[], serverMeta?: MetaMap): CrmLead[] {
  const metaMap = serverMeta || getMetaMap(agencyId);
  return bookings
    .map((b) => {
      const meta = metaMap[b.id] || { tags: [], activities: [] };
      return {
        id: b.id,
        source: normalizeSource(b.source),
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        customerEmail: b.customerEmail,
        travelers: b.travelers,
        travelDate: b.travelDate,
        message: b.message,
        tourTitle: b.leadTour || b.tour?.title,
        tourCity: b.leadCity || b.tour?.city,
        totalEstimate: b.totalEstimate,
        currency: b.currency || "USD",
        createdAt: b.createdAt,
        serverStatus: b.status,
        responseDeadlineAt: b.responseDeadlineAt,
        stage: stageFromBooking(b),
        tags: meta.tags,
        activities: meta.activities,
        hidden: !!meta.hidden,
        utmSource: b.utmSource,
        utmMedium: b.utmMedium,
        utmCampaign: b.utmCampaign,
        referrer: b.referrer,
        customerBirthday: b.customerBirthday,
        telegramHandle: b.leadTelegram,
        whatsappNumber: b.leadWhatsapp,
        paidAmount: b.paidAmount,
        archived: !!b.archived,
        assignedMemberId: b.assignedMemberId,
        assignedMemberName: b.assignedMemberName,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/* ------------------------------ customers view ---------------------------- */

export type CrmCustomer = {
  keyId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  leads: CrmLead[];
  totalValue: number;
  wonCount: number;
  lastAt: string;
  tags: string[];
  birthday?: string | null;
  birthdayBookingId?: string | null;
  hasTelegram: boolean;
};

export function buildCustomers(leads: CrmLead[]): CrmCustomer[] {
  const groups = new Map<string, CrmLead[]>();
  for (const lead of leads) {
    const gk =
      (lead.customerPhone && lead.customerPhone.replace(/\D/g, "")) ||
      (lead.customerEmail && lead.customerEmail.toLowerCase()) ||
      lead.customerName.trim().toLowerCase();
    const arr = groups.get(gk) || [];
    arr.push(lead);
    groups.set(gk, arr);
  }
  const out: CrmCustomer[] = [];
  for (const [gk, arr] of groups) {
    const sorted = [...arr].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const head = sorted[0];
    out.push({
      keyId: gk,
      name: head.customerName,
      phone: sorted.find((l) => l.customerPhone)?.customerPhone,
      email: sorted.find((l) => l.customerEmail)?.customerEmail,
      leads: sorted,
      totalValue: arr.filter((l) => l.stage === "won" || l.stage === "completed").reduce((s, l) => s + (l.totalEstimate || 0), 0),
      wonCount: arr.filter((l) => l.stage === "won" || l.stage === "completed").length,
      lastAt: head.createdAt || new Date().toISOString(),
      tags: Array.from(new Set(arr.flatMap((l) => l.tags))),
      birthday: sorted.find((l) => l.customerBirthday)?.customerBirthday || null,
      // Tug'ilgan kunни serverга yozish uchun — Telegramли yozuv bo'lsa o'sha, aks holda birinchisi
      birthdayBookingId: (sorted.find((l) => l.source === "telegram") || head).id,
      hasTelegram: sorted.some((l) => l.source === "telegram"),
    });
  }
  return out.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

/* --------------------------- messaging templates -------------------------- */

export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  return digits;
}

export function greetingTemplate(lead: { customerName: string; tourTitle?: string | null }): string {
  const tour = lead.tourTitle ? ` "${lead.tourTitle}" turi` : " sayohat";
  return `Assalomu alaykum, ${lead.customerName}! TravelorAI orqali${tour} bo'yicha so'rovingiz uchun rahmat. Sizga qulay bo'lsa, batafsil ma'lumot bersak bo'ladimi?`;
}

export function whatsappLink(phone?: string | null, text?: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function telegramLink(phone?: string | null): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  return `https://t.me/+${digits}`;
}

/** Telegram havolasi: @username / t.me link / raqam — biror biri bo'lmasa telefonga qaytadi. */
export function telegramLinkSmart(handle?: string | null, phone?: string | null): string | null {
  const h = (handle || "").trim();
  if (h) {
    if (/^https?:\/\//i.test(h)) return h;
    if (h.startsWith("@")) return `https://t.me/${h.slice(1)}`;
    if (/^[a-zA-Z][a-zA-Z0-9_]{3,}$/.test(h)) return `https://t.me/${h}`;
    const d = normalizePhone(h);
    if (d) return `https://t.me/+${d}`;
  }
  return telegramLink(phone);
}

/* --------------------------------- utils ---------------------------------- */

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hozir";
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} kun oldin`;
  const mo = Math.floor(d / 30);
  return `${mo} oy oldin`;
}
