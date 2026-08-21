import { NextResponse } from "next/server";
import { createStudy, listStudies } from "@/chess/persistence/studyServer";
import { requireChessActor } from "@/lib/auth/requireChessActor";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Study request failed.";
  const status = message.includes("log in") ? 401 : message.startsWith("Invalid") || message.includes("not found") ? 400 : message.includes("permission") ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const actor = await requireChessActor();
    return NextResponse.json({ studies: await listStudies(actor) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireChessActor();
    const input = await request.json().catch(() => ({}));
    return NextResponse.json(await createStudy(actor, input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
