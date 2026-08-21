import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { joinLiveGame, LiveGameServerError } from "@/chess/persistence/liveGameServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    return NextResponse.json({ ok: true, game: await joinLiveGame(student.studentId, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Challenge could not be joined.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
