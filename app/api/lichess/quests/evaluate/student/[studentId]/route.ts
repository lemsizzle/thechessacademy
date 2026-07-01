import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import { readStudentSession } from "@/lib/auth/session";
import { mergeQuestAttempts, mergeQuestCompletions } from "@/lib/quests/mergeQuestTracking";
import { getSupabaseQuestTracking, saveSupabaseQuestTracking } from "@/lib/quests/supabaseQuestProgress";
import { addSupabaseStudentXp } from "@/lib/students/supabaseStudentProfiles";
import { getSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { ArenaTournamentResult, PendingQuestAward, Quest, QuestCompletionEvent, StudentLichessAccount, StudentQuestAttempt, XpEvent } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type EvaluationWithXp = Awaited<ReturnType<typeof evaluateStudentQuestRequest>> & {
  xpEvents?: XpEvent[];
  xpPersisted?: boolean;
  xpError?: string;
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
  if (!body.username || !body.quests) return NextResponse.json({ error: "Student username and quest rules are required." }, { status: 400 });
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session || session.studentId !== studentId) {
    return NextResponse.json({ error: "Student log in required." }, { status: 401 });
  }
  const persistedTracking = await getSupabaseQuestTracking(studentId);
  const completionEvents = mergeQuestCompletions(persistedTracking.completions, body.completionEvents);
  const questAttempts = mergeQuestAttempts(persistedTracking.attempts, body.questAttempts);
  const result = await evaluateStudentQuestRequest({
    studentId,
    username: body.username,
    quests: body.quests,
    arenaResults: body.arenaResults,
    account: body.account,
    existingAwards: body.existingAwards,
    completionEvents,
    questAttempts,
    timeZone: body.timeZone
  }, cookieStore, { allowPuzzleToken: session?.studentId === studentId });

  const response: EvaluationWithXp = { ...result, xpEvents: [], xpPersisted: false };
  const completedAttemptKeys = new Set((result.autoCompletions ?? []).map((completion) => `${completion.studentId}:${completion.questId}:${completion.sourcePeriodEnd}`));
  const completedAttempts = questAttempts.map((attempt) => completedAttemptKeys.has(`${attempt.studentId}:${attempt.questId}:${attempt.expiresAt}`)
    ? { ...attempt, status: "completed" as const }
    : attempt);

  try {
    await saveSupabaseQuestTracking({
      progress: result.progress,
      completions: result.autoCompletions,
      attempts: completedAttempts.filter((attempt) => attempt.studentId === studentId)
    });

    for (const award of result.autoApprovedAwards ?? []) {
      const event = await persistQuestXpOnce(studentId, award.title, award.sourcePeriodStart, award.xpAmount, session.lichessUsername);
      if (event) response.xpEvents?.push(event);
    }

    for (const completion of persistedTracking.completions) {
      const quest = body.quests.find((item) => item.id === completion.questId);
      if (!quest) continue;
      const event = await persistQuestXpOnce(studentId, quest.title, completion.sourcePeriodStart, completion.xpAwarded, session.lichessUsername);
      if (event) response.xpEvents?.push(event);
    }
    response.xpPersisted = Boolean(response.xpEvents?.length);
  } catch (error) {
    response.xpError = error instanceof Error ? error.message : "Quest XP could not be saved.";
  }

  return NextResponse.json(response);
}
