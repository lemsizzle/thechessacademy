import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(ADMIN_SESSION_COOKIE);
  const verificationPassed = await isValidAdminSession(adminCookie?.value);

  return NextResponse.json({
    adminCookieExists: Boolean(adminCookie?.value),
    cookieNameExpected: ADMIN_SESSION_COOKIE,
    cookieNameFound: adminCookie?.name ?? null,
    verificationPassed,
    nodeEnv: process.env.NODE_ENV,
    adminPasswordExists: Boolean(process.env.ADMIN_PASSWORD?.trim()),
    adminSessionSecretExists: Boolean(process.env.ADMIN_SESSION_SECRET?.trim())
  });
}
