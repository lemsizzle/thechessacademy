import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminActivityKind = "xp" | "coin" | "quest" | "badge" | "submission" | "game" | "puzzle" | "other";

export type AdminRosterActivityItem = {
  id: string;
  studentId: string | null;
  studentName: string;
  studentSlug: string | null;
  classGroup: string;
  kind: AdminActivityKind;
  title: string;
  detail: string;
  createdAt: string;
  amount?: number;
};

type StudentRow = { id: string; display_name: string; public_slug: string; class_group: string | null };
type QuestRow = { id: string; title: string };
type BadgeRow = { id: string; name: string };
type XpRow = { id: string; student_id: string; amount: number; reason: string; created_at: string };
type CoinRow = { id: string; student_id: string; amount: number; transaction_type: string; source_type: string; description: string; created_at: string };
type AttemptRow = { id: string; student_id: string; quest_id: string; started_at: string; expires_at: string; status: string };
type CompletionRow = { id: string; student_id: string; quest_id: string; completed_at: string; xp_awarded: number; badge_awarded_id: string | null; evidence: string };
type StudentBadgeRow = { id: string; student_id: string; badge_id: string; awarded_at: string; note: string | null };
type ActivityRow = { id: string; student_id: string | null; event_type: string; title: string; description: string | null; created_at: string };
type GameSubmissionRow = { id: string; student_id: string; game_type: string | null; status: string; submitted_at: string; reviewed_at: string | null };
type ScoreSubmissionRow = { id: string; student_id: string; challenge_name: string; tactic_theme: string; score: number; total_questions: number | null; status: string; submitted_at: string; reviewed_at: string | null; xp_awarded: number | null };

function rows<T>(result: { data: unknown[] | null; error: { message: string } | null }, source: string): T[] {
  if (result.error) {
    console.error(`Teacher activity feed could not read ${source}:`, result.error.message);
    return [];
  }
  return (result.data ?? []) as T[];
}

function classifyXp(reason: string): AdminActivityKind {
  const lower = reason.toLowerCase();
  if (lower.includes("quest")) return "quest";
  if (lower.includes("puzzle")) return "puzzle";
  if (lower.includes("rapid") || lower.includes("blitz") || lower.includes("game")) return "game";
  if (lower.includes("badge")) return "badge";
  return "xp";
}

function studentContext(studentMap: Map<string, StudentRow>, studentId: string | null) {
  const student = studentId ? studentMap.get(studentId) : undefined;
  return {
    studentId,
    studentName: student?.display_name ?? "Unknown student",
    studentSlug: student?.public_slug ?? null,
    classGroup: student?.class_group?.trim() || "Unassigned"
  };
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function reviewedTitle(status: string, type: string) {
  if (status === "approved") return `${type} approved`;
  if (status === "rejected") return `${type} declined`;
  return `${type} reviewed`;
}

export async function getAdminRosterActivity(limit = 300): Promise<AdminRosterActivityItem[]> {
  const supabase = getSupabaseAdminClient();
  const perSourceLimit = Math.max(100, Math.min(500, limit));

  const [
    studentsResult,
    questsResult,
    badgesResult,
    xpResult,
    coinsResult,
    attemptsResult,
    completionsResult,
    studentBadgesResult,
    activityResult,
    gameSubmissionsResult,
    scoreSubmissionsResult
  ] = await Promise.all([
    supabase.from("students").select("id,display_name,public_slug,class_group"),
    supabase.from("academy_quests").select("id,title"),
    supabase.from("badges").select("id,name"),
    supabase.from("xp_events").select("id,student_id,amount,reason,created_at").order("created_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("coin_transactions").select("id,student_id,amount,transaction_type,source_type,description,created_at").order("created_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("student_quest_attempts").select("id,student_id,quest_id,started_at,expires_at,status").order("started_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("quest_completion_events").select("id,student_id,quest_id,completed_at,xp_awarded,badge_awarded_id,evidence").order("completed_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("student_badges").select("id,student_id,badge_id,awarded_at,note").order("awarded_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("activity_events").select("id,student_id,event_type,title,description,created_at").order("created_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("student_game_submissions").select("id,student_id,game_type,status,submitted_at,reviewed_at").order("submitted_at", { ascending: false }).limit(perSourceLimit),
    supabase.from("student_score_submissions").select("id,student_id,challenge_name,tactic_theme,score,total_questions,status,submitted_at,reviewed_at,xp_awarded").order("submitted_at", { ascending: false }).limit(perSourceLimit)
  ]);

  const studentMap = new Map(rows<StudentRow>(studentsResult, "students").map((student) => [student.id, student]));
  const questMap = new Map(rows<QuestRow>(questsResult, "academy_quests").map((quest) => [quest.id, quest.title]));
  const badgeMap = new Map(rows<BadgeRow>(badgesResult, "badges").map((badge) => [badge.id, badge.name]));
  const items: AdminRosterActivityItem[] = [];

  for (const event of rows<XpRow>(xpResult, "xp_events")) {
    const kind = classifyXp(event.reason);
    const questCompletion = kind === "quest" && event.reason.toLowerCase().startsWith("quest completed:");
    items.push({
      id: `xp-${event.id}`,
      ...studentContext(studentMap, event.student_id),
      kind,
      title: questCompletion ? "Quest completed" : event.amount >= 0 ? "XP earned" : "XP adjusted",
      detail: `${signed(event.amount)} XP${event.amount > 0 ? ` and ${event.amount.toLocaleString()} coins` : ""} - ${event.reason}`,
      createdAt: event.created_at,
      amount: event.amount
    });
  }

  for (const transaction of rows<CoinRow>(coinsResult, "coin_transactions")) {
    if (transaction.amount > 0 && ["xp_event", "lichess_xp", "xp_backfill"].includes(transaction.source_type)) continue;
    const spent = transaction.amount < 0 || transaction.transaction_type === "spend";
    items.push({
      id: `coin-${transaction.id}`,
      ...studentContext(studentMap, transaction.student_id),
      kind: "coin",
      title: spent ? "Academy Coins spent" : transaction.transaction_type === "refund" ? "Academy Coins refunded" : "Academy Coins adjusted",
      detail: `${signed(transaction.amount)} coins - ${transaction.description}`,
      createdAt: transaction.created_at,
      amount: transaction.amount
    });
  }

  for (const attempt of rows<AttemptRow>(attemptsResult, "student_quest_attempts")) {
    const questTitle = questMap.get(attempt.quest_id) ?? attempt.quest_id;
    items.push({
      id: `quest-start-${attempt.id}`,
      ...studentContext(studentMap, attempt.student_id),
      kind: "quest",
      title: "Quest started",
      detail: `${questTitle} - countdown ends ${new Date(attempt.expires_at).toLocaleString()}.`,
      createdAt: attempt.started_at
    });
  }

  for (const completion of rows<CompletionRow>(completionsResult, "quest_completion_events")) {
    const questTitle = questMap.get(completion.quest_id) ?? completion.quest_id;
    items.push({
      id: `quest-complete-${completion.id}`,
      ...studentContext(studentMap, completion.student_id),
      kind: "quest",
      title: "Quest completed",
      detail: `${questTitle} - ${completion.xp_awarded.toLocaleString()} XP and coins awarded.${completion.badge_awarded_id ? ` Badge: ${badgeMap.get(completion.badge_awarded_id) ?? completion.badge_awarded_id}.` : ""}`,
      createdAt: completion.completed_at,
      amount: completion.xp_awarded
    });
  }

  for (const award of rows<StudentBadgeRow>(studentBadgesResult, "student_badges")) {
    items.push({
      id: `badge-${award.id}`,
      ...studentContext(studentMap, award.student_id),
      kind: "badge",
      title: "Badge acquired",
      detail: `${badgeMap.get(award.badge_id) ?? "Badge awarded"}${award.note ? ` - ${award.note}` : ""}`,
      createdAt: award.awarded_at
    });
  }

  for (const event of rows<ActivityRow>(activityResult, "activity_events")) {
    items.push({
      id: `activity-${event.id}`,
      ...studentContext(studentMap, event.student_id),
      kind: event.event_type.includes("quest") ? "quest" : event.event_type.includes("badge") ? "badge" : "other",
      title: event.title,
      detail: event.description ?? event.event_type,
      createdAt: event.created_at
    });
  }

  for (const submission of rows<GameSubmissionRow>(gameSubmissionsResult, "student_game_submissions")) {
    const context = studentContext(studentMap, submission.student_id);
    items.push({
      id: `game-submitted-${submission.id}`,
      ...context,
      kind: "submission",
      title: "Game submitted",
      detail: `${submission.game_type || "Chess game"} submitted for teacher review.`,
      createdAt: submission.submitted_at
    });
    if (submission.reviewed_at) items.push({
      id: `game-reviewed-${submission.id}`,
      ...context,
      kind: "submission",
      title: reviewedTitle(submission.status, "Game submission"),
      detail: `Review status: ${submission.status}.`,
      createdAt: submission.reviewed_at
    });
  }

  for (const submission of rows<ScoreSubmissionRow>(scoreSubmissionsResult, "student_score_submissions")) {
    const context = studentContext(studentMap, submission.student_id);
    const score = submission.total_questions ? `${submission.score}/${submission.total_questions}` : submission.score.toLocaleString();
    items.push({
      id: `score-submitted-${submission.id}`,
      ...context,
      kind: "submission",
      title: "Puzzle score submitted",
      detail: `${submission.challenge_name || submission.tactic_theme}: ${score}.`,
      createdAt: submission.submitted_at
    });
    if (submission.reviewed_at) items.push({
      id: `score-reviewed-${submission.id}`,
      ...context,
      kind: "submission",
      title: reviewedTitle(submission.status, "Puzzle score"),
      detail: `Review status: ${submission.status}${submission.xp_awarded ? ` - ${submission.xp_awarded} XP and coins awarded` : ""}.`,
      createdAt: submission.reviewed_at
    });
  }

  return items
    .filter((item) => !Number.isNaN(new Date(item.createdAt).getTime()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
