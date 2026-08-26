import { NextResponse } from "next/server";
import { InternalArenaServerError, joinInternalArena, pauseInternalArenaQueue } from "@/chess/persistence/arenaServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const status = error instanceof StudentAuthenticationError ? 401 : error instanceof InternalArenaServerError ? error.status : 500;
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Arena matchmaking is temporarily unavailable." }, { status });
}

export async function POST(_request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const [student, { tournamentId }] = await Promise.all([requireActiveStudent(), params]);
    return NextResponse.json({ ok: true, matchmaking: await joinInternalArena(tournamentId, student.studentId) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const [student, { tournamentId }] = await Promise.all([requireActiveStudent(), params]);
    return NextResponse.json({ ok: true, matchmaking: await pauseInternalArenaQueue(tournamentId, student.studentId) });
  } catch (error) {
    return failure(error);
  }
}
