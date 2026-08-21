import { NextResponse } from "next/server";
import { listGuidedExerciseProgress, recordGuidedExerciseAttempt } from "@/chess/persistence/guidedExerciseServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Guided exercise request failed.";
  const status = /access required|permission/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /^Invalid|not legal/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    return NextResponse.json(await listGuidedExerciseProgress(actor, studyId));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    return NextResponse.json({ attempt: await recordGuidedExerciseAttempt(actor, studyId, await request.json().catch(() => ({}))) });
  } catch (error) { return failure(error); }
}
