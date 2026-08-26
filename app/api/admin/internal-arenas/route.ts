import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createInternalArena, InternalArenaServerError, listTeacherInternalArenas } from "@/chess/persistence/arenaServer";
import { ADMIN_SESSION_COOKIE, isAuthorizedAdminRequest } from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const store = await cookies();
  return isAuthorizedAdminRequest(store.get(ADMIN_SESSION_COOKIE)?.value, request.headers.get("x-admin-action-token"));
}

function failure(error: unknown) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Internal Arenas are temporarily unavailable." }, { status: error instanceof InternalArenaServerError ? error.status : 500 });
}

export async function GET(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, arenas: await listTeacherInternalArenas() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!await authorized(request)) return NextResponse.json({ ok: false, error: "Teacher log in required." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    return NextResponse.json({ ok: true, arena: await createInternalArena(body) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
