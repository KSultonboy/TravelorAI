/**
 * Tashqi havolani ochish — brauzer va desktop ilova uchun BIR xil ishlaydi.
 *
 * MUAMMO: Tauri (desktop) webview'da `target="_blank"` havolalar ochilmaydi —
 * yangi oyna bloklangan. Shu sababli CRM'dagi WhatsApp / Telegram / qo'ng'iroq
 * tugmalari desktop ilovada hech narsa qilmasdi (brauzerda esa ishlardi).
 *
 * YECHIM: desktop ilovada `open_external` buyrug'i chaqiriladi — havolani
 * TIZIM brauzeri yoki tegishli ilovada (WhatsApp, Telegram) ochadi.
 * Brauzerda esa oddiy yo'l (window.open) qoladi.
 *
 * Buyruq faqat https/http/tel/mailto sxemalarini qabul qiladi (Rust tomonida
 * ham tekshiriladi) — «istalgan narsani ishga tushirish» imkoniyati emas.
 */

type TauriWindow = Window & {
  __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };
};

/** Desktop ilova (Tauri) ichida ishlayapmizmi? */
export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as TauriWindow).__TAURI__?.core?.invoke === "function";
}

const ALLOWED = ["https://", "http://", "tel:", "mailto:"];

/**
 * Havolani ochadi. `true` — ochildi (yoki ochish topshirildi).
 * Chaqiruvchi <a> elementining standart harakatini to'xtatishi kerak
 * (desktop ilovada u ishlamaydi, brauzerda esa ikki marta ochilib ketadi).
 */
export function openExternal(url?: string | null): boolean {
  if (typeof window === "undefined") return false;
  const u = String(url || "").trim();
  if (!u || !ALLOWED.some((p) => u.toLowerCase().startsWith(p))) return false;

  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (typeof invoke === "function") {
    // Desktop: tizim brauzeri/ilovasiga topshiramiz
    void invoke("open_external", { url: u }).catch(() => {
      // Buyruq mavjud bo'lmasa (eski versiya) — oxirgi chora sifatida oddiy yo'l
      window.open(u, "_blank", "noopener");
    });
    return true;
  }
  // Brauzer: tel:/mailto: uchun yangi oyna ochilmaydi (bo'sh varaq qolib
  // ketadi) — tizim ilovasiga joyida topshiramiz. Qolgani yangi oynada.
  const lower = u.toLowerCase();
  if (lower.startsWith("tel:") || lower.startsWith("mailto:")) {
    window.location.href = u;
    return true;
  }
  const w = window.open(u, "_blank", "noopener");
  return !!w;
}

/**
 * Faylni saqlaydi — brauzer va desktop ilova uchun BIR xil ishlaydi.
 *
 * MUAMMO: Tauri (desktop) webview'da `<a download>` orqali yuklab olish
 * ishlamaydi — brauzerdagidek yuklanmalar paneli yo'q, fayl jimgina
 * yo'qoladi. Shu sababli «Yuklab olish» va CSV eksport tugmalari desktop
 * ilovada hech narsa qilmasdi.
 *
 * YECHIM: desktopda `save_download` buyrug'i faylni «Yuklanmalar» papkasiga
 * yozadi va darhol ochadi (Rust tomonida nom tozalanadi, faqat .html/.csv).
 * Brauzerda esa odatdagi blob + `<a download>` yo'li qoladi.
 *
 * Natija: saqlangan fayl yo'li (desktop) yoki bo'sh satr (brauzer).
 * Xatolik bo'lsa — `Error` tashlanadi, chaqiruvchi xabar ko'rsatishi mumkin.
 */
export async function saveFile(filename: string, content: string, mime = "text/plain;charset=utf-8"): Promise<string> {
  if (typeof window === "undefined") throw new Error("Brauzer muhiti emas");
  const invoke = (window as TauriWindow).__TAURI__?.core?.invoke;
  if (typeof invoke === "function") {
    const path = await invoke("save_download", { filename, content });
    return String(path || "");
  }
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "";
}

/**
 * <a> uchun onClick. Havolani `openExternal` bilan ochadi va standart
 * harakatni to'xtatadi. Havola `href`da ham qoladi — o'ng tugma bilan
 * «nusxalash» ishlashi va ekran o'quvchilar uchun.
 */
export function onExternalClick(url?: string | null) {
  return (e: React.MouseEvent) => {
    // Ctrl/Cmd/o'rta tugma — brauzerning o'z xatti-harakati qolsin
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    e.stopPropagation();
    openExternal(url);
  };
}
