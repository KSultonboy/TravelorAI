"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { agencyApi } from "./api";
import { useAgencySession } from "./session";
import type { BookingStats } from "./types";
import {
  addActivity,
  buildCustomers,
  buildLeads,
  getTasks,
  setLocalStage,
  setManualStage,
  STAGE_LABEL,
  type CrmLead,
  type CrmStage,
} from "./crm";

/**
 * Reactive CRM layer: merges real bookings + local manual leads, resolves
 * pipeline stages, and routes meaningful stage moves to the backend booking
 * endpoints while keeping intermediate stages local.
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

      // Manual leads: purely local
      if (lead.source === "manual") {
        setManualStage(agencyId, lead.id, target);
        return;
      }

      // Marketplace leads: route to the correct server action
      const status = lead.serverStatus;
      let serverAction: "confirmed" | "rejected" | "cancelled" | "completed" | null = null;

      if (target === "won" && status === "pending") serverAction = "confirmed";
      else if (target === "lost" && status === "pending") serverAction = "rejected";
      else if (target === "lost" && status === "confirmed") serverAction = "cancelled";
      else if (target === "completed" && status === "confirmed") serverAction = "completed";
      else if (["new", "contacted", "quoted"].includes(target) && status === "pending") {
        // intermediate working stage — local only
        setLocalStage(agencyId, lead.id, target);
        return;
      } else {
        // transition not permitted for a decided booking — snap back silently
        return;
      }

      setBusyId(lead.id);
      const result = await agencyApi<{ stats?: BookingStats }>(`/bookings/${lead.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: serverAction }),
      });
      if (result.success) {
        addActivity(agencyId, lead.id, "stage", `Bosqich: ${STAGE_LABEL[target]}`);
        await refreshBookings();
        await refresh(true);
      }
      setBusyId("");
      return result.success;
    },
    [agencyId, refreshBookings, refresh]
  );

  return { agencyId, leads, hiddenLeads, tasks, customers, move, busyId };
}
