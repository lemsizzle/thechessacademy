import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listTeacherLiveGames } from "@/chess/persistence/liveGameServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const cookieStore = await cookies();
  return isAuthorizedAdminRequest(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"));
}

export async function GET(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, games: await listTeacherLiveGames() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Live games could not be loaded." }, { status: 500 });
  }
}
