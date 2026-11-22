import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { isProduction, isSessionSecretValid } from "./config";

const COOKIE_NAME = "travelorai_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  username: string;
  exp: number;
};

export type AdminSession = {
  username: string;
};

// Dev muhitida ADMIN_SESSION_SECRET bo'lmasa — har ishga tushishda yangi
// tasodifiy kalit (qattiq yozilgan standart kalit YO'Q). Prod'da faqat env,
// ADMIN_SECRET_KEY'ga (backend kaliti) qaytish ham yo'q.
const DEV_FALLBACK_SECRET = crypto.randomBytes(32).toString("hex");

function getSessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (isProduction()) return isSessionSecretValid(secret) ? secret : null;
  return secret || DEV_FALLBACK_SECRET;
}

function shouldUseSecureCookie() {
  if (process.env.ADMIN_COOKIE_SECURE !== undefined) {
    return process.env.ADMIN_COOKIE_SECURE === "true";
  }

  return /^https:\/\//i.test(process.env.NEXT_PUBLIC_SITE_URL || "");
}

function base64url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  return base64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

export function createAdminSessionToken(username: string) {
  const payload: AdminSessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  if (!signature) throw new Error("ADMIN_SESSION_SECRET sozlanmagan yoki zaif");
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token?: string | null): AdminSession | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  if (!expected) return null;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as AdminSessionPayload;
    if (!payload.username || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(COOKIE_NAME)?.value);
}

export function setAdminSession(response: NextResponse, username: string) {
  response.cookies.set(COOKIE_NAME, createAdminSessionToken(username), {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
