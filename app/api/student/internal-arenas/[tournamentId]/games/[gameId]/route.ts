import { NextResponse } from "next/server";
import { getStudentArenaGame, LiveGameServerError } from "@/chess/persistence/liveGameServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ tournamentId: string; gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const { tournamentId, gameId } = await params;
    return NextResponse.json({ ok: true, game: await getStudentArenaGame(student.studentId, tournamentId, gameId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arena game could not be loaded.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
