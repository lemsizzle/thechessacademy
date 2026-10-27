import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { BotLockedError } from "@/chess/persistence/botProgressionServer";
import { saveCompletedGame } from "@/chess/persistence/saveCompletedGame";
import { scheduleGameAchievements } from "@/lib/badges/gameAchievements/server";
import { isHalloweenBot } from "@/lib/quests/halloween";
import { getStudentHalloweenReductions } from "@/chess/persistence/halloweenAdaptationServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    const saved = await saveCompletedGame(student.studentId, body);
    scheduleGameAchievements([student.studentId]);
    // A difficulty-read failure must never turn an already saved game into a
    // failed save or cause the client to upload it again.
    const halloweenReductions = isHalloweenBot(body?.opponentId) && body?.result === "loss"
      ? await getStudentHalloweenReductions(student.studentId).catch(() => null)
      : undefined;
    return NextResponse.json({ ok: true, gameId: saved.id, unlockedBotIds: saved.unlockedBotIds, halloweenReductions }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Completed game could not be saved.";
    const status = error instanceof StudentAuthenticationError
      ? 401
      : error instanceof BotLockedError
        ? 403
        : message.startsWith("Invalid") || message.startsWith("Illegal") || message.includes("does not match")
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
