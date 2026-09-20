import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { LiveGameServerError, performLiveGameAction } from "@/chess/persistence/liveGameServer";
import { scheduleGameAchievements } from "@/lib/badges/gameAchievements/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const [{ gameId }, body] = await Promise.all([params, request.json().catch(() => null)]);
    const game = await performLiveGameAction(student.studentId, gameId, body);
    if (game.status === "completed") scheduleGameAchievements(Object.values(game.players).flatMap(player => player?.id && !player.botDifficultyId ? [player.id] : []));
    return NextResponse.json({ ok: true, game });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live game action failed.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
