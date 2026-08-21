import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { LiveGameServerError, submitLiveMove } from "@/chess/persistence/liveGameServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const [{ gameId }, body] = await Promise.all([params, request.json().catch(() => null)]);
    return NextResponse.json({ ok: true, game: await submitLiveMove(student.studentId, gameId, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move could not be played.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
