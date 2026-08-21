import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getLiveGame, LiveGameServerError } from "@/chess/persistence/liveGameServer";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const { gameId } = await params;
    return NextResponse.json({ ok: true, game: await getLiveGame(student.studentId, gameId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live game could not be loaded.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
