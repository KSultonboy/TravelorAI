import { NextRequest, NextResponse } from "next/server";
import {
  forwardClientIp,
  hasAllowedOrigin,
  ONE_MB,
  parseJsonSafe,
  readBodyLimited,
  safePathFromSegments,
} from "@/lib/server/proxyUtils";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_PROXY_TIMEOUT_MS = 15000;
// Agentlik kabineti base64 fayl yuboradi: lid hujjatlari (≤6 MB → ~8 MB base64),
// tur rasmlari (≤8 MB → ~10.7 MB base64), CSV import (≤8 MB). Backend
// express.json limiti 16 MB — proxy ham shundan oshirmaydi.
const MAX_BODY_BYTES = 16 * ONE_MB;
const AGENCY_TOKEN_COOKIE = "travelorai_agency_token";
const AGENCY_SESSION_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_RESPONSE_PATHS = new Set([
  "agency/auth/login",
  "agency/auth/google",
  "agency/auth/verify-email",
  "agency/auth/email-change/confirm",
  // Parol almashtirilganda backend tokenVersion'ni oshiradi va yangi token
  // qaytaradi — cookie yangilanmasa agentlik darhol tizimdan chiqib qoladi.
  "agency/auth/change-password",
]);

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

function getAgencyApiBase(request: NextRequest) {
  const configured = process.env.AGENCY_API_URL || process.env.NEXT_PUBLIC_API_URL || "";
  if (configured) return resolveApiBase(configured);

  const host = request.nextUrl.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:4000/api/v1";

  return "https://travelorai.com/api/v1";
}

function secureCookie() {
  return process.env.NODE_ENV === "production"
    || /^https:\/\//i.test(process.env.NEXT_PUBLIC_SITE_URL || "");
}

function clearAgencyCookie(response: NextResponse) {
  response.cookies.set(AGENCY_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function proxyAgencyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const rawPathParts = params.path || [];
  const path = safePathFromSegments(rawPathParts);
  if (path === null) {
    return NextResponse.json({ success: false, message: "Noto‘g‘ri manzil" }, { status: 400 });
  }

  // Origin tekshiruvi logout'dan OLDIN — begona sayt foydalanuvchini
  // majburan chiqarib yubora olmasin (CSRF logout).
  if (!hasAllowedOrigin(request, [process.env.AGENCY_SITE_URL])) {
    return NextResponse.json({ success: false, message: "So'rov manbasi ruxsat etilmagan" }, { status: 403 });
  }

  // Backend'da agentlik logout endpoint'i yo'q (JWT stateless) — httpOnly
  // cookie'ni shu yerda o'chiramiz.
  if (path === "agency/auth/logout" && request.method === "POST") {
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    clearAgencyCookie(response);
    return response;
  }

  const target = `${getAgencyApiBase(request)}/${path}${request.nextUrl.search}`;
  const isHealthCheck = rawPathParts.length === 1 && String(rawPathParts[0]).toLowerCase() === "health";
  const headers = new Headers();
  forwardClientIp(headers, request);

  const cookieToken = request.cookies.get(AGENCY_TOKEN_COOKIE)?.value;
  const authorization = request.headers.get("authorization") || (cookieToken ? `Bearer ${cookieToken}` : null);
  if (authorization) headers.set("authorization", authorization);

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
        ? NextResponse.json({ success: false, message: "Fayl yoki so‘rov hajmi juda katta (16 MB gacha)" }, { status: 413 })
        : NextResponse.json({ success: false, message: "So‘rov tanasini o‘qib bo‘lmadi" }, { status: 400 });
    }
    if (body.body) init.body = body.body;
  }

  const timeoutCandidate = Number.parseInt(process.env.AGENCY_PROXY_TIMEOUT_MS || "", 10);
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
    if (isHealthCheck) {
      return NextResponse.json({
        status: "degraded",
        db: "disconnected",
        cache: "disconnected",
        timestamp: new Date().toISOString(),
      });
    }
    return NextResponse.json(
      {
        success: false,
        message: isTimeout
          ? `Agency backend ${timeoutMs}ms ichida javob bermadi`
          : "Agency backend bilan aloqa qilib bo'lmadi",
      },
      { status: isTimeout ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  const text = await backendResponse.text();
  const responseContentType = backendResponse.headers.get("content-type") || "application/json";
  if (TOKEN_RESPONSE_PATHS.has(path) && backendResponse.ok && responseContentType.includes("application/json")) {
    const payload = parseJsonSafe(text);
    const token = payload?.data?.token;
    if (token) {
      delete payload.data.token;
      const response = NextResponse.json(payload, { status: backendResponse.status });
      response.cookies.set(AGENCY_TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: secureCookie(),
        sameSite: "lax",
        path: "/",
        maxAge: AGENCY_SESSION_SECONDS,
      });
      return response;
    }
  }

  const response = new NextResponse(text, {
    status: backendResponse.status,
    headers: {
      "content-type": responseContentType,
    },
  });
  // 401 — odatda token yaroqsiz. Lekin joriy parol xato (change-password) yoki
  // requiresPassword/requiresReauth holatida sessiyani o'chirmaymiz.
  if (backendResponse.status === 401 && cookieToken && path !== "agency/auth/change-password") {
    const payload = parseJsonSafe(text);
    if (!payload?.requiresPassword && !payload?.requiresReauth) clearAgencyCookie(response);
  }
  return response;
}

export const GET = proxyAgencyRequest;
export const POST = proxyAgencyRequest;
export const PUT = proxyAgencyRequest;
export const PATCH = proxyAgencyRequest;
export const DELETE = proxyAgencyRequest;
