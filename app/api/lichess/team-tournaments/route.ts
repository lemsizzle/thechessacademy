import { getCachedTeamTournaments, syncTeamTournaments } from "@/lib/lichess/syncTeamTournaments";
import { NextResponse } from "next/server";

export async function GET() {
  const result = getCachedTeamTournaments() ?? await syncTeamTournaments();
  return NextResponse.json({ ...result, createdBy: process.env.LICHESS_TOURNAMENT_CREATED_BY });
}
