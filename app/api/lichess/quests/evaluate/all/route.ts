import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import { formatCooldown } from "@/lib/lichess/rateLimit";
import { getCooldownSeconds, getLichessSyncState, recordLichessSyncAttempt, recordLichessSyncRateLimit, recordLichessSyncSuccess } from "@/lib/lichess/syncState";
import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { syncAcademyCoinsForLichessXp } from "@/lib/avatar/supabaseAvatar";
import { getLichessXpBreakdown } from "@/lib/lichessXp";
import { getStoredLichessAccount, saveStoredLichessAccount } from "@/lib/lichess/supabaseAccounts";
import { listAdminQuests } from "@/lib/quests/supabaseQuests";
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
  const cookieStore = await cookies();
  const actionToken = request.headers.get("x-admin-action-token");
  const authorized = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(actionToken);
  if (!authorized) {
    return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as {
    students?: StudentEvaluation[];
    quests?: Quest[];
    existingAwards?: PendingQuestAward[];
    completionEvents?: QuestCompletionEvent[];
    questAttempts?: StudentQuestAttempt[];
    timeZone?: string;
  };
  if (!body.students) return NextResponse.json({ error: "Students are required." }, { status: 400 });
  let quests = body.quests ?? [];
  try {
    const storedQuests = await listAdminQuests();
    if (storedQuests.length) quests = storedQuests;
  } catch {
    // A local installation without Supabase can still evaluate its local rules.
  }
  if (!quests.length) return NextResponse.json({ error: "No quest rules are available." }, { status: 400 });
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
    const storedAccount = await getStoredLichessAccount(student.studentId);
    const candidateAccount = storedAccount ?? student.account;
    const trustedAccount = candidateAccount && state?.createdAt && !storedAccount
      ? { ...candidateAccount, activityBaselineSetAt: state.createdAt, linkedAt: state.createdAt }
      : candidateAccount;
    const result = await evaluateStudentQuestRequest({
        studentId: student.studentId,
        username: student.username,
        quests,
        account: trustedAccount,
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
    let lichessCoinsAwarded = 0;
    let coinError: string | undefined;
    if (result.account) {
      try {
        const savedAccount = await saveStoredLichessAccount(result.account);
        result.account = savedAccount;
        const coinSync = await syncAcademyCoinsForLichessXp(student.studentId, getLichessXpBreakdown(savedAccount).total);
        lichessCoinsAwarded = coinSync.coinsAwarded;
      } catch (error) {
        coinError = error instanceof Error ? error.message : "Academy Coins could not be updated.";
      }
    }
    evaluations.push({ studentId: student.studentId, ...result, lichessCoinsAwarded, coinError });
  }
  return NextResponse.json({ evaluations });
}
