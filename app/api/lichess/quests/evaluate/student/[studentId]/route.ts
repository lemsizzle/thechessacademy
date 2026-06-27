import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import { readStudentSession } from "@/lib/auth/session";
import type { ArenaTournamentResult, PendingQuestAward, Quest, QuestCompletionEvent, StudentLichessAccount } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const body = await request.json().catch(() => ({})) as {
    username?: string;
    quests?: Quest[];
    arenaResults?: ArenaTournamentResult[];
    account?: StudentLichessAccount;
    existingAwards?: PendingQuestAward[];
    completionEvents?: QuestCompletionEvent[];
    timeZone?: string;
  };
  if (!body.username || !body.quests) return NextResponse.json({ error: "Student username and quest rules are required." }, { status: 400 });
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  const result = await evaluateStudentQuestRequest({
    studentId,
    username: body.username,
    quests: body.quests,
    arenaResults: body.arenaResults,
    account: body.account,
    existingAwards: body.existingAwards,
    completionEvents: body.completionEvents,
    timeZone: body.timeZone
  }, cookieStore, { allowPuzzleToken: session?.studentId === studentId });
  return NextResponse.json(result);
}
