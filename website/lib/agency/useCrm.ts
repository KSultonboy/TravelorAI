"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agencyApi } from "./api";
import { useAgencySession } from "./session";
import { pushNotif } from "./notify";
import { saveRequisites, saveTemplates, type DocRequisites, type DocTemplates } from "./documents";
import type { BookingStats } from "./types";
import { buildCustomers, buildLeads, type Activity, type CrmLead, type CrmStage, type LeadMeta, type MetaMap, type Task } from "./crm";

export type CrmMember = { id: string; name: string; email: string; role: string };
type ServerTag = { id: string; bookingId: string; name: string; createdAt: string };
type ServerActivity = { id: string; bookingId: string; type: Activity["type"]; text: string; createdAt: string };
type ServerTemplate = { type: "shartnoma" | "invoice"; name: string; content: string };
type ServerRequisite = Partial<{ legalName: string; director: string; address: string; taxId: string; bankName: string; bankAccount: string; mfo: string; phone: string; email: string }>;
type Bootstrap = { tasks: Task[]; tags: ServerTag[]; activities: ServerActivity[]; templates: ServerTemplate[]; requisite: ServerRequisite | null; members: CrmMember[] };

function readJson(key: string) {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
}

function localPayload(agencyId: string) {
  return {
    migrationId: "v1",
    tasks: readJson(`travelorai_crm_${agencyId}_tasks`) || [],
    meta: readJson(`travelorai_crm_${agencyId}_meta`) || {},
    templates: readJson(`travelorai_doc_tpl_${agencyId}`) || undefined,
    requisite: readJson(`travelorai_doc_req_${agencyId}`) || undefined,
  };
}

function cacheDocuments(agencyId: string, data: Bootstrap) {
  if (data.templates?.length) {
    const templates: Partial<DocTemplates> = {};
    for (const item of data.templates) {
      if (item.type === "shartnoma") templates.shartnoma = { title: item.name, body: item.content };
      if (item.type === "invoice") templates.invoice = { title: item.name, note: item.content };
    }
    if (templates.shartnoma && templates.invoice) saveTemplates(agencyId, templates as DocTemplates);
  }
  if (data.requisite) {
    saveRequisites(agencyId, {
      legalName: data.requisite.legalName || "", director: data.requisite.director || "", address: data.requisite.address || "",
      stir: data.requisite.taxId || "", bankName: data.requisite.bankName || "", account: data.requisite.bankAccount || "",
      mfo: data.requisite.mfo || "", phone: data.requisite.phone || "",
    } satisfies DocRequisites);
  }
}

export function useCrm() {
  const { me, bookings, refreshBookings, refresh } = useAgencySession();
  const agencyId = me?.agency?.id || me?.account.id || "anon";
  const [data, setData] = useState<Bootstrap>({ tasks: [], tags: [], activities: [], templates: [], requisite: null, members: [] });
  const [busyId, setBusyId] = useState<string>("");

  const reloadCrm = useCallback(async () => {
    if (!me?.agency?.id) return;
    const result = await agencyApi<Bootstrap>("/crm/bootstrap");
    if (result.success) { setData(result.data); cacheDocuments(me.agency.id, result.data); }
  }, [me?.agency?.id]);

  useEffect(() => {
    if (!me?.agency?.id) return;
    let cancelled = false;
    const run = async () => {
      const id = me.agency!.id;
      const marker = `travelorai_crm_server_imported_v1_${id}`;
      if (!window.localStorage.getItem(marker)) {
        const imported = await agencyApi("/crm/import/local", { method: "POST", body: JSON.stringify(localPayload(id)) });
        if (imported.success) window.localStorage.setItem(marker, new Date().toISOString());
      }
      if (!cancelled) await reloadCrm();
    };
    void run();
    return () => { cancelled = true; };
  }, [me?.agency?.id, reloadCrm]);

  // Boshqa kompyuter/xodim kiritgan o'zgarishlarni sahifani qayta ochmasdan olish.
  useEffect(() => {
    if (!me?.agency?.id) return;
    const sync = () => {
      if (document.visibilityState === "visible") void Promise.all([reloadCrm(), refreshBookings()]);
    };
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, 30_000);
    return () => { window.removeEventListener("focus", sync); window.clearInterval(timer); };
  }, [me?.agency?.id, reloadCrm, refreshBookings]);

  const meta = useMemo<MetaMap>(() => {
    const map: MetaMap = {};
    const ensure = (bookingId: string): LeadMeta => (map[bookingId] ||= { tags: [], activities: [] });
    for (const tag of data.tags) ensure(tag.bookingId).tags.push(tag.name);
    for (const activity of data.activities) ensure(activity.bookingId).activities.push({ id: activity.id, at: activity.createdAt, type: activity.type, text: activity.text });
    return map;
  }, [data.activities, data.tags]);

  const allLeads = useMemo(() => buildLeads(agencyId, bookings, meta), [agencyId, bookings, meta]);
  const leads = useMemo(() => allLeads.filter((l) => !l.hidden && !l.archived), [allLeads]);
  const hiddenLeads = useMemo(() => allLeads.filter((l) => l.hidden), [allLeads]);
  const archivedLeads = useMemo(() => allLeads.filter((l) => l.archived && !l.hidden), [allLeads]);
  const customers = useMemo(() => buildCustomers(leads), [leads]);

  const move = useCallback(async (lead: CrmLead, target: CrmStage) => {
    if (lead.stage === target) return;
    setBusyId(lead.id);
    const result = await agencyApi<{ stats?: BookingStats }>(`/bookings/${lead.id}/stage`, { method: "PATCH", body: JSON.stringify({ stage: target }) });
    if (result.success) {
      await Promise.all([refreshBookings(), refresh(true), reloadCrm()]);
      const sub = `${lead.customerName}${lead.tourTitle ? ` • ${lead.tourTitle}` : ""}`;
      if (target === "won") pushNotif(agencyId, { kind: "stage", stage: target, title: "Kelishuv yopildi", sub });
      else if (target === "completed") pushNotif(agencyId, { kind: "payment", stage: target, title: "To'lov qabul qilindi", sub });
      else if (target === "lost") pushNotif(agencyId, { kind: "stage", stage: target, title: "Lid yo'qotildi", sub });
      else if (target === "contacted") pushNotif(agencyId, { kind: "stage", stage: target, title: "Mijoz bilan bog'lanildi", sub });
      else if (target === "quoted") pushNotif(agencyId, { kind: "stage", stage: target, title: "Taklif yuborildi", sub });
    }
    setBusyId("");
    return result.success;
  }, [agencyId, refresh, refreshBookings, reloadCrm]);

  const createTask = useCallback(async (task: { title: string; dueAt?: string; leadId?: string; assignedMemberId?: string }) => {
    const result = await agencyApi("/crm/tasks", { method: "POST", body: JSON.stringify(task) });
    if (result.success) await reloadCrm();
    return result.success;
  }, [reloadCrm]);
  const toggleTask = useCallback(async (task: Task) => {
    const result = await agencyApi(`/crm/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: !task.done }) });
    if (result.success) await reloadCrm();
  }, [reloadCrm]);
  const deleteTask = useCallback(async (taskId: string) => {
    const result = await agencyApi(`/crm/tasks/${taskId}`, { method: "DELETE" });
    if (result.success) await reloadCrm();
  }, [reloadCrm]);

  return { agencyId, leads, hiddenLeads, archivedLeads, tasks: data.tasks, customers, members: data.members, documents: data, move, busyId, reloadCrm, createTask, toggleTask, deleteTask };
}
