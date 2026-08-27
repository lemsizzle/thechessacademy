import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTeacherInternalArenaLobby, InternalArenaServerError, postTeacherInternalArenaChat } from "@/chess/persistence/arenaServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const store = await cookies();
  return isAuthorizedAdminRequest(store.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"));
}

function failure(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The Arena lobby is temporarily unavailable." }, { status: error instanceof InternalArenaServerError ? error.status : 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    const { tournamentId } = await params;
    return NextResponse.json({ ok: true, lobby: await getTeacherInternalArenaLobby(tournamentId) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    const paramsPromise = params;
    const bodyPromise = request.json().catch(() => null) as Promise<{ message?: unknown } | null>;
    const [{ tournamentId }, body] = await Promise.all([paramsPromise, bodyPromise]);
    return NextResponse.json({ ok: true, message: await postTeacherInternalArenaChat(tournamentId, body?.message) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
