import { NextResponse } from "next/server";
import { requireActiveStudent, StudentAuthenticationError } from "@/lib/auth/requireActiveStudent";
import { LiveGameServerError, resolveLiveGameRematch } from "@/chess/persistence/liveGameServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const student = await requireActiveStudent();
    const { gameId } = await params;
    const input = await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true, rematch: await resolveLiveGameRematch(student.studentId, gameId, input) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The rematch decision could not be saved.";
    const status = error instanceof StudentAuthenticationError ? 401 : error instanceof LiveGameServerError ? error.status : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
