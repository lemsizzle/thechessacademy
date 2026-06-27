import { syncTeamTournaments } from "@/lib/lichess/syncTeamTournaments";
import { NextResponse } from "next/server";

export async function POST() {
  const result = await syncTeamTournaments({ force: true });
  return NextResponse.json({ ...result, createdBy: process.env.LICHESS_TOURNAMENT_CREATED_BY });
}
