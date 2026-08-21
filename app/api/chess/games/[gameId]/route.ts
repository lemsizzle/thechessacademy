import { NextResponse } from "next/server";
import { requireChessActor } from "@/lib/auth/requireChessActor";
import { getCompletedGame } from "@/chess/persistence/studyServer";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  try {
    const actor = await requireChessActor();
    const { gameId } = await params;
    return NextResponse.json({ game: await getCompletedGame(actor, gameId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Game could not be loaded.";
    const status = message.includes("log in") ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
