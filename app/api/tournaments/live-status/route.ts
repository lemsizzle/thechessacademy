import { NextResponse } from "next/server";
import { hasLiveInternalArena } from "@/chess/persistence/arenaServer";
import { syncTeamTournaments } from "@/lib/lichess/syncTeamTournaments";
import { isTournamentLive } from "@/lib/tournaments/isTournamentLive";

export const dynamic = "force-dynamic";

function liveStatusResponse(live: boolean) {
  return NextResponse.json(
    { live },
    // This response is one public boolean, never student-specific data.
    { headers: { "Cache-Control": "public, max-age=15", "Vercel-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
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
