import { syncTeamTournaments } from "@/lib/lichess/syncTeamTournaments";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  return Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncTeamTournaments({ force: true });

  return NextResponse.json({
    ok: true,
    syncedAt: result.syncedAt,
    teamId: result.teamId,
    mode: result.mode,
    tournamentCount: result.tournaments.length,
    warning: result.warning
  });
}
