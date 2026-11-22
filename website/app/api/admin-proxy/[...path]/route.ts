import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import {
  forwardClientIp,
  hasAllowedOrigin,
  ONE_MB,
  readBodyLimited,
  safePathFromSegments,
} from "@/lib/server/proxyUtils";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_LOCAL_API_BASE = "http://localhost:4000/api/v1";
const DEFAULT_PROXY_TIMEOUT_MS = 15000;
// Admin paneldan base64 rasm (hero, joylar, turlar) yuboriladi — backend
// express.json limiti ham 16 MB.
const MAX_BODY_BYTES = 16 * ONE_MB;

function normalizeApiBase(value: string) {
  return value.replace(/\/$/, "");
}

function resolveApiBase(value: string) {
  if (/^https?:\/\//i.test(value)) return normalizeApiBase(value);
  if (value.startsWith("/")) {
    if (process.env.NODE_ENV !== "production") return `http://localhost:4000${value}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travelorai.com";
    return `${normalizeApiBase(siteUrl)}${value}`;
  }
  return "https://travelorai.com/api/v1";
}

function getAdminApiBase() {
  const configured = process.env.ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || "";
  if (configured) return resolveApiBase(configured);
  if (process.env.NODE_ENV !== "production") return DEFAULT_LOCAL_API_BASE;
  return "https://travelorai.com/api/v1";
}

/** Backend admin kaliti — FAQAT env'dan. Standart ("change_me") qiymat yo'q. */
function getAdminSecret() {
  return (process.env.ADMIN_SECRET_KEY || "").trim();
}

async function proxyAdminRequest(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Admin login kerak" }, { status: 401 });
  }

  if (!hasAllowedOrigin(request, [process.env.ADMIN_SITE_URL])) {
    return NextResponse.json({ success: false, message: "So'rov manbasi ruxsat etilmagan" }, { status: 403 });
  }

  const adminKey = getAdminSecret();
  if (!adminKey) {
    return NextResponse.json(
      { success: false, message: "ADMIN_SECRET_KEY sozlanmagan" },
      { status: 503 }
    );
  }

  const params = await context.params;
  const path = safePathFromSegments(params.path || []);
  if (path === null) {
    return NextResponse.json({ success: false, message: "Noto‘g‘ri manzil" }, { status: 400 });
  }
  const target = `${getAdminApiBase()}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  headers.set("x-admin-key", adminKey);
  forwardClientIp(headers, request);

  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (METHODS_WITH_BODY.has(request.method)) {
    const body = await readBodyLimited(request, MAX_BODY_BYTES);
    if (!body.ok) {
      return body.reason === "too_large"
        ? NextResponse.json({ success: false, message: "So‘rov hajmi juda katta (16 MB gacha)" }, { status: 413 })
        : NextResponse.json({ success: false, message: "So‘rov tanasini o‘qib bo‘lmadi" }, { status: 400 });
    }
    if (body.body) init.body = body.body;
  }

  const timeoutCandidate = Number.parseInt(process.env.ADMIN_PROXY_TIMEOUT_MS || "", 10);
  const timeoutMs = Number.isFinite(timeoutCandidate) && timeoutCandidate > 0
    ? timeoutCandidate
    : DEFAULT_PROXY_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let backendResponse: Response;
  try {
    backendResponse = await fetch(target, { ...init, signal: controller.signal });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        message: isTimeout
          ? `Admin backend ${timeoutMs}ms ichida javob bermadi`
          : "Admin backend bilan aloqa qilib bo'lmadi",
      },
      { status: isTimeout ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  const text = await backendResponse.text();
  return new NextResponse(text, {
    status: backendResponse.status,
    headers: {
      "content-type": backendResponse.headers.get("content-type") || "application/json",
    },
  });
}

export const GET = proxyAdminRequest;
export const POST = proxyAdminRequest;
export const PUT = proxyAdminRequest;
export const PATCH = proxyAdminRequest;
export const DELETE = proxyAdminRequest;
