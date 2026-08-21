import { NextResponse } from "next/server";
import { createReviewAssignment, listReviewAssignments } from "@/chess/persistence/reviewAssignmentServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Review assignment request failed.";
  const status = message.includes("log in") ? 401 : message.includes("permission") || message.includes("Teacher") ? 403 : message.includes("not found") ? 404 : message.startsWith("Invalid") || message.includes("already been assigned") ? 400 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const actor = await requireChessActor();
    const studyId = new URL(request.url).searchParams.get("studyId") ?? undefined;
    return NextResponse.json({ assignments: await listReviewAssignments(actor, studyId) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireChessActor();
    const assignment = await createReviewAssignment(actor, await request.json().catch(() => ({})));
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
