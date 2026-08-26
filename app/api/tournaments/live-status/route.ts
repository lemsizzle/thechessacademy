import { NextResponse } from "next/server";
import { hasLiveInternalArena } from "@/chess/persistence/arenaServer";
import { syncTeamTournaments } from "@/lib/lichess/syncTeamTournaments";
import { isTournamentLive } from "@/lib/tournaments/isTournamentLive";

export const dynamic = "force-dynamic";

function liveStatusResponse(live: boolean) {
  return NextResponse.json(
    { live },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

export async function GET() {
  const now = Date.now();

  try {
    if (await hasLiveInternalArena(new Date(now))) return liveStatusResponse(true);
  } catch {
    // Lichess can still provide a valid live status if Arena storage is unavailable.
  }

  const lichess = await syncTeamTournaments();
  const lichessLive = lichess.mode === "connected"
    && lichess.tournaments.some((tournament) => isTournamentLive(tournament, now));

  return liveStatusResponse(lichessLive);
}
