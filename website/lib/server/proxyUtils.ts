/**
 * Route handler'lar (proxy'lar, admin login) uchun umumiy yordamchilar.
 * Faqat serverda ishlatiladi.
 */

const IP_LIKE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * Mijozning haqiqiy IP manzili.
 *
 * Prod'da nginx `X-Real-IP $remote_addr` (har doim ustidan yozadi) va
 * `X-Forwarded-For $proxy_add_x_forwarded_for` (oxiriga qo'shadi) yuboradi.
 * Shuning uchun avval X-Real-IP, keyin X-Forwarded-For'ning ENG O'NG
 * (nginx qo'shgan) qiymati olinadi — chap tomondagilarni mijoz o'zi yozishi mumkin.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real && IP_LIKE.test(real)) return real;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && IP_LIKE.test(last)) return last;
  }
  return "unknown";
}

/** Backend'ga mijoz IP'sini uzatadi (rate-limit va audit uchun). */
export function forwardClientIp(headers: Headers, request: Request) {
  const ip = clientIp(request);
  if (ip === "unknown") return;
  headers.set("x-forwarded-for", ip);
  headers.set("x-real-ip", ip);
}

/**
 * Catch-all yo'l bo'laklarini tekshiradi. `.`/`..` (yoki `%2e%2e`), bo'sh
 * bo'lak, `/` yoki `\` bo'lsa — backend'dagi boshqa endpoint'ga chiqib
 * ketish (path traversal) xavfi bor, rad etamiz.
 */
export function safePathFromSegments(parts: string[]): string | null {
  const out: string[] = [];
  for (const raw of parts) {
    let decoded = String(raw);
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (!decoded || decoded === "." || decoded === ".." || /[\\/]/.test(decoded)) return null;
    out.push(encodeURIComponent(decoded));
  }
  return out.join("/");
}

function requestHost(request: Request & { nextUrl?: URL }) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const urlHost = request.nextUrl?.host || "";
  return (forwardedHost || hostHeader || urlHost || "").split(",")[0].trim().toLowerCase();
}

function requestOrigin(request: Request & { nextUrl?: URL }) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = forwardedProto || request.nextUrl?.protocol.replace(":", "") || "https";
  const host = requestHost(request);
  return host ? `${protocol}://${host}` : request.nextUrl?.origin || "";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF himoyasi: holat o'zgartiruvchi so'rov (POST/PUT/PATCH/DELETE) faqat
 * o'z saytimizdan kelgan bo'lishi kerak (Origin sarlavhasi bo'yicha).
 */
export function hasAllowedOrigin(
  request: Request & { nextUrl?: URL },
  extraOrigins: (string | undefined | null)[] = []
) {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set(
    [requestOrigin(request), request.nextUrl?.origin, process.env.NEXT_PUBLIC_SITE_URL, ...extraOrigins]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.replace(/\/$/, ""))
  );
  return allowed.has(origin);
}

export const ONE_MB = 1024 * 1024;

export type LimitedBody =
  | { ok: true; body: ArrayBuffer | null }
  | { ok: false; reason: "too_large" | "read_error" };

/** So'rov tanasini `limit` baytgacha o'qiydi; oshsa darhol to'xtatadi. */
export async function readBodyLimited(request: Request, limit: number): Promise<LimitedBody> {
  const declared = Number.parseInt(request.headers.get("content-length") || "", 10);
  if (Number.isFinite(declared) && declared > limit) return { ok: false, reason: "too_large" };
  if (!request.body) return { ok: true, body: null };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }

  if (total === 0) return { ok: true, body: null };
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body: merged.buffer };
}

/** JSON.parse — xato bo'lsa null qaytaradi (backend HTML/bo'sh javob qaytarsa ham yiqilmaydi). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend JSON shakli ixtiyoriy
export function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
