import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getAgencyApiBase() {
  return (
    process.env.AGENCY_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://travelorai.com/api/v1"
  ).replace(/\/$/, "");
}

async function proxyAgencyRequest(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params.path || []).map(encodeURIComponent).join("/");
  const target = `${getAgencyApiBase()}/${path}${request.nextUrl.search}`;
  const headers = new Headers();

  const authorization = request.headers.get("authorization");
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

  const backendResponse = await fetch(target, init);
  const text = await backendResponse.text();
  return new NextResponse(text, {
    status: backendResponse.status,
    headers: {
      "content-type": backendResponse.headers.get("content-type") || "application/json",
    },
  });
}

export const GET = proxyAgencyRequest;
export const POST = proxyAgencyRequest;
export const PUT = proxyAgencyRequest;
export const PATCH = proxyAgencyRequest;
export const DELETE = proxyAgencyRequest;
