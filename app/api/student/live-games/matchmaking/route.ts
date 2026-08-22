import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { cancelLiveMatchmaking, enterLiveMatchmaking, getLiveMatchmakingStatus } from "@/chess/persistence/matchmakingServer";
import { ChessRatingServerError } from "@/chess/persistence/ratingServer";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Matchmaking is temporarily unavailable.";
  const status = error instanceof StudentAuthenticationError ? 401 : error instanceof ChessRatingServerError ? error.status : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, matchmaking: await getLiveMatchmakingStatus(student.studentId) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const student = await requireActiveStudent();
    const body = await request.json().catch(() => null);
    return NextResponse.json({ ok: true, matchmaking: await enterLiveMatchmaking(student.studentId, body) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE() {
  try {
    const student = await requireActiveStudent();
    return NextResponse.json({ ok: true, matchmaking: await cancelLiveMatchmaking(student.studentId) });
  } catch (error) {
    return failure(error);
  }
}
