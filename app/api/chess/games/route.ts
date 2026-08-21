import { NextResponse } from "next/server";
import { requireChessActor } from "@/lib/auth/requireChessActor";
import { listCompletedGames } from "@/chess/persistence/studyServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireChessActor();
    const limit = Number(new URL(request.url).searchParams.get("limit") ?? 30);
    return NextResponse.json({ games: await listCompletedGames(actor, limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Games could not be loaded.";
    return NextResponse.json({ error: message }, { status: message.includes("log in") ? 401 : 500 });
  }
}
