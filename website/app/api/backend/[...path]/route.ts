import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function apiBase(request: NextRequest) {
  const configured = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  if (/^https?:\/\//i.test(configured)) return configured;
  if (request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1") {
    return "http://localhost:4000/api/v1";
  }
  return "https://travelorai.com/api/v1";
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join("/");
  const target = `${apiBase(request)}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");
  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (METHODS_WITH_BODY.has(request.method)) {
    const body = await request.arrayBuffer();
    if (body.byteLength) init.body = body;
  }

  try {
    const response = await fetch(target, init);
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ success: false, message: "Backend bilan aloqa qilib bo‘lmadi" }, { status: 502 });
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
