import { mockArenaTournamentResults } from "@/data/tournamentResults";
import { fetchArenaTournamentResults } from "@/lib/lichess/fetchArenaTournamentResults";
import { normalizeArenaTournamentResult } from "@/lib/tournaments/normalizeArenaTournamentResult";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json() as { tournamentId?: string; lichessTournamentId?: string; status?: string; startsAt?: string };
  if (!body.tournamentId || !body.lichessTournamentId) {
    return NextResponse.json({ error: "Tournament ID is required." }, { status: 400 });
  }
  if (body.status !== "finished") {
    return NextResponse.json({ error: "Arena results can only be finalized after the tournament is finished." }, { status: 400 });
  }

  try {
    const rawResults = await fetchArenaTournamentResults(body.lichessTournamentId);
    const results = rawResults.flatMap((raw) => {
      const result = normalizeArenaTournamentResult(raw, body.tournamentId!, body.lichessTournamentId!);
      return result ? [{ ...result, tournamentStartsAt: body.startsAt }] : [];
    });
    return NextResponse.json({ results, mode: "connected" });
  } catch (error) {
    const results = mockArenaTournamentResults.map((result) => ({
      ...result,
      tournamentId: body.tournamentId!,
      lichessTournamentId: body.lichessTournamentId!,
      tournamentStartsAt: body.startsAt ?? result.tournamentStartsAt
    }));
    return NextResponse.json({
      results,
      mode: "mock",
      warning: error instanceof Error ? error.message : "Could not sync Arena results."
    });
  }
}
