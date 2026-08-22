import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { LiveGameServerError, requestLiveGameRematch } from "@/chess/persistence/liveGameServer";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const { gameId } = await params;
    return NextResponse.json({ ok: true, rematch: await requestLiveGameRematch(student.studentId, gameId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rematch could not be requested.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
