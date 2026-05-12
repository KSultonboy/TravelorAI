import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getAdminApiBase() {
  return (
    process.env.ADMIN_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://travelorai.com/api/v1"
  ).replace(/\/$/, "");
}

async function proxyAdminRequest(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Admin login kerak" }, { status: 401 });
  }

  const adminKey = process.env.ADMIN_SECRET_KEY;
  if (!adminKey) {
    return NextResponse.json(
      { success: false, message: "ADMIN_SECRET_KEY sozlanmagan" },
      { status: 500 }
    );
  }

  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join("/");
  const target = `${getAdminApiBase()}/${path}${request.nextUrl.search}`;
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

  const backendResponse = await fetch(target, init);
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
