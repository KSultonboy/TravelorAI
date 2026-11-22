import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { setAdminSession } from "@/lib/admin/session";
import { getAdminCredentials } from "@/lib/admin/config";
import { loginBlockedFor, recordLoginFailure, recordLoginSuccess } from "@/lib/admin/loginThrottle";
import { clientIp, ONE_MB, parseJsonSafe, readBodyLimited } from "@/lib/server/proxyUtils";

export const dynamic = "force-dynamic";

/** Uzunligi farq qilsa ham vaqt bo'yicha bir xil taqqoslash (avval SHA-256). */
function safeEqual(left: string, right: string) {
  const a = crypto.createHash("sha256").update(left).digest();
  const b = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(a, b) && left.length === right.length;
}

function tooMany(seconds: number) {
  return NextResponse.json(
    { success: false, message: "Juda ko‘p noto‘g‘ri urinish. Keyinroq qayta urinib ko‘ring." },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}

export async function POST(request: NextRequest) {
  const credentials = getAdminCredentials();
  if (!credentials) {
    return NextResponse.json(
      { success: false, message: "Admin login sozlanmagan" },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  const blocked = loginBlockedFor(ip);
  if (blocked > 0) return tooMany(blocked);

  const raw = await readBodyLimited(request, ONE_MB / 16);
  if (!raw.ok) {
    return NextResponse.json({ success: false, message: "So‘rov noto‘g‘ri" }, { status: 400 });
  }
  const body = (raw.body ? parseJsonSafe(new TextDecoder().decode(raw.body)) : null) || {};
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  const userOk = safeEqual(username, credentials.username);
  const passOk = safeEqual(password, credentials.password);
  if (!userOk || !passOk) {
    recordLoginFailure(ip);
    const nowBlocked = loginBlockedFor(ip);
    if (nowBlocked > 0) return tooMany(nowBlocked);
    return NextResponse.json(
      { success: false, message: "Login yoki parol xato" },
      { status: 401 }
    );
  }

  recordLoginSuccess(ip);
  const response = NextResponse.json({
    success: true,
    data: { username },
  });
  setAdminSession(response, username);
  return response;
}
