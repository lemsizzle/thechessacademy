import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { InternalArenaServerError, manageInternalArenaBot } from "@/chess/persistence/arenaServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

async function manage(request: Request, context: { params: Promise<{ tournamentId: string }> }, action: "add" | "update" | "remove") {
  const store = await cookies();
  if (!await isAuthorizedAdminRequest(store.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"))) {
    return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  }
  try {
    const [{ tournamentId }, body] = await Promise.all([context.params, request.json().catch(() => null)]);
    if (!body || (action !== "add" && typeof body.botId !== "string")) throw new InternalArenaServerError("Choose an Arena bot.");
    const lobby = await manageInternalArenaBot(tournamentId, action, body, action === "add" ? undefined : body.botId);
    return NextResponse.json({ ok: true, lobby });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Bot could not be updated." }, { status: error instanceof InternalArenaServerError ? error.status : 500 });
  }
}

export function POST(request: Request, context: { params: Promise<{ tournamentId: string }> }) { return manage(request, context, "add"); }
export function PATCH(request: Request, context: { params: Promise<{ tournamentId: string }> }) { return manage(request, context, "update"); }
export function DELETE(request: Request, context: { params: Promise<{ tournamentId: string }> }) { return manage(request, context, "remove"); }
