import { NextResponse } from "next/server";
import { listStudyMembers, upsertStudyMember } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Study member request failed.";
  const status = message.includes("permission") ? 403 : message.startsWith("Invalid") || message.includes("already") ? 400 : message.includes("not found") ? 404 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    return NextResponse.json({ members: await listStudyMembers(actor, studyId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ studyId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { studyId } = await params;
    const member = await upsertStudyMember(actor, studyId, await request.json().catch(() => ({})));
    return NextResponse.json({ member });
  } catch (error) { return failure(error); }
}
