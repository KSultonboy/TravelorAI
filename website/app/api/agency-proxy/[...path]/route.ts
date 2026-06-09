import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_PROXY_TIMEOUT_MS = 15000;
const AGENCY_TOKEN_COOKIE = "travelorai_agency_token";
const AGENCY_SESSION_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_RESPONSE_PATHS = new Set([
  "agency/auth/login",
  "agency/auth/google",
  "agency/auth/verify-email",
  "agency/auth/email-change/confirm",
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

function validRequestOrigin(request: NextRequest) {
  if (!METHODS_WITH_BODY.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === request.nextUrl.origin
    || origin === process.env.NEXT_PUBLIC_SITE_URL
    || origin === process.env.AGENCY_SITE_URL;
}

async function proxyAgencyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const rawPathParts = params.path || [];
  const path = rawPathParts.map(encodeURIComponent).join("/");
  if (path === "agency/auth/logout" && request.method === "POST") {
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    clearAgencyCookie(response);
    return response;
  }
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ success: false, message: "So'rov manbasi ruxsat etilmagan" }, { status: 403 });
  }

  const target = `${getAgencyApiBase(request)}/${path}${request.nextUrl.search}`;
  const isHealthCheck = rawPathParts.length === 1 && String(rawPathParts[0]).toLowerCase() === "health";
  const headers = new Headers();

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
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
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
    const payload = JSON.parse(text);
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
  if (backendResponse.status === 401 && cookieToken) clearAgencyCookie(response);
  return response;
}

export const GET = proxyAgencyRequest;
export const POST = proxyAgencyRequest;
export const PUT = proxyAgencyRequest;
export const PATCH = proxyAgencyRequest;
export const DELETE = proxyAgencyRequest;
