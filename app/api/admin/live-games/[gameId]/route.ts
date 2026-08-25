import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTeacherLiveGame, LiveGameServerError } from "@/chess/persistence/liveGameServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const cookieStore = await cookies();
  return isAuthorizedAdminRequest(cookieStore.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"));
}

export async function GET(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    const { gameId } = await params;
    return NextResponse.json({ ok: true, game: await getTeacherLiveGame(gameId) });
  } catch (error) {
    const status = error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Live game could not be loaded." }, { status });
  }
}
