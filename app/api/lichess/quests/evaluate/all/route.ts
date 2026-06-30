import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import type { ArenaTournamentResult, PendingQuestAward, Quest, QuestCompletionEvent, StudentLichessAccount, StudentQuestAttempt } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type StudentEvaluation = {
  studentId: string;
  username: string;
  account?: StudentLichessAccount;
  arenaResults?: ArenaTournamentResult[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    students?: StudentEvaluation[];
    quests?: Quest[];
    existingAwards?: PendingQuestAward[];
    completionEvents?: QuestCompletionEvent[];
    questAttempts?: StudentQuestAttempt[];
    timeZone?: string;
  };
  if (!body.students || !body.quests) return NextResponse.json({ error: "Students and quest rules are required." }, { status: 400 });
  const cookieStore = await cookies();
  const evaluations = [];
  for (const student of body.students.slice(0, 50)) {
    evaluations.push({
      studentId: student.studentId,
      ...(await evaluateStudentQuestRequest({
        studentId: student.studentId,
        username: student.username,
        quests: body.quests,
        account: student.account,
        arenaResults: student.arenaResults,
        existingAwards: body.existingAwards,
        completionEvents: body.completionEvents,
        questAttempts: (body.questAttempts ?? []).filter((attempt) => attempt.studentId === student.studentId),
        timeZone: body.timeZone
      }, cookieStore, { skipPuzzleQuestsWithoutToken: true }))
    });
  }
  return NextResponse.json({ evaluations });
}
