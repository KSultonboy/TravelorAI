import { NextRequest, NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin/session";
import { hasAllowedOrigin } from "@/lib/server/proxyUtils";

export async function POST(request: NextRequest) {
  // Begona saytdan "majburan chiqarish" (CSRF logout) bo'lmasin.
  if (!hasAllowedOrigin(request, [process.env.ADMIN_SITE_URL])) {
    return NextResponse.json({ success: false, message: "So'rov manbasi ruxsat etilmagan" }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  clearAdminSession(response);
  return response;
}
