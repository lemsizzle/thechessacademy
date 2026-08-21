import { NextResponse } from "next/server";
import { publishGuidedExercise, unpublishGuidedExercise } from "@/chess/persistence/guidedExerciseServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Puzzle conversion failed.";
  const status = /Teacher access|required|permission/i.test(message) ? 403 : /not found/i.test(message) ? 404 : /^Invalid/i.test(message) ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    return NextResponse.json({ puzzle: await publishGuidedExercise(actor, studyId, await request.json().catch(() => ({}))) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    await unpublishGuidedExercise(actor, studyId, await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
