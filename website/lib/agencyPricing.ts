import type { PublicTariff } from "@/lib/marketingApi";

/** CRM sinov muddati (kun) — marketing matnlarida yagona manba. */
export const CRM_TRIAL_DAYS = 14;

/** Backend javob bermasa — eng arzon tarif (Starter) narxi. */
const FALLBACK_MIN_UZS = 99000;

export function formatSom(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Eng arzon pullik tarif narxi (so'm) — narxlar backenddan keladi. */
export function minMonthlyUzs(tariffs: PublicTariff[]): number {
  const prices = tariffs
    .filter((t) => t.slug !== "enterprise")
    .map((t) => Number(t.priceMonthlyUzs) || 0)
    .filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : FALLBACK_MIN_UZS;
}

/** Agentliklar uchun halol pozitsiya: «Saytda joylashtirish bepul. CRM — 14 kun bepul, keyin oyiga 99 000 so‘mdan.» */
export function agencyOfferLine(tariffs: PublicTariff[]): string {
  return `Saytda joylashtirish bepul. CRM — ${CRM_TRIAL_DAYS} kun bepul, keyin oyiga ${formatSom(minMonthlyUzs(tariffs))} so‘mdan.`;
}
