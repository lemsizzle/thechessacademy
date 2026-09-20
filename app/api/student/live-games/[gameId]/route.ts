import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { getLiveGame, LiveGameServerError } from "@/chess/persistence/liveGameServer";
import { scheduleGameAchievements } from "@/lib/badges/gameAchievements/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const { gameId } = await params;
    const game = await getLiveGame(student.studentId, gameId);
    if (game.status === "completed") scheduleGameAchievements(Object.values(game.players).flatMap(player => player?.id && !player.botDifficultyId ? [player.id] : []));
    return NextResponse.json({ ok: true, game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live game could not be loaded.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
