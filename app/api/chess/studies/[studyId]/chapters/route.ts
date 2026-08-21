import { NextResponse } from "next/server";
import { createChapter, reorderChapters } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function response(error: unknown) {
  const message = error instanceof Error ? error.message : "Chapter request failed.";
  return NextResponse.json({ error: message }, { status: message.includes("permission") ? 403 : message.startsWith("Invalid") ? 400 : 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    const chapter = await createChapter(actor, studyId, await request.json().catch(() => ({})));
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (error) { return response(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    const input = await request.json().catch(() => ({})) as { chapterIds?: string[] };
    await reorderChapters(actor, studyId, Array.isArray(input.chapterIds) ? input.chapterIds : []);
    return NextResponse.json({ ok: true });
  } catch (error) { return response(error); }
}
