import { rejectTournamentAward } from "@/lib/tournaments/rejectTournamentAward";
import type { PendingTournamentAward } from "@/lib/types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json() as { award?: PendingTournamentAward; rejectionReason?: string; teacherNote?: string };
  if (!body.award || body.award.status !== "pending") {
    return NextResponse.json({ error: "A pending tournament award is required." }, { status: 400 });
  }
  return NextResponse.json({ award: rejectTournamentAward(body.award, body.rejectionReason, body.teacherNote) });
}
