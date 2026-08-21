import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { createLiveGame, listLiveGames, LiveGameServerError } from "@/chess/persistence/liveGameServer";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Live games could not be loaded.";
  const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, games: await listLiveGames(student.studentId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    return NextResponse.json({ ok: true, game: await createLiveGame(student.studentId, body) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
