import { NextResponse } from "next/server";
import { deleteStudy, getStudy, updateStudy } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function response(error: unknown) {
  const message = error instanceof Error ? error.message : "Study request failed.";
  return NextResponse.json({ error: message }, { status: message.includes("permission") ? 403 : message.includes("not found") ? 404 : message.startsWith("Invalid") ? 400 : 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    return NextResponse.json(await getStudy(actor, studyId));
  } catch (error) { return response(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    await updateStudy(actor, studyId, await request.json().catch(() => ({})));
    return NextResponse.json({ ok: true });
  } catch (error) { return response(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    await deleteStudy(actor, studyId);
    return NextResponse.json({ ok: true });
  } catch (error) { return response(error); }
}
