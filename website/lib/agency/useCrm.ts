"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agencyApi } from "./api";
import { useAgencySession } from "./session";
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
  const leads = useMemo(() => allLeads.filter((l) => !l.hidden), [allLeads]);
  const hiddenLeads = useMemo(() => allLeads.filter((l) => l.hidden), [allLeads]);
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
      }
      setBusyId("");
      return result.success;
    },
    [refreshBookings, refresh]
  );

  return { agencyId, leads, hiddenLeads, tasks, customers, move, busyId };
}
