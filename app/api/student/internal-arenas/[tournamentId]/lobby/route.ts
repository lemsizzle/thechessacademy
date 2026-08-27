import { NextResponse } from "next/server";
import { getStudentInternalArenaLobby, InternalArenaServerError, postStudentInternalArenaChat } from "@/chess/persistence/arenaServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const status = error instanceof StudentAuthenticationError ? 401 : error instanceof InternalArenaServerError ? error.status : 500;
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The Arena lobby is temporarily unavailable." }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const [student, { tournamentId }] = await Promise.all([requireActiveStudent(), params]);
    return NextResponse.json({ ok: true, lobby: await getStudentInternalArenaLobby(tournamentId, student.studentId) });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const studentPromise = requireActiveStudent();
    const paramsPromise = params;
    const bodyPromise = request.json().catch(() => null) as Promise<{ message?: unknown } | null>;
    const [student, { tournamentId }, body] = await Promise.all([studentPromise, paramsPromise, bodyPromise]);
    return NextResponse.json({ ok: true, message: await postStudentInternalArenaChat(tournamentId, student.studentId, body?.message) }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
