import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { setAdminSession } from "@/lib/admin/session";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return NextResponse.json(
      { success: false, message: "Admin login sozlanmagan" },
      { status: 503 }
    );
  }

  if (!safeEqual(username, expectedUsername) || !safeEqual(password, expectedPassword)) {
    return NextResponse.json(
      { success: false, message: "Login yoki parol xato" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    data: { username },
  });
  setAdminSession(response, username);
  return response;
}
