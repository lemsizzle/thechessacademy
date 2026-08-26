import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { forceInternalArenaPair, InternalArenaServerError } from "@/chess/persistence/arenaServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const store = await cookies();
  if (!await isAuthorizedAdminRequest(store.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"))) {
    return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  }
  try {
    const [{ tournamentId }, body] = await Promise.all([params, request.json().catch(() => null)]) as [{ tournamentId: string }, { firstStudentId?: string; secondStudentId?: string } | null];
    return NextResponse.json({
      ok: true,
      matchmaking: await forceInternalArenaPair(tournamentId, String(body?.firstStudentId ?? ""), String(body?.secondStudentId ?? ""))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Students could not be paired." }, { status: error instanceof InternalArenaServerError ? error.status : 500 });
  }
}
