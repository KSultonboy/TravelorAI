"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agencyApi } from "./api";
import { useAgencySession } from "./session";
import { pushNotif } from "./notify";
import type { BookingStats } from "./types";
import {
  buildCustomers,
  buildLeads,
  getTasks,
  type CrmLead,
  type CrmStage,
} from "./crm";

/**
 * Reactive CRM layer. Leadlar (marketplace + qo'lda) SERVERdan keladi.
 * Har bir bosqich o'zgarishi backendning /bookings/:id/stage endpointiga yoziladi —
 * pipelineStage DB'da saqlanadi, refresh'ni va boshqa qurilmani ko'taradi.
 */
export function useCrm() {
  const { me, bookings, refreshBookings, refresh } = useAgencySession();
  const agencyId = me?.agency?.id || me?.account.id || "anon";
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string>("");

  // re-derive whenever the local store fires a change
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener("crm:changed", bump);
    return () => window.removeEventListener("crm:changed", bump);
  }, []);

  const allLeads = useMemo(() => buildLeads(agencyId, bookings), [agencyId, bookings, version]);
  const leads = useMemo(() => allLeads.filter((l) => !l.hidden && !l.archived), [allLeads]);
  const hiddenLeads = useMemo(() => allLeads.filter((l) => l.hidden), [allLeads]);
  const archivedLeads = useMemo(() => allLeads.filter((l) => l.archived && !l.hidden), [allLeads]);
  const tasks = useMemo(() => getTasks(agencyId), [agencyId, version]);
  const customers = useMemo(() => buildCustomers(leads), [leads]);

  const move = useCallback(
    async (lead: CrmLead, target: CrmStage) => {
      if (lead.stage === target) return;
      setBusyId(lead.id);
      const result = await agencyApi<{ stats?: BookingStats }>(`/bookings/${lead.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stage: target }),
      });
      if (result.success) {
        await refreshBookings();
        await refresh(true);
        const sub = `${lead.customerName}${lead.tourTitle ? ` • ${lead.tourTitle}` : ""}`;
        if (target === "won") pushNotif(agencyId, { kind: "stage", stage: target, title: "Kelishuv yopildi", sub });
        else if (target === "completed") pushNotif(agencyId, { kind: "payment", stage: target, title: "To'lov qabul qilindi", sub });
        else if (target === "lost") pushNotif(agencyId, { kind: "stage", stage: target, title: "Lid yo'qotildi", sub });
        else if (target === "contacted") pushNotif(agencyId, { kind: "stage", stage: target, title: "Mijoz bilan bog'lanildi", sub });
        else if (target === "quoted") pushNotif(agencyId, { kind: "stage", stage: target, title: "Taklif yuborildi", sub });
      }
      setBusyId("");
      return result.success;
    },
    [refreshBookings, refresh, agencyId]
  );

  return { agencyId, leads, hiddenLeads, archivedLeads, tasks, customers, move, busyId };
}
