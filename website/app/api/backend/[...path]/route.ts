import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_PROXY_TIMEOUT_MS = 15000;
const USER_TOKEN_COOKIE = "travelorai_user_token";
const USER_SESSION_SECONDS = 60 * 60 * 24 * 7;
const TOKEN_RESPONSE_PATHS = new Set([
  "auth/login",
  "auth/verify-email",
  "auth/google",
  "auth/email-change/verify",
]);

function apiBase(request: NextRequest) {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (/^https?:\/\//i.test(configured)) return configured;
  if (request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1") {
    return "http://localhost:4000/api/v1";
  }
  return "https://travelorai.com/api/v1";
}

function secureCookie() {
  return process.env.NODE_ENV === "production"
    || /^https:\/\//i.test(process.env.NEXT_PUBLIC_SITE_URL || "");
}

function clearUserCookie(response: NextResponse) {
  response.cookies.set(USER_TOKEN_COOKIE, "", {
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
    || origin === process.env.NEXT_PUBLIC_SITE_URL;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join("/");
  if (path === "auth/logout" && request.method === "POST") {
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    clearUserCookie(response);
    return response;
  }
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ success: false, message: "So'rov manbasi ruxsat etilmagan" }, { status: 403 });
  }

  const target = `${apiBase(request)}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  const cookieToken = request.cookies.get(USER_TOKEN_COOKIE)?.value;
  const authorization = request.headers.get("authorization") || (cookieToken ? `Bearer ${cookieToken}` : null);
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (METHODS_WITH_BODY.has(request.method)) {
    const body = await request.arrayBuffer();
    if (body.byteLength) init.body = body;
  }

  const timeoutCandidate = Number.parseInt(process.env.BACKEND_PROXY_TIMEOUT_MS || "", 10);
  const timeoutMs = Number.isFinite(timeoutCandidate) && timeoutCandidate > 0
    ? timeoutCandidate
    : DEFAULT_PROXY_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, { ...init, signal: controller.signal });
    const text = await response.text();
    const responseContentType = response.headers.get("content-type") || "application/json";

    if (TOKEN_RESPONSE_PATHS.has(path) && response.ok && responseContentType.includes("application/json")) {
      const payload = JSON.parse(text);
      const token = payload?.data?.token;
      if (token) {
        delete payload.data.token;
        const nextResponse = NextResponse.json(payload, { status: response.status });
        nextResponse.cookies.set(USER_TOKEN_COOKIE, token, {
          httpOnly: true,
          secure: secureCookie(),
          sameSite: "lax",
          path: "/",
          maxAge: USER_SESSION_SECONDS,
        });
        return nextResponse;
      }
    }

    const nextResponse = new NextResponse(text, {
      status: response.status,
      headers: { "content-type": responseContentType },
    });
    if (response.status === 401 && cookieToken) clearUserCookie(nextResponse);
    return nextResponse;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        message: isTimeout
          ? `Backend ${timeoutMs}ms ichida javob bermadi`
          : "Backend bilan aloqa qilib bo'lmadi",
      },
      { status: isTimeout ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
