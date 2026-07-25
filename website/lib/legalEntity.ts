/**
 * Ijrochining (TravelorAI) huquqiy rekvizitlari — bitta manba.
 * Oferta, hisob-faktura va aloqa sahifalari shu yerdan oladi.
 *
 * ⚠️ MUHIM: yuridik shaxs ro'yxatdan o'tgach quyidagi qatorlarni to'ldiring.
 * Bo'sh qolgan maydonlar sahifada KO'RSATILMAYDI (soxta ma'lumot chiqmaydi) —
 * Click/Payme shartnomasidan oldin bularni to'ldirish SHART.
 */
export const LEGAL_ENTITY = {
  /** To'liq huquqiy nom (guvohnoma bo'yicha) */
  legalName: "«RIZEON» oilaviy korxona",
  /** STIR (INN) */
  stir: "310779970",
  /** Yuridik manzil */
  address: "Xorazm viloyati, Xonqa tumani, Xonqa, Gulg'uncha MFY, Nafosat ko'chasi, 1/42-uy",
  /** Direktor F.I.Sh. */
  director: "Aminov Akmal Komiljonovich",
  /** Bank nomi */
  bankName: "«Agrobank» ATB, Xonqa filiali",
  /** Hisob raqami (h/r) */
  account: "20208000905694231001",
  /** MFO — bankdan olinadi (to'lov topshiriqnomasida yoki bank ilovasida) */
  mfo: "",
} as const;

/** Har doim mavjud bo'lgan aloqa ma'lumotlari (yuridik shaxsga bog'liq emas). */
export const CONTACT = {
  email: "support@travelorai.com",
  site: "travelorai.com",
  telegram: "https://t.me/travelorai",
} as const;

/** Rekvizitlar to'ldirilganmi? */
export function hasLegalEntity(): boolean {
  return Boolean(LEGAL_ENTITY.legalName && LEGAL_ENTITY.stir);
}

/** Oferta/hujjatlarda ko'rsatish uchun rekvizit qatorlari (faqat to'ldirilganlari). */
export function legalLines(): string[] {
  const L = LEGAL_ENTITY;
  const rows: [string, string][] = [
    ["To'liq nom", L.legalName],
    ["STIR", L.stir],
    ["Yuridik manzil", L.address],
    ["Direktor", L.director],
    ["Bank", L.bankName],
    ["Hisob raqami (h/r)", L.account],
    ["MFO", L.mfo],
  ];
  return rows.filter(([, v]) => Boolean(v)).map(([k, v]) => `${k}: ${v}`);
}
