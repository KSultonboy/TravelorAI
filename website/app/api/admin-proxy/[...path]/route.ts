import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_LOCAL_API_BASE = "http://localhost:4000/api/v1";
const DEFAULT_ADMIN_SECRET = "change_me";
const DEFAULT_PROXY_TIMEOUT_MS = 15000;

function resolveRequestHost(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const urlHost = request.nextUrl.host || request.nextUrl.hostname;
  return (forwardedHost || hostHeader || urlHost || "").split(",")[0].trim().toLowerCase();
}

function hostWithoutPort(host: string) {
  return host.split(":")[0].trim();
}

function isPrivateIpv4Host(host: string) {
  return /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
}

function isLocalLikeHost(host: string) {
  if (!host) return false;
  const bare = hostWithoutPort(host);
  return (
    bare === "localhost"
    || bare === "127.0.0.1"
    || bare === "::1"
    || bare.endsWith(".local")
    || isPrivateIpv4Host(bare)
  );
}

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

function getAdminApiBase(request: NextRequest) {
  const configured = process.env.ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || "";
  if (configured) return resolveApiBase(configured);

  const host = resolveRequestHost(request);
  if (process.env.NODE_ENV !== "production" || isLocalLikeHost(host)) return DEFAULT_LOCAL_API_BASE;

  return "https://travelorai.com/api/v1";
}

function getAdminSecret(request: NextRequest) {
  if (process.env.ADMIN_SECRET_KEY) return process.env.ADMIN_SECRET_KEY;

  const host = resolveRequestHost(request);
  if (process.env.NODE_ENV !== "production" || isLocalLikeHost(host)) return DEFAULT_ADMIN_SECRET;

  return "";
}

async function proxyAdminRequest(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Admin login kerak" }, { status: 401 });
  }

  const adminKey = getAdminSecret(request);
  if (!adminKey) {
    return NextResponse.json(
      { success: false, message: "ADMIN_SECRET_KEY sozlanmagan" },
      { status: 500 }
    );
  }

  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join("/");
  const target = `${getAdminApiBase(request)}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  headers.set("x-admin-key", adminKey);

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
