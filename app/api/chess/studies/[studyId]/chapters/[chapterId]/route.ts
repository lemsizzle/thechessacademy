import { NextResponse } from "next/server";
import { deleteChapter, updateChapter } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function response(error: unknown) {
  const message = error instanceof Error ? error.message : "Chapter request failed.";
  const status = message.includes("permission") ? 403 : message.includes("changed elsewhere") ? 409 : message.startsWith("Invalid") ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ studyId: string; chapterId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId, chapterId } = await params;
    const chapter = await updateChapter(actor, studyId, chapterId, await request.json().catch(() => ({})));
    return NextResponse.json({ chapter });
  } catch (error) { return response(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ studyId: string; chapterId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId, chapterId } = await params;
    await deleteChapter(actor, studyId, chapterId);
    return NextResponse.json({ ok: true });
  } catch (error) { return response(error); }
}
