import { NextRequest, NextResponse } from "next/server";

function shouldSkip(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (shouldSkip(pathname)) return NextResponse.next();

  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const nextUrl = request.nextUrl.clone();

  if (host === "agency.travelorai.com" && !pathname.startsWith("/agency")) {
    nextUrl.pathname = `/agency${pathname === "/" ? "" : pathname}`;
    nextUrl.search = search;
    return NextResponse.rewrite(nextUrl);
  }

  if (host === "admin.travelorai.com" && !pathname.startsWith("/admin")) {
    nextUrl.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    nextUrl.search = search;
    return NextResponse.rewrite(nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
