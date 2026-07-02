import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import { formatCooldown } from "@/lib/lichess/rateLimit";
import { getCooldownSeconds, getLichessSyncState, recordLichessSyncAttempt, recordLichessSyncRateLimit, recordLichessSyncSuccess } from "@/lib/lichess/syncState";
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
    const state = await getLichessSyncState(student.studentId);
    const cooldownSeconds = getCooldownSeconds(state);
    if (cooldownSeconds > 0) {
      evaluations.push({
        studentId: student.studentId,
        progress: [],
        newAwards: [],
        autoApprovedAwards: [],
        autoCompletions: [],
        rateLimited: true,
        cooldownSeconds,
        message: `Lichess rate limit reached for ${student.username}. Try again in ${formatCooldown(cooldownSeconds)}.`
      });
      continue;
    }
    await recordLichessSyncAttempt(student.studentId, student.username);
    const result = await evaluateStudentQuestRequest({
        studentId: student.studentId,
        username: student.username,
        quests: body.quests,
        account: student.account,
        arenaResults: student.arenaResults,
        existingAwards: body.existingAwards,
        completionEvents: body.completionEvents,
        questAttempts: (body.questAttempts ?? []).filter((attempt) => attempt.studentId === student.studentId),
        timeZone: body.timeZone
      }, cookieStore, { skipPuzzleQuestsWithoutToken: true });
    if (result.rateLimited) {
      await recordLichessSyncRateLimit(student.studentId, student.username, "Lichess rate limit reached while syncing quest activity.", result.retryAfterSeconds || 60);
    } else {
      await recordLichessSyncSuccess(student.studentId, student.username, result.requestCount ?? 0);
    }
    evaluations.push({ studentId: student.studentId, ...result });
  }
  return NextResponse.json({ evaluations });
}
