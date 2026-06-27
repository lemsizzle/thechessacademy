import { ADMIN_SESSION_COOKIE, createAdminSessionValue, getAdminPassword, getAdminSessionSecret } from "@/lib/auth/adminSession";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  if (body.password !== configuredPassword) {
    return NextResponse.json({ error: "Incorrect teacher password." }, { status: 401 });
  }

  const sessionSecret = getAdminSessionSecret();
  if (!sessionSecret) {
    return NextResponse.json({ error: "ADMIN_SESSION_SECRET or ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionValue(sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
