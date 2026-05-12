import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";

export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({
    success: true,
    data: {
      authenticated: Boolean(session),
      username: session?.username || null,
    },
  });
}
