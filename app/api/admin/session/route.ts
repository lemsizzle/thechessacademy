import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const authenticated = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  return NextResponse.json({ authenticated });
}
