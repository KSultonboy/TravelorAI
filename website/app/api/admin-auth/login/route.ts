import { NextRequest, NextResponse } from "next/server";
import { setAdminSession } from "@/lib/admin/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (username !== expectedUsername || password !== expectedPassword) {
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
