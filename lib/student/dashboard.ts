import "server-only";

import { getStudentAvatarState, listStudentCoinTransactions } from "@/lib/avatar/supabaseAvatar";
import { listAdminBadges } from "@/lib/badges/supabaseBadges";
import { getStoredLichessAccount } from "@/lib/lichess/supabaseAccounts";
import { getStudentPuzzleTrainingOverview } from "@/lib/puzzle-training/overviewServer";
import { getSupabaseQuestTracking, type QuestTrackingState } from "@/lib/quests/supabaseQuestProgress";
import { listAdminQuests } from "@/lib/quests/supabaseQuests";
import {
  buildStudentDashboardLichess,
  buildStudentDashboardProgress,
  emptyStudentDashboardQuestSummary,
  emptyStudentDashboardTraining,
  loadOptionalDashboardSection,
  summarizeStudentDashboardQuests,
  type StudentDashboardData,
  type StudentDashboardSection
} from "@/lib/student/dashboardProjection";
import { buildStudentActivityItems } from "@/lib/studentActivity";
import { findSupabaseStudentById } from "@/lib/students/supabaseStudentProfiles";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { XpEvent } from "@/lib/types";

export type {
  StudentDashboardData,
  StudentDashboardLichess,
  StudentDashboardProgress,
  StudentDashboardQuestProgress,
  StudentDashboardQuestSummary,
  StudentDashboardRating,
  StudentDashboardSection
} from "@/lib/student/dashboardProjection";

const RECENT_ACTIVITY_SOURCE_LIMIT = 10;

type XpEventRow = {
  id: string;
  student_id: string;
  amount: number | null;
  reason: string | null;
  created_at: string;
};

type StudentBadgeAwardRow = {
  badge_id: string;
  awarded_at: string;
};

const emptyQuestTracking: QuestTrackingState = {
  attempts: [],
  progress: [],
  completions: []
};

function requireSupabaseServiceAccess() {
  if (!getSupabaseServiceClient()) {
    throw new Error("Supabase service access is not configured.");
  }
}

async function listRecentStudentXpEvents(studentId: string): Promise<XpEvent[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service access is not configured.");

  const { data, error } = await supabase
    .from("xp_events")
    .select("id,student_id,amount,reason,created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(RECENT_ACTIVITY_SOURCE_LIMIT);

  if (error) throw new Error(error.message);
  return ((data ?? []) as XpEventRow[]).map((row) => ({
    id: row.id,
    studentId: row.student_id,
    amount: Number(row.amount ?? 0),
    reason: row.reason ?? "Academy XP update",
    createdAt: row.created_at
  }));
}

async function listStudentBadgeAwards(studentId: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service access is not configured.");

  const { data, error } = await supabase
    .from("student_badges")
    .select("badge_id,awarded_at")
    .eq("student_id", studentId)
    .order("awarded_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as StudentBadgeAwardRow[];
}

function recordUnavailable(
  unavailable: Set<StudentDashboardSection>,
  section: StudentDashboardSection,
  available: boolean
) {
  if (!available) unavailable.add(section);
}

export async function getStudentDashboardData(studentId: string): Promise<StudentDashboardData> {
  const [
    studentLookup,
    avatarResult,
    lichessResult,
    badgeResult,
    badgeAwardsResult,
    questResult,
    questTrackingResult,
    trainingResult,
    xpEventResult,
    coinResult
  ] = await Promise.all([
    findSupabaseStudentById(studentId, { includeRelations: false }),
    loadOptionalDashboardSection(() => getStudentAvatarState(studentId), null),
    loadOptionalDashboardSection(async () => {
      requireSupabaseServiceAccess();
      return getStoredLichessAccount(studentId);
    }, null),
    loadOptionalDashboardSection(listAdminBadges, []),
    loadOptionalDashboardSection(() => listStudentBadgeAwards(studentId), []),
    loadOptionalDashboardSection(listAdminQuests, []),
    loadOptionalDashboardSection(async () => {
      const state = await getSupabaseQuestTracking(studentId);
      if (!state.configured || state.error) {
        throw new Error(state.error ?? "Quest tracking is not configured.");
      }
      return state;
    }, emptyQuestTracking),
    loadOptionalDashboardSection(async () => {
      requireSupabaseServiceAccess();
      return getStudentPuzzleTrainingOverview(studentId);
    }, emptyStudentDashboardTraining),
    loadOptionalDashboardSection(() => listRecentStudentXpEvents(studentId), []),
    loadOptionalDashboardSection(async () => {
      requireSupabaseServiceAccess();
      return listStudentCoinTransactions(studentId, RECENT_ACTIVITY_SOURCE_LIMIT);
    }, [])
  ]);

  const student = studentLookup.student;
  if (!student) {
    throw new Error(studentLookup.error ?? "Active student profile not found.");
  }

  const unavailable = new Set<StudentDashboardSection>();
  recordUnavailable(
    unavailable,
    "avatar",
    avatarResult.available && avatarResult.value?.source === "supabase"
  );
  recordUnavailable(unavailable, "lichess", lichessResult.available);
  recordUnavailable(unavailable, "badges", badgeResult.available && badgeAwardsResult.available);
  recordUnavailable(unavailable, "quests", questResult.available && questTrackingResult.available);
  recordUnavailable(unavailable, "training", trainingResult.available);
  recordUnavailable(unavailable, "activity", xpEventResult.available && coinResult.available);

  const badgeAwardById = new Map(badgeAwardsResult.value.map((award) => [award.badge_id, award]));
  const badgesWithAwardDates = badgeResult.value.map((badge) => {
    const award = badgeAwardById.get(badge.id);
    return award ? { ...badge, createdAt: award.awarded_at } : badge;
  });
  const badgeById = new Map(badgesWithAwardDates.map((badge) => [badge.id, badge]));
  const earnedBadges = badgeAwardsResult.value.flatMap((award) => {
    const badge = badgeById.get(award.badge_id);
    return badge ? [badge] : [];
  });
  const studentWithBadges = { ...student, badgeIds: badgeAwardsResult.value.map((award) => award.badge_id) };
  const quests = questResult.available && questTrackingResult.available
    ? summarizeStudentDashboardQuests({
      studentId,
      quests: questResult.value,
      attempts: questTrackingResult.value.attempts,
      progress: questTrackingResult.value.progress,
      completions: questTrackingResult.value.completions
    })
    : emptyStudentDashboardQuestSummary;
  const activity = buildStudentActivityItems({
    student: studentWithBadges,
    badges: badgesWithAwardDates,
    quests: questResult.value,
    xpEvents: xpEventResult.value,
    questAttempts: questTrackingResult.value.attempts,
    questProgress: questTrackingResult.value.progress,
    questCompletions: questTrackingResult.value.completions,
    lichessAccount: lichessResult.value ?? undefined,
    coinTransactions: coinResult.value,
    limit: 10
  });

  return {
    student: {
      id: student.id,
      name: student.name,
      classGroup: student.classGroup
    },
    progress: buildStudentDashboardProgress(student, lichessResult.value),
    wallet: avatarResult.value
      ? {
        academyCoins: avatarResult.value.wallet.academyCoins,
        totalCoinsEarned: avatarResult.value.wallet.totalCoinsEarned,
        totalCoinsSpent: avatarResult.value.wallet.totalCoinsSpent
      }
      : { academyCoins: 0, totalCoinsEarned: 0, totalCoinsSpent: 0 },
    avatar: avatarResult.value
      ? { items: avatarResult.value.items, config: avatarResult.value.avatar }
      : null,
    lichess: buildStudentDashboardLichess(lichessResult.value),
    training: trainingResult.value,
    quests,
    badges: earnedBadges,
    activity,
    unavailableSections: [...unavailable]
  };
}
