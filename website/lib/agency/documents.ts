"use client";

/* ============================================================================
 * TravelorAI — Hujjat generatsiyasi (frontend, print → PDF)
 * ----------------------------------------------------------------------------
 * Lid ma'lumotidan chop etishga tayyor rasmiy hujjatlar yasaydi:
 *   - Shartnoma (turistik xizmatlar shartnomasi)
 *   - Vaucher (turistik vaucher)
 *   - Hisob-faktura (to'lov hisobi)
 *
 * PDF — brauzerning o'z "Chop etish → PDF saqlash" imkoniyati orqali. Hech
 * qanday yangi kutubxona kerak emas (prod backend overlay `npm install`
 * qilmaydi; bu esa umuman backendсиz ishlaydi).
 *
 * Agentlikning huquqiy rekvizitlari (STIR, bank, direktor, manzil) hozircha
 * DB'да yo'q, shuning uchun localStorage'да saqlanadi — bu agentlikning O'Z
 * ma'lumoti (mijoz PII emas). Kelajakda serverga ko'chirish — drop-in.
 * ========================================================================== */

import type { MeData } from "./types";

export type DocType = "shartnoma" | "vaucher" | "invoice";

export const DOC_LABEL: Record<DocType, string> = {
  shartnoma: "Shartnoma",
  vaucher: "Vaucher",
  invoice: "Hisob-faktura",
};

export const DOC_LIST: { type: DocType; label: string; hint: string }[] = [
  { type: "shartnoma", label: "Shartnoma", hint: "Turistik xizmat ko'rsatish shartnomasi" },
  { type: "vaucher", label: "Vaucher", hint: "Turistik vaucher — tasdiqnoma" },
  { type: "invoice", label: "Hisob-faktura", hint: "To'lov uchun hisob" },
];

/* ------------------------- rekvizitlar (localStorage) --------------------- */

export type DocRequisites = {
  legalName: string; // To'liq huquqiy nom — «Guli Travel» MChJ
  stir: string; // STIR / INN
  address: string; // Yuridik manzil
  phone: string; // Telefon
  bankName: string; // Bank nomi
  account: string; // Hisob raqami (h/r)
  mfo: string; // MFO
  director: string; // Direktor F.I.Sh.
};

export const EMPTY_REQUISITES: DocRequisites = {
  legalName: "", stir: "", address: "", phone: "", bankName: "", account: "", mfo: "", director: "",
};

const REQ_KEY = (agencyId: string) => `travelorai_doc_req_${agencyId}`;
const SEQ_KEY = (agencyId: string) => `travelorai_doc_seq_${agencyId}`;

export function getRequisites(agencyId: string): DocRequisites {
  if (typeof window === "undefined") return { ...EMPTY_REQUISITES };
  try {
    const raw = window.localStorage.getItem(REQ_KEY(agencyId));
    return raw ? { ...EMPTY_REQUISITES, ...JSON.parse(raw) } : { ...EMPTY_REQUISITES };
  } catch {
    return { ...EMPTY_REQUISITES };
  }
}

export function saveRequisites(agencyId: string, r: DocRequisites) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REQ_KEY(agencyId), JSON.stringify(r));
  } catch {
    /* ignore quota */
  }
}

/** Har hujjat generatsiyasida oshib boradigan tartib raqami (agentlik bo'yicha). */
function nextSeq(agencyId: string): number {
  if (typeof window === "undefined") return 1;
  try {
    const n = Number(window.localStorage.getItem(SEQ_KEY(agencyId)) || "0") + 1;
    window.localStorage.setItem(SEQ_KEY(agencyId), String(n));
    return n;
  } catch {
    return 1;
  }
}

/* --------------------------------- helpers -------------------------------- */

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** «22» iyul 2026 yil */
function longDate(d: Date): string {
  return `«${d.getDate()}» ${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()} yil`;
}

/** dd.mm.yyyy — jadval va qisqa sanalar uchun */
function shortDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const CURRENCY_LABEL: Record<string, string> = {
  USD: "AQSh dollari", UZS: "so'm", EUR: "yevro", RUB: "rubl",
};
function currencyLabel(code: string): string {
  return CURRENCY_LABEL[code] || code;
}

function money(n?: number | null, currency = "USD"): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("ru-RU")} ${currency}`;
}

/* --------------------- son → so'z (o'zbekcha, butun son) ------------------ */

const ONES = ["", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];

function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(`${ONES[h]} yuz`);
  const t = Math.floor(rest / 10);
  const o = rest % 10;
  if (t) parts.push(TENS[t]);
  if (o) parts.push(ONES[o]);
  return parts.join(" ");
}

/** 0..999_999_999 oralig'idagi butun sonni o'zbekcha so'z bilan. */
export function sumWordsUz(value: number): string {
  const n = Math.floor(Math.abs(value || 0));
  if (n === 0) return "nol";
  const scales = [
    { div: 1_000_000_000, name: "milliard" },
    { div: 1_000_000, name: "million" },
    { div: 1_000, name: "ming" },
  ];
  let rem = n;
  const chunks: string[] = [];
  for (const s of scales) {
    const q = Math.floor(rem / s.div);
    if (q) { chunks.push(`${below1000(q)} ${s.name}`); rem %= s.div; }
  }
  if (rem) chunks.push(below1000(rem));
  return chunks.join(" ").trim();
}

/* ------------------------------- doc payload ------------------------------ */

export type DocLead = {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  travelers: number;
  travelDate?: string | null;
  tourTitle?: string | null;
  tourCity?: string | null;
  totalEstimate?: number | null;
  currency: string;
};

/* ---------------------------- matn shablonlari ---------------------------- */
// Har agentlik hujjat MATNINI o'zi sozlashi mumkin (struktura bir xil bo'lmasa).
// localStorage'да saqlanadi. Belgilar (placeholder) lid/agentlik ma'lumotidan to'ladi.

export type DocTemplates = {
  shartnoma: { title: string; body: string };
  vaucher: { title: string; services: string; note: string };
  invoice: { title: string; note: string };
};

export const DEFAULT_DOC_TEMPLATES: DocTemplates = {
  shartnoma: {
    title: "TURISTIK XIZMAT KO'RSATISH SHARTNOMASI",
    body:
      "Quyida «Ijrochi» deb ataluvchi {agentlik} nomidan direktor {direktor} bir tomondan, hamda " +
      "«Buyurtmachi» deb ataluvchi {mijoz} ikkinchi tomondan, ushbu shartnomani quyidagilar to'g'risida tuzdilar:\n\n" +
      "## 1. Shartnoma predmeti\n" +
      "1.1. Ijrochi Buyurtmachiga turistik xizmat — {yonalish} yo'nalishi bo'yicha sayohatni tashkil etadi. Turistlar soni: {kishilar} kishi.\n" +
      "1.2. Sayohat sanasi: {sana}.\n\n" +
      "## 2. Xizmat narxi va to'lov tartibi\n" +
      "2.1. Xizmatning umumiy qiymati: {narx} ({narx_sozda}).\n" +
      "2.2. To'lov tartibi: Buyurtmachi shartnoma imzolanganda oldindan 50% miqdorida to'lovni amalga oshiradi, qolgani sayohat boshlanishidan oldin to'lanadi.\n\n" +
      "## 3. Tomonlarning majburiyatlari\n" +
      "3.1. Ijrochi xizmatni sifatli va o'z vaqtida ko'rsatish, kerakli hujjatlar (vaucher, bilet, bron) bilan ta'minlash majburiyatini oladi.\n" +
      "3.2. Buyurtmachi to'lovni o'z vaqtida amalga oshirish va sayohat uchun zarur hujjatlarni (pasport va h.k.) taqdim etish majburiyatini oladi.\n\n" +
      "## 4. Javobgarlik va nizolar\n" +
      "4.1. Shartnoma shartlari buzilganda tomonlar O'zbekiston Respublikasi qonunchiligiga muvofiq javobgar bo'ladilar.\n" +
      "4.2. Nizolar muzokaralar yo'li bilan, kelishilmaganda esa sud tartibida hal etiladi.\n\n" +
      "## 5. Amal qilish muddati\n" +
      "5.1. Ushbu shartnoma imzolangan kundan boshlab xizmat to'liq ko'rsatilgunga qadar amal qiladi va ikki nusxada, har ikkala tomon uchun bir xil kuchga ega tuzildi.",
  },
  vaucher: {
    title: "TURISTIK VAUCHER",
    services: "{yonalish} bo'yicha to'liq paket",
    note:
      "Ushbu vaucher {agentlik} tomonidan berilgan bo'lib, yuqorida ko'rsatilgan turistik " +
      "xizmatlarning to'langanligini va tasdiqlanganligini bildiradi.",
  },
  invoice: {
    title: "HISOB-FAKTURA (TO'LOV UCHUN)",
    note:
      "To'lov yuqoridagi bank rekvizitlari bo'yicha 3 bank kuni ichida amalga oshirilishi so'raladi. " +
      "To'lov maqsadida ushbu hisob-faktura raqamini ko'rsating.",
  },
};

/** Foydalanuvchiga ko'rsatiladigan belgilar ro'yxati. */
export const DOC_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "{mijoz}", label: "mijoz ismi" },
  { key: "{agentlik}", label: "agentlik (huquqiy nomi)" },
  { key: "{direktor}", label: "direktor F.I.Sh." },
  { key: "{yonalish}", label: "tur + shahar" },
  { key: "{tur}", label: "tur nomi" },
  { key: "{shahar}", label: "shahar" },
  { key: "{kishilar}", label: "turistlar soni" },
  { key: "{sana}", label: "sayohat sanasi" },
  { key: "{narx}", label: "narx (raqamda)" },
  { key: "{narx_sozda}", label: "narx (so'z bilan)" },
];

const TPL_KEY = (agencyId: string) => `travelorai_doc_tpl_${agencyId}`;

export function getTemplates(agencyId: string): DocTemplates {
  const d = DEFAULT_DOC_TEMPLATES;
  if (typeof window === "undefined") return JSON.parse(JSON.stringify(d));
  try {
    const raw = window.localStorage.getItem(TPL_KEY(agencyId));
    if (!raw) return JSON.parse(JSON.stringify(d));
    const s = JSON.parse(raw);
    return {
      shartnoma: { ...d.shartnoma, ...(s.shartnoma || {}) },
      vaucher: { ...d.vaucher, ...(s.vaucher || {}) },
      invoice: { ...d.invoice, ...(s.invoice || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(d));
  }
}

export function saveTemplates(agencyId: string, t: DocTemplates) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TPL_KEY(agencyId), JSON.stringify(t));
  } catch {
    /* ignore quota */
  }
}

function fillTpl(text: string, ctx: Record<string, string>): string {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (k in ctx ? ctx[k] : m));
}

/** Mini-belgilash -> HTML: "## " sarlavha, bo'sh qator xatboshini ajratadi. */
function renderBody(text: string, ctx: Record<string, string>): string {
  const filled = fillTpl(text, ctx);
  const lines = filled.split("\n");
  let html = "";
  let para: string[] = [];
  const flush = () => { if (para.length) { html += `<p>${esc(para.join(" "))}</p>`; para = []; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) { flush(); html += `<h3>${esc(line.slice(3).trim())}</h3>`; }
    else para.push(line);
  }
  flush();
  return html;
}

type BuildInput = { type: DocType; agencyId: string; me: MeData; lead: DocLead };

type Ctx = {
  type: DocType;
  brand: string; // Agentlik ko'rinadigan nomi
  legal: string; // Huquqiy nom (rekvizit yoki brand)
  logo?: string | null;
  city: string;
  agencyPhone: string;
  agencyEmail: string;
  agencyWeb?: string | null;
  req: DocRequisites;
  lead: DocLead;
  number: string;
  today: Date;
  travelers: number;
  total: number | null;
  currency: string;
  tpl: DocTemplates;
};

/** Shablon belgilarini lid/agentlik ma'lumotidan to'ldirish uchun kontekst. */
function tplCtx(c: Ctx): Record<string, string> {
  const yonalish = c.lead.tourCity
    ? `${c.lead.tourTitle || "sayohat"} (${c.lead.tourCity})`
    : (c.lead.tourTitle || "sayohat");
  return {
    mijoz: c.lead.customerName || "",
    agentlik: c.legal || c.brand || "",
    direktor: c.req.director || "",
    tur: c.lead.tourTitle || "",
    shahar: c.lead.tourCity || "",
    yonalish,
    kishilar: String(c.travelers || ""),
    sana: shortDate(c.lead.travelDate),
    narx: c.total != null ? money(c.total, c.currency) : "____",
    narx_sozda: c.total != null ? `${sumWordsUz(c.total)} ${currencyLabel(c.currency)}` : "",
    stir: c.req.stir || "",
    telefon: c.agencyPhone || "",
  };
}

/* Ekranда tahrirlanadigan, chop etishда oddiy matnга aylanadigan maydon. */
function fill(value: string, placeholder = "________________"): string {
  const v = String(value || "").trim();
  return `<span class="fill" contenteditable="true" data-ph="${esc(placeholder)}">${esc(v)}</span>`;
}

function headerBlock(c: Ctx): string {
  const contacts = [c.agencyPhone, c.agencyEmail, c.agencyWeb].filter(Boolean).map(esc).join(" · ");
  const mono = esc(c.brand.slice(0, 2).toUpperCase());
  const badge = c.logo
    ? `<img src="${esc(c.logo)}" alt="" class="logo" />`
    : `<div class="mono">${mono}</div>`;
  return `
    <header class="doc-head">
      <div class="brand">
        <div class="brand-name">${esc(c.brand)}</div>
        ${c.req.legalName ? `<div class="brand-legal">${esc(c.req.legalName)}</div>` : ""}
        ${contacts ? `<div class="brand-contacts">${contacts}</div>` : ""}
        ${c.req.stir ? `<div class="brand-contacts">STIR: ${esc(c.req.stir)}</div>` : ""}
      </div>
      ${badge}
    </header>
    <div class="rule"></div>`;
}

function titleBlock(title: string, c: Ctx): string {
  return `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">
      <span>№ ${fill(c.number, "____")}</span>
      <span>${esc(c.city)} sh.</span>
      <span>${longDate(c.today)}</span>
    </div>`;
}

function signBlock(leftRole: string, leftName: string, rightRole: string, rightName: string): string {
  return `
    <div class="signs">
      <div class="sign">
        <div class="sign-role">${esc(leftRole)}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${esc(leftName || "")}</div>
        <div class="sign-hint">imzo / muhr</div>
      </div>
      <div class="sign">
        <div class="sign-role">${esc(rightRole)}</div>
        <div class="sign-line"></div>
        <div class="sign-name">${esc(rightName || "")}</div>
        <div class="sign-hint">imzo</div>
      </div>
    </div>`;
}

/* --------------------------------- shartnoma ------------------------------ */

function contractBody(c: Ctx): string {
  const ctx = tplCtx(c);
  const t = c.tpl.shartnoma;
  return `
    ${titleBlock(fillTpl(t.title, ctx), c)}
    <div class="doc-body">${renderBody(t.body, ctx)}</div>

    <div class="req-cols">
      <div class="req-col">
        <div class="req-h">IJROCHI</div>
        <div>${esc(c.legal)}</div>
        ${c.req.address ? `<div>Manzil: ${esc(c.req.address)}</div>` : `<div>Manzil: ${fill("", "____________")}</div>`}
        ${c.req.stir ? `<div>STIR: ${esc(c.req.stir)}</div>` : ""}
        ${c.req.bankName ? `<div>Bank: ${esc(c.req.bankName)}</div>` : ""}
        ${c.req.account ? `<div>h/r: ${esc(c.req.account)}</div>` : ""}
        ${c.req.mfo ? `<div>MFO: ${esc(c.req.mfo)}</div>` : ""}
        <div>Tel: ${esc(c.agencyPhone || "—")}</div>
      </div>
      <div class="req-col">
        <div class="req-h">BUYURTMACHI</div>
        <div>${esc(c.lead.customerName)}</div>
        <div>Tel: ${esc(c.lead.customerPhone || "—")}</div>
        <div>Pasport: ${fill("", "________________")}</div>
        <div>Manzil: ${fill("", "________________")}</div>
      </div>
    </div>

    ${signBlock("Ijrochi", c.req.director || c.brand, "Buyurtmachi", c.lead.customerName)}`;
}

/* --------------------------------- vaucher -------------------------------- */

function voucherBody(c: Ctx): string {
  const ctx = tplCtx(c);
  const t = c.tpl.vaucher;
  return `
    ${titleBlock(fillTpl(t.title, ctx), c)}
    <table class="kv">
      <tbody>
        <tr><td class="k">Turist(lar)</td><td><b>${esc(c.lead.customerName)}</b></td></tr>
        <tr><td class="k">Turistlar soni</td><td>${esc(c.travelers)} kishi</td></tr>
        <tr><td class="k">Yo'nalish</td><td><b>${esc(c.lead.tourTitle || "—")}</b>${c.lead.tourCity ? ` — ${esc(c.lead.tourCity)}` : ""}</td></tr>
        <tr><td class="k">Sayohat sanasi</td><td>${esc(shortDate(c.lead.travelDate))}</td></tr>
        <tr><td class="k">Muddati</td><td>${fill("", "__ kun / __ kecha")}</td></tr>
        <tr><td class="k">Mehmonxona</td><td>${fill("", "________________")}</td></tr>
        <tr><td class="k">Ovqatlanish</td><td>${fill("", "____________ (BB / HB / FB)")}</td></tr>
        <tr><td class="k">Transfer</td><td>${fill("", "________________")}</td></tr>
      </tbody>
    </table>

    <h3>Kiritilgan xizmatlar</h3>
    <div class="services" contenteditable="true" data-ph="Har bir xizmatni yangi qatorda yozing — aviabilet, mehmonxona, transfer, ekskursiya, sug'urta...">${esc(fillTpl(t.services, ctx))}</div>

    <p class="voucher-note">${esc(fillTpl(t.note, ctx))}</p>

    ${signBlock("Xizmat ko'rsatuvchi", c.req.director || c.brand, "Qabul qildim", c.lead.customerName)}`;
}

/* ------------------------------ hisob-faktura ----------------------------- */

function invoiceBody(c: Ctx): string {
  const qty = Math.max(1, c.travelers || 1);
  const total = c.total != null ? c.total : 0;
  const unit = c.total != null ? Math.round((c.total / qty) * 100) / 100 : 0;
  const totalStr = c.total != null ? money(c.total, c.currency) : "—";
  const words = c.total != null ? `${sumWordsUz(total)} ${currencyLabel(c.currency)}` : "";
  const item = c.lead.tourTitle
    ? `${c.lead.tourTitle}${c.lead.tourCity ? ` (${c.lead.tourCity})` : ""} — turistik xizmat`
    : "Turistik xizmat";
  const ctx = tplCtx(c);
  const t = c.tpl.invoice;
  return `
    ${titleBlock(fillTpl(t.title, ctx), c)}

    <div class="req-cols">
      <div class="req-col">
        <div class="req-h">YETKAZIB BERUVCHI</div>
        <div><b>${esc(c.legal)}</b></div>
        ${c.req.address ? `<div>${esc(c.req.address)}</div>` : ""}
        ${c.req.stir ? `<div>STIR: ${esc(c.req.stir)}</div>` : ""}
        ${c.req.bankName ? `<div>Bank: ${esc(c.req.bankName)}</div>` : `<div>Bank: ${fill("", "____________")}</div>`}
        ${c.req.account ? `<div>h/r: ${esc(c.req.account)}</div>` : `<div>h/r: ${fill("", "________________")}</div>`}
        ${c.req.mfo ? `<div>MFO: ${esc(c.req.mfo)}</div>` : `<div>MFO: ${fill("", "_____")}</div>`}
      </div>
      <div class="req-col">
        <div class="req-h">TO'LOVCHI</div>
        <div><b>${esc(c.lead.customerName)}</b></div>
        <div>Tel: ${esc(c.lead.customerPhone || "—")}</div>
        ${c.lead.customerEmail ? `<div>${esc(c.lead.customerEmail)}</div>` : ""}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr><th class="c">№</th><th>Xizmat nomi</th><th class="c">Soni</th><th class="r">Narxi</th><th class="r">Summa</th></tr>
      </thead>
      <tbody>
        <tr>
          <td class="c">1</td>
          <td>${esc(item)}</td>
          <td class="c">${qty}</td>
          <td class="r">${c.total != null ? money(unit, c.currency) : fill("", "______")}</td>
          <td class="r">${totalStr}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr><td colspan="4" class="r total-l">Jami to'lov:</td><td class="r total-v">${totalStr}</td></tr>
      </tfoot>
    </table>

    ${words ? `<p class="words">So'z bilan: <b>${esc(words.charAt(0).toUpperCase() + words.slice(1))}</b>.</p>` : ""}

    <p class="pay-note">${esc(fillTpl(t.note, ctx))}</p>

    ${signBlock("Rahbar", c.req.director || c.brand, "Bosh hisobchi", "")}`;
}

/* --------------------------------- assemble ------------------------------- */

function bodyFor(c: Ctx): string {
  if (c.type === "shartnoma") return contractBody(c);
  if (c.type === "vaucher") return voucherBody(c);
  return invoiceBody(c);
}

function styles(): string {
  return `
  *{box-sizing:border-box}
  :root{
    --ink:#161a18; --muted:#5c6b63; --line:#d7ded9;
    --green:#0F5132; --green-d:#0a3d25; --gold:#B8860B; --gold-2:#D4AF37;
    --paper:#ffffff; --wash:#eef1ef;
  }
  html,body{margin:0}
  body{
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    color:var(--ink); background:var(--wash); font-size:13.2px; line-height:1.58;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
  }
  .toolbar{
    position:sticky; top:0; z-index:10; display:flex; gap:10px; align-items:center;
    padding:11px 16px; background:var(--green-d); color:#fff;
    box-shadow:0 2px 12px rgba(0,0,0,.18);
  }
  .toolbar b{font-size:14px; font-weight:700; margin-right:auto; letter-spacing:.2px}
  .toolbar b span{color:var(--gold-2)}
  .btn{
    border:0; border-radius:9px; padding:9px 15px; font-size:13.5px; font-weight:650;
    cursor:pointer; font-family:inherit;
  }
  .btn-print{background:linear-gradient(135deg,var(--gold-2),var(--gold)); color:#2a2000}
  .btn-close{background:rgba(255,255,255,.14); color:#fff}
  .hint{max-width:210mm; margin:12px auto 0; padding:0 6mm; color:var(--muted); font-size:12.5px}
  .page{
    width:210mm; max-width:100%; min-height:296mm; margin:14px auto 40px; background:var(--paper);
    padding:16mm 16mm 18mm; box-shadow:0 8px 30px rgba(11,42,30,.14); position:relative;
  }
  .doc-head{display:flex; align-items:flex-start; justify-content:space-between; gap:16px}
  .brand-name{font-size:20px; font-weight:800; color:var(--green); letter-spacing:.2px}
  .brand-legal{font-size:12.5px; color:var(--ink); margin-top:1px}
  .brand-contacts{font-size:11.6px; color:var(--muted); margin-top:2px}
  .logo{width:58px; height:58px; object-fit:cover; border-radius:12px}
  .mono{
    width:58px; height:58px; border-radius:12px; display:grid; place-items:center;
    background:linear-gradient(135deg,var(--green),var(--green-d)); color:var(--gold-2);
    font-weight:800; font-size:20px; letter-spacing:.5px;
  }
  .rule{height:3px; margin:11px 0 0; border-radius:3px;
    background:linear-gradient(90deg,var(--green),var(--gold-2) 55%,transparent)}
  .doc-title{text-align:center; font-size:16.5px; font-weight:800; letter-spacing:.6px;
    text-transform:uppercase; margin:22px 0 6px; color:var(--green-d)}
  .doc-meta{display:flex; justify-content:center; gap:22px; flex-wrap:wrap;
    color:var(--muted); font-size:12.5px; margin-bottom:14px}
  h3{font-size:13.5px; font-weight:750; color:var(--green-d); margin:16px 0 4px}
  p{margin:5px 0}
  .lead-para{margin:10px 0 4px; text-align:justify}
  b{font-weight:700}
  .fill{
    display:inline-block; min-width:70px; padding:0 4px; border-bottom:1px dashed #9db3a7;
    color:#0b3b26; font-weight:600; outline:none;
  }
  .fill:empty::before{content:attr(data-ph); color:#a9b7ae; font-weight:400}
  .fill:focus{border-bottom-color:var(--gold); background:#fbf6e7}
  table{width:100%; border-collapse:collapse; margin:8px 0}
  .kv td{padding:7px 10px; border:1px solid var(--line); vertical-align:top}
  .kv td.k{width:34%; background:#f4f7f5; font-weight:650; color:var(--green-d)}
  .services{
    min-height:74px; border:1px solid var(--line); border-radius:10px; padding:10px 12px;
    background:#fbfdfc; white-space:pre-wrap; outline:none;
  }
  .services:empty::before{content:attr(data-ph); color:#a9b7ae}
  .voucher-note,.pay-note{margin-top:14px; color:#33413a; text-align:justify}
  .items th,.items td{border:1px solid var(--line); padding:8px 10px}
  .items thead th{background:var(--green); color:#fff; font-weight:650; font-size:12.5px}
  .items .c{text-align:center} .items .r{text-align:right}
  .items tfoot .total-l{font-weight:700; color:var(--green-d); background:#f4f7f5}
  .items tfoot .total-v{font-weight:800; color:var(--green-d); background:#f4f7f5}
  .words{margin-top:8px}
  .doc-body{margin-top:8px}
  .doc-body p{text-align:justify; margin:5px 0}
  .doc-body h3{margin-top:15px}
  .req-cols{display:flex; gap:22px; margin:16px 0 4px}
  .req-col{flex:1; font-size:12.5px; line-height:1.7}
  .req-h{font-weight:750; color:var(--green-d); letter-spacing:.4px; margin-bottom:3px;
    padding-bottom:3px; border-bottom:1px solid var(--line)}
  .signs{display:flex; gap:40px; margin-top:30px}
  .sign{flex:1}
  .sign-role{font-size:12.5px; color:var(--muted); margin-bottom:26px}
  .sign-line{border-bottom:1.4px solid #6d7d74}
  .sign-name{font-size:12.5px; margin-top:4px; font-weight:650}
  .sign-hint{font-size:11px; color:#9aa8a0; margin-top:1px}
  .foot{max-width:210mm; margin:0 auto; padding:0 6mm 30px; text-align:center;
    color:#9aa8a0; font-size:11px}
  @media print{
    @page{size:A4; margin:12mm}
    body{background:#fff}
    .toolbar,.hint{display:none !important}
    .page{width:auto; min-height:0; margin:0; padding:0; box-shadow:none}
    .fill{border-bottom:1px solid #333; color:#000}
    .fill:empty::before{color:transparent}
    .services:empty::before{color:transparent}
    .foot{padding-top:10mm}
  }`;
}

export function buildDocumentHtml(input: BuildInput): string {
  const { me, lead, agencyId, type } = input;
  const req = getRequisites(agencyId);
  const agency = me.agency;
  const app = me.application;
  const brand = (agency?.name || app?.companyName || "Agentlik").trim();
  const c: Ctx = {
    type,
    brand,
    legal: req.legalName || app?.legalName || brand,
    logo: agency?.imageUrl || app?.imageUrl || null,
    city: (agency?.city || app?.city || "Toshkent").trim(),
    agencyPhone: (req.phone || agency?.phone || app?.phone || "").trim(),
    agencyEmail: (app?.email || me.supportEmail || "").trim(),
    agencyWeb: agency?.website || app?.website || null,
    req,
    lead,
    number: `${type === "invoice" ? "HF" : type === "vaucher" ? "V" : "SH"}-${nextSeq(agencyId)}`,
    today: new Date(),
    travelers: Math.max(1, lead.travelers || 1),
    total: lead.totalEstimate ?? null,
    currency: lead.currency || "USD",
    tpl: getTemplates(agencyId),
  };

  const docName = DOC_LABEL[type];
  return `<!doctype html>
<html lang="uz"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(docName)} — ${esc(lead.customerName)}</title>
<style>${styles()}</style></head>
<body>
  <div class="toolbar">
    <b>Travelor<span>AI</span> · ${esc(docName)}</b>
    <button class="btn btn-print" onclick="window.print()">🖨 Chop etish / PDF saqlash</button>
    <button class="btn btn-close" onclick="window.close()">Yopish</button>
  </div>
  <div class="hint">Sariq chiziqli maydonlarni bosib to'ldiring (pasport, mehmonxona va h.k.), so'ng
    <b>Chop etish</b> tugmasini bosing. Printer ro'yxatidan <b>«PDF saqlash»</b>ni tanlasangiz — hujjat PDF bo'lib saqlanadi.</div>
  <div class="page">
    ${bodyFor(c)}
  </div>
  <div class="foot">Ushbu hujjat TravelorAI CRM orqali ${esc(shortDate(c.today.toISOString()))} sanasida yaratildi.</div>
</body></html>`;
}

/** Yangi oynada hujjatни ochadi (chop etish/PDF uchun tayyor). */
export function openDocument(input: BuildInput): boolean {
  if (typeof window === "undefined") return false;
  const html = buildDocumentHtml(input);
  // MUHIM: "noopener" BERILMAYDI — aks holda window.open() null qaytaradi va
  // hujjatni yoza olmaymiz. Oyna bir xil origin, o'zimiz HTML yozamiz.
  const w = window.open("", "_blank", "width=920,height=1040");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
