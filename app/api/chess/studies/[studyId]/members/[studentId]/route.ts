import { NextResponse } from "next/server";
import { removeStudyMember } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ studyId: string; studentId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId, studentId } = await params;
    await removeStudyMember(actor, studyId, studentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Study member could not be removed.";
    return NextResponse.json({ error: message }, { status: message.includes("permission") ? 403 : message.includes("cannot") ? 400 : 500 });
  }
}
