import { NextResponse } from "next/server";
import { getStudentInternalArenaChat, InternalArenaServerError } from "@/chess/persistence/arenaServer";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
  try {
    const [student, { tournamentId }] = await Promise.all([requireActiveStudent(), params]);
    return NextResponse.json(await getStudentInternalArenaChat(tournamentId, student.studentId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof InternalArenaServerError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Tournament chat could not be loaded." : (error as Error).message }, { status });
  }
}
