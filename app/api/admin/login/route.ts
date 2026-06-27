import { ADMIN_SESSION_COOKIE, createAdminSessionValue, getAdminPassword } from "@/lib/auth/adminSession";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  const configuredPassword = getAdminPassword();

  if (!configuredPassword) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  if (body.password !== configuredPassword) {
    return NextResponse.json({ error: "Incorrect teacher password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionValue(configuredPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
