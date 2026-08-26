import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { InternalArenaServerError, updateInternalArenaStatus } from "@/chess/persistence/arenaServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  const store = await cookies();
  if (!await isAuthorizedAdminRequest(store.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"))) {
    return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  }
  try {
    const [{ tournamentId }, body] = await Promise.all([params, request.json().catch(() => null)]) as [{ tournamentId: string }, { action?: string } | null];
    return NextResponse.json({ ok: true, arena: await updateInternalArenaStatus(tournamentId, body?.action) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Arena could not be updated." }, { status: error instanceof InternalArenaServerError ? error.status : 500 });
  }
}
