import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";
import { importArenaTournament } from "@/lib/tournaments/importArenaTournament";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!await isAuthorizedAdminRequest(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"))) {
    return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  }

  let body: { input?: string };
  try {
    body = await request.json() as { input?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "A valid JSON request is required." }, { status: 400 });
  }
  const result = await importArenaTournament(body.input ?? "");
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
