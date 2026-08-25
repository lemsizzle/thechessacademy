import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listTeacherLiveGames } from "@/chess/persistence/liveGameServer";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  if (!await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, games: await listTeacherLiveGames() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Live games could not be loaded." }, { status: 500 });
  }
}
