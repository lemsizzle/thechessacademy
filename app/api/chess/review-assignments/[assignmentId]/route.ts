import { NextResponse } from "next/server";
import { deleteReviewAssignment, updateReviewAssignment } from "@/chess/persistence/reviewAssignmentServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Review assignment request failed.";
  const status = message.includes("log in") ? 401
    : message.includes("permission") || message.includes("Teacher") ? 403
      : message.includes("not found") ? 404
        : message.includes("cannot be submitted") || message.includes("Only a submitted") ? 409
          : message.startsWith("Invalid") || message.includes("is required") || message.includes("No review changes") ? 400
            : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { assignmentId } = await params;
    const assignment = await updateReviewAssignment(actor, assignmentId, await request.json().catch(() => ({})));
    return NextResponse.json({ assignment });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { assignmentId } = await params;
    await deleteReviewAssignment(actor, assignmentId);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
