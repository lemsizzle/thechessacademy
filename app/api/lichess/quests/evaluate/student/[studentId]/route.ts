import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import { readStudentSession } from "@/lib/auth/session";
import { mergeQuestAttempts, mergeQuestCompletions } from "@/lib/quests/mergeQuestTracking";
import { mergeQuestProgress } from "@/lib/quests/mergeQuestProgress";
import { formatCooldown } from "@/lib/lichess/rateLimit";
import { getCooldownSeconds, getLichessSyncState, recordLichessSyncAttempt, recordLichessSyncRateLimit, recordLichessSyncSuccess } from "@/lib/lichess/syncState";
import { getSupabaseQuestTracking, saveSupabaseQuestTracking } from "@/lib/quests/supabaseQuestProgress";
import { addSupabaseStudentXp } from "@/lib/students/supabaseStudentProfiles";
import { getSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import { syncAcademyCoinsForLichessXp } from "@/lib/avatar/supabaseAvatar";
import { getLichessXpBreakdown } from "@/lib/lichessXp";
import { getStoredLichessAccount, saveStoredLichessAccount } from "@/lib/lichess/supabaseAccounts";
import { listAdminQuests } from "@/lib/quests/supabaseQuests";
import type { ArenaTournamentResult, PendingQuestAward, Quest, QuestCompletionEvent, StudentLichessAccount, StudentQuestAttempt, XpEvent } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type EvaluationWithXp = Awaited<ReturnType<typeof evaluateStudentQuestRequest>> & {
  xpEvents?: XpEvent[];
  xpPersisted?: boolean;
  xpError?: string;
  progressPersisted?: boolean;
  progressError?: string;
  lichessCoinsAwarded?: number;
  coinError?: string;
  message?: string;
};

function questXpReason(title: string, periodStart: string) {
  return `Quest completed: ${title} (${periodStart.slice(0, 10)})`;
}

async function hasQuestXpEvent(studentId: string, title: string, periodStart: string) {
  if (!isSupabaseServiceConfigured()) return false;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;
  const reasons = [questXpReason(title, periodStart), `Quest completed: ${title}`, title];
  const { data, error } = await supabase
    .from("xp_events")
    .select("id")
    .eq("student_id", studentId)
    .in("reason", reasons)
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

async function persistQuestXpOnce(studentId: string, title: string, periodStart: string, amount: number, lichessUsername: string) {
  if (amount <= 0) return undefined;
  if (await hasQuestXpEvent(studentId, title, periodStart)) return undefined;
  const saved = await addSupabaseStudentXp(studentId, {
    amount,
    reason: questXpReason(title, periodStart),
    lichessUsername
  });
  return saved.event;
}

export async function POST(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const body = await request.json().catch(() => ({})) as {
    username?: string;
    quests?: Quest[];
    arenaResults?: ArenaTournamentResult[];
    account?: StudentLichessAccount;
    existingAwards?: PendingQuestAward[];
    completionEvents?: QuestCompletionEvent[];
    questAttempts?: StudentQuestAttempt[];
    timeZone?: string;
  };
  if (!body.username) return NextResponse.json({ error: "Student username is required." }, { status: 400 });
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session || session.studentId !== studentId) {
    return NextResponse.json({ error: "Student log in required." }, { status: 401 });
  }
  let quests = body.quests ?? [];
  try {
    const storedQuests = await listAdminQuests();
    if (storedQuests.length) quests = storedQuests;
  } catch {
    // A local installation without Supabase can still evaluate its local rules.
  }
  if (!quests.length) return NextResponse.json({ error: "No quest rules are available." }, { status: 400 });
  const existingState = await getLichessSyncState(studentId);
  const cooldownSeconds = getCooldownSeconds(existingState);
  if (cooldownSeconds > 0) {
    const persistedTracking = await getSupabaseQuestTracking(studentId);
    return NextResponse.json({
      progress: persistedTracking.progress,
      autoApprovedAwards: [],
      autoCompletions: [],
      newAwards: [],
      snapshots: [],
      rateLimited: true,
      cooldownSeconds,
      message: `Lichess rate limit reached. Try again in ${formatCooldown(cooldownSeconds)}.`
    });
  }
  await recordLichessSyncAttempt(studentId, body.username);
  const persistedTracking = await getSupabaseQuestTracking(studentId);
  const completionEvents = mergeQuestCompletions(persistedTracking.completions, body.completionEvents);
  const questAttempts = mergeQuestAttempts(persistedTracking.attempts, body.questAttempts);
  const storedAccount = await getStoredLichessAccount(studentId);
  const result = await evaluateStudentQuestRequest({
    studentId,
    username: body.username,
    quests,
    arenaResults: body.arenaResults,
    account: storedAccount ?? body.account,
    existingAwards: body.existingAwards,
    completionEvents,
    questAttempts,
    timeZone: body.timeZone
  }, cookieStore, { allowPuzzleToken: session?.studentId === studentId });
  if (result.rateLimited) {
    await recordLichessSyncRateLimit(
      studentId,
      body.username,
      "Lichess rate limit reached while syncing quest activity.",
      result.retryAfterSeconds || 60
    );
  } else {
    await recordLichessSyncSuccess(studentId, body.username, result.requestCount ?? 0);
  }
  const progressToSave = mergeQuestProgress(persistedTracking.progress, result.progress, quests);

  const response: EvaluationWithXp = {
    ...result,
    progress: progressToSave,
    xpEvents: [],
    xpPersisted: false,
    ...(result.rateLimited ? { message: `Lichess rate limit reached. Try again in ${formatCooldown(result.retryAfterSeconds || 60)}.` } : {})
  };
  const completedAttemptKeys = new Set((result.autoCompletions ?? []).map((completion) => `${completion.studentId}:${completion.questId}:${completion.sourcePeriodEnd}`));
  const completedAttempts = questAttempts.map((attempt) => completedAttemptKeys.has(`${attempt.studentId}:${attempt.questId}:${attempt.expiresAt}`)
    ? { ...attempt, status: "completed" as const }
    : attempt);

  try {
    await saveSupabaseQuestTracking({
      progress: progressToSave,
      completions: result.autoCompletions,
      attempts: completedAttempts.filter((attempt) => attempt.studentId === studentId)
    });
    response.progressPersisted = true;
  } catch (error) {
    response.progressPersisted = false;
    response.progressError = error instanceof Error ? error.message : "Quest progress could not be saved.";
  }

  try {
    for (const award of result.autoApprovedAwards ?? []) {
      const event = await persistQuestXpOnce(studentId, award.title, award.sourcePeriodStart, award.xpAmount, session.lichessUsername);
      if (event) response.xpEvents?.push(event);
    }

    for (const completion of persistedTracking.completions) {
      const quest = quests.find((item) => item.id === completion.questId);
      if (!quest) continue;
      const event = await persistQuestXpOnce(studentId, quest.title, completion.sourcePeriodStart, completion.xpAwarded, session.lichessUsername);
      if (event) response.xpEvents?.push(event);
    }
    response.xpPersisted = Boolean(response.xpEvents?.length);
  } catch (error) {
    response.xpError = error instanceof Error ? error.message : "Quest XP could not be saved.";
  }

  if (result.account) {
    try {
      const savedAccount = await saveStoredLichessAccount(result.account);
      response.account = savedAccount;
      const coinSync = await syncAcademyCoinsForLichessXp(studentId, getLichessXpBreakdown(savedAccount).total);
      response.lichessCoinsAwarded = coinSync.coinsAwarded;
    } catch (error) {
      response.coinError = error instanceof Error ? error.message : "Lichess XP coins could not be saved.";
    }
  }

  return NextResponse.json(response);
}
