import { isSupabaseServiceConfigured, getSupabaseServiceClient } from "@/lib/supabase/server";
import { questProgressIdentity } from "@/lib/quests/questProgressIdentity";
import type { LichessQuestProgress, QuestCompletionEvent, StudentQuestAttempt } from "@/lib/types";

type AttemptRow = {
  id: string;
  student_id: string;
  quest_id: string;
  started_at: string;
  expires_at: string;
  status: StudentQuestAttempt["status"];
  created_at: string;
};

type ProgressRow = {
  student_id: string;
  quest_id: string;
  source_period_start: string;
  source_period_end: string;
  current_value: number | null;
  required_value: number | null;
  accuracy: number | null;
  completed: boolean | null;
  evidence: string | null;
  mode: LichessQuestProgress["mode"] | null;
  updated_at: string;
};

type CompletionRow = {
  id: string;
  student_id: string;
  quest_id: string;
  award_id: string;
  completed_at: string;
  source: QuestCompletionEvent["source"];
  source_period_start: string;
  source_period_end: string;
  xp_awarded: number | null;
  badge_awarded_id: string | null;
  evidence: string | null;
};

export type QuestTrackingState = {
  attempts: StudentQuestAttempt[];
  progress: LichessQuestProgress[];
  completions: QuestCompletionEvent[];
};

function uniqueBy<T>(items: T[] = [], getKey: (item: T) => string) {
  return Array.from(new Map(items.map((item) => [getKey(item), item])).values());
}

function mapAttempt(row: AttemptRow): StudentQuestAttempt {
  return {
    id: row.id,
    studentId: row.student_id,
    questId: row.quest_id,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapProgress(row: ProgressRow): LichessQuestProgress {
  return {
    studentId: row.student_id,
    questId: row.quest_id,
    sourcePeriodStart: row.source_period_start,
    sourcePeriodEnd: row.source_period_end,
    currentValue: row.current_value ?? 0,
    requiredValue: row.required_value ?? 1,
    accuracy: row.accuracy ?? undefined,
    completed: row.completed ?? false,
    evidence: row.evidence ?? "",
    mode: row.mode ?? "connected",
    updatedAt: row.updated_at
  };
}

function mapCompletion(row: CompletionRow): QuestCompletionEvent {
  return {
    id: row.id,
    studentId: row.student_id,
    questId: row.quest_id,
    awardId: row.award_id,
    completedAt: row.completed_at,
    source: row.source,
    sourcePeriodStart: row.source_period_start,
    sourcePeriodEnd: row.source_period_end,
    xpAwarded: row.xp_awarded ?? 0,
    badgeAwardedId: row.badge_awarded_id ?? undefined,
    evidence: row.evidence ?? ""
  };
}

export async function getSupabaseQuestTracking(studentId?: string): Promise<QuestTrackingState & { configured: boolean; error?: string }> {
  if (!isSupabaseServiceConfigured()) return { configured: false, attempts: [], progress: [], completions: [] };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, attempts: [], progress: [], completions: [] };

  let attemptsQuery = supabase.from("student_quest_attempts").select("id,student_id,quest_id,started_at,expires_at,status,created_at");
  let progressQuery = supabase.from("lichess_quest_progress").select("student_id,quest_id,source_period_start,source_period_end,current_value,required_value,accuracy,completed,evidence,mode,updated_at");
  let completionsQuery = supabase.from("quest_completion_events").select("id,student_id,quest_id,award_id,completed_at,source,source_period_start,source_period_end,xp_awarded,badge_awarded_id,evidence");

  if (studentId) {
    attemptsQuery = attemptsQuery.eq("student_id", studentId);
    progressQuery = progressQuery.eq("student_id", studentId);
    completionsQuery = completionsQuery.eq("student_id", studentId);
  }

  const [attempts, progress, completions] = await Promise.all([
    attemptsQuery.order("started_at", { ascending: false }),
    progressQuery.order("updated_at", { ascending: false }),
    completionsQuery.order("completed_at", { ascending: false })
  ]);

  const error = attempts.error?.message ?? progress.error?.message ?? completions.error?.message;
  if (error) return { configured: true, attempts: [], progress: [], completions: [], error };

  return {
    configured: true,
    attempts: ((attempts.data ?? []) as AttemptRow[]).map(mapAttempt),
    progress: ((progress.data ?? []) as ProgressRow[]).map(mapProgress),
    completions: ((completions.data ?? []) as CompletionRow[]).map(mapCompletion)
  };
}

export async function saveSupabaseQuestTracking(input: Partial<QuestTrackingState>) {
  if (!isSupabaseServiceConfigured()) return { configured: false, saved: false };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, saved: false };

  const attempts = uniqueBy(input.attempts, (attempt) => attempt.id);
  if (attempts.length) {
    const { error } = await supabase.from("student_quest_attempts").upsert(attempts.map((attempt) => ({
      id: attempt.id,
      student_id: attempt.studentId,
      quest_id: attempt.questId,
      started_at: attempt.startedAt,
      expires_at: attempt.expiresAt,
      status: attempt.status,
      created_at: attempt.createdAt
    })), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  // PostgreSQL compares timestamptz values by instant, not by their source
  // formatting. Canonicalize here so Z and +00:00 representations cannot put
  // the same conflict key into one upsert batch and abort the entire sync.
  const progress = uniqueBy(input.progress, questProgressIdentity);
  if (progress.length) {
    const { error } = await supabase.from("lichess_quest_progress").upsert(progress.map((item) => ({
      student_id: item.studentId,
      quest_id: item.questId,
      source_period_start: item.sourcePeriodStart,
      source_period_end: item.sourcePeriodEnd,
      current_value: item.currentValue,
      required_value: item.requiredValue,
      accuracy: item.accuracy ?? null,
      completed: item.completed,
      evidence: item.evidence,
      mode: item.mode,
      updated_at: item.updatedAt
    })), { onConflict: "student_id,quest_id,source_period_start,source_period_end" });
    if (error) throw new Error(error.message);
  }

  const completions = uniqueBy(input.completions, (item) => item.id);
  if (completions.length) {
    const { error } = await supabase.from("quest_completion_events").upsert(completions.map((item) => ({
      id: item.id,
      student_id: item.studentId,
      quest_id: item.questId,
      award_id: item.awardId,
      completed_at: item.completedAt,
      source: item.source,
      source_period_start: item.sourcePeriodStart,
      source_period_end: item.sourcePeriodEnd,
      xp_awarded: item.xpAwarded,
      badge_awarded_id: item.badgeAwardedId ?? null,
      evidence: item.evidence
    })), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  return { configured: true, saved: true };
}
