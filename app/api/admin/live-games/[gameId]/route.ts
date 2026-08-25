import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTeacherLiveGame, LiveGameServerError } from "@/chess/persistence/liveGameServer";
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const cookieStore = await cookies();
  if (!await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    const { gameId } = await params;
    return NextResponse.json({ ok: true, game: await getTeacherLiveGame(gameId) });
  } catch (error) {
    const status = error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Live game could not be loaded." }, { status });
  }
}
