"use client";

import { useAgencySession } from "@/lib/agency/session";

/**
 * Agentlik uchun kengaytirilgan modullar yoqilganmi (backend `TourAgency.advancedFeatures`,
 * /agency/auth/me → agency.advancedFeatures). Maydon kelmasa (eski backend) — yoqiq deb
 * hisoblaymiz, shunda hech kim mavjud imkoniyatini yo'qotmaydi; backend baribir 403
 * FEATURE_DISABLED bilan himoya qiladi.
 */
export function useAdvancedFeatures(): boolean {
  const { me } = useAgencySession();
  const agency = me?.agency as { advancedFeatures?: boolean } | null | undefined;
  return agency?.advancedFeatures !== false;
}
