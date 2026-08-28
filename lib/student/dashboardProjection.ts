import { getStudentXpWithLichess } from "@/lib/lichessXp";
import { emptyPuzzleTrainingOverview, type PuzzleTrainingOverview } from "@/lib/puzzle-training/overview";
import { selectQuestLifecycle, selectQuestProgress } from "@/lib/quests/selectQuestProgress";
import type { StudentActivityItem } from "@/lib/studentActivity";
import type {
  AvatarItem,
  Badge,
  LichessQuestProgress,
  Quest,
  QuestCompletionEvent,
  Student,
  StudentAvatarConfig,
  StudentLichessAccount,
  StudentQuestAttempt
} from "@/lib/types";
import { getLevelTitle, getXpProgressToNextLevel } from "@/lib/xp";

export type StudentDashboardSection = "avatar" | "lichess" | "badges" | "quests" | "training" | "activity";

export type StudentDashboardProgress = {
  lifetimeXp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  neededXp: number;
  percent: number;
  isMaxLevel: boolean;
};

export type StudentDashboardRating = {
  key: "rapid" | "blitz" | "puzzle";
  label: string;
  rating: number | null;
  games: number;
  ratingChange: number | null;
  provisional: boolean;
};

export type StudentDashboardLichess = {
  username: string;
  profileUrl: string;
  syncStatus: StudentLichessAccount["syncStatus"];
  lastSyncedAt: string | null;
  ratings: StudentDashboardRating[];
};

export type StudentDashboardQuestProgress = {
  currentValue: number;
  requiredValue: number;
  accuracy: number | null;
  completed: boolean;
};

export type StudentDashboardQuestSummary = {
  activeCount: number;
  completedCount: number;
  soonestExpiring: {
    id: string;
    title: string;
    expiresAt: string;
    progress: StudentDashboardQuestProgress | null;
  } | null;
};

export type StudentDashboardData = {
  student: {
    id: string;
    name: string;
    classGroup: string;
    encouragement: string;
  };
  progress: StudentDashboardProgress;
  wallet: {
    academyCoins: number;
    totalCoinsEarned: number;
    totalCoinsSpent: number;
  };
  avatar: {
    items: AvatarItem[];
    config: StudentAvatarConfig;
  } | null;
  lichess: StudentDashboardLichess | null;
  training: PuzzleTrainingOverview;
  quests: StudentDashboardQuestSummary;
  badges: Badge[];
  activity: StudentActivityItem[];
  unavailableSections: StudentDashboardSection[];
};

export type OptionalDashboardSection<T> = {
  value: T;
  available: boolean;
};

export async function loadOptionalDashboardSection<T>(
  load: () => Promise<T>,
  fallback: T
): Promise<OptionalDashboardSection<T>> {
  try {
    return { value: await load(), available: true };
  } catch {
    return { value: fallback, available: false };
  }
}

export function buildStudentDashboardProgress(
  student: Student,
  lichessAccount?: StudentLichessAccount | null
): StudentDashboardProgress {
  const lifetimeXp = getStudentXpWithLichess(student, lichessAccount ?? undefined).totalXp;
  const progress = getXpProgressToNextLevel(lifetimeXp);

  return {
    lifetimeXp,
    level: progress.level,
    title: getLevelTitle(progress.level).name,
    currentLevelXp: progress.currentXp,
    nextLevelXp: progress.nextLevelXp,
    neededXp: progress.neededXp,
    percent: progress.percent,
    isMaxLevel: progress.isMaxLevel
  };
}

function latestTimestamp(values: Array<string | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value));
  return valid.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

export function buildStudentDashboardLichess(
  account?: StudentLichessAccount | null
): StudentDashboardLichess | null {
  if (!account) return null;

  return {
    username: account.lichessUsername,
    profileUrl: account.lichessProfileUrl,
    syncStatus: account.syncStatus,
    lastSyncedAt: latestTimestamp([
      account.lastRatingSyncAt,
      account.lastPuzzleSyncAt,
      account.lastGameSyncAt,
      account.updatedAt
    ]),
    ratings: [
      {
        key: "rapid",
        label: "Rapid",
        rating: account.rapidRating,
        games: account.rapidGames,
        ratingChange: account.rapidRatingChange,
        provisional: account.rapidProvisional
      },
      {
        key: "blitz",
        label: "Blitz",
        rating: account.blitzRating,
        games: account.blitzGames,
        ratingChange: account.blitzRatingChange,
        provisional: account.blitzProvisional
      },
      {
        key: "puzzle",
        label: "Puzzles",
        rating: account.puzzleRating ?? null,
        games: account.puzzleGames ?? 0,
        ratingChange: null,
        provisional: false
      }
    ]
  };
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function summarizeStudentDashboardQuests({
  studentId,
  quests,
  attempts,
  progress,
  completions,
  now = Date.now()
}: {
  studentId: string;
  quests: Quest[];
  attempts: StudentQuestAttempt[];
  progress: LichessQuestProgress[];
  completions: QuestCompletionEvent[];
  now?: number;
}): StudentDashboardQuestSummary {
  const studentAttempts = attempts.filter((item) => item.studentId === studentId);
  const studentProgress = progress.filter((item) => item.studentId === studentId);
  const studentCompletions = completions.filter((item) => item.studentId === studentId);
  const trackedQuestIds = new Set([
    ...studentAttempts.map((item) => item.questId),
    ...studentProgress.map((item) => item.questId),
    ...studentCompletions.map((item) => item.questId)
  ]);
  const visibleQuests = quests.filter((quest) => (
    quest.isActive !== false
    && (quest.isLive === true || trackedQuestIds.has(quest.id))
  ));
  const lifecycle = visibleQuests.map((quest) => ({
    quest,
    lifecycle: selectQuestLifecycle({
      studentId,
      quest,
      attempts: studentAttempts,
      completions: studentCompletions,
      now
    })
  }));
  const active = lifecycle
    .filter((item) => item.lifecycle.state === "active" && item.lifecycle.attempt)
    .sort((left, right) => dateValue(left.lifecycle.attempt!.expiresAt) - dateValue(right.lifecycle.attempt!.expiresAt));
  const soonest = active[0];

  if (!soonest?.lifecycle.attempt) {
    return {
      activeCount: active.length,
      completedCount: studentCompletions.length,
      soonestExpiring: null
    };
  }

  const selectedProgress = selectQuestProgress({
    quest: soonest.quest,
    progress: studentProgress,
    attempt: soonest.lifecycle.attempt
  });

  return {
    activeCount: active.length,
    completedCount: studentCompletions.length,
    soonestExpiring: {
      id: soonest.quest.id,
      title: soonest.quest.title,
      expiresAt: soonest.lifecycle.attempt.expiresAt,
      progress: selectedProgress
        ? {
          currentValue: selectedProgress.currentValue,
          requiredValue: selectedProgress.requiredValue,
          accuracy: selectedProgress.accuracy ?? null,
          completed: selectedProgress.completed
        }
        : null
    }
  };
}

export const emptyStudentDashboardQuestSummary: StudentDashboardQuestSummary = {
  activeCount: 0,
  completedCount: 0,
  soonestExpiring: null
};

export const emptyStudentDashboardTraining = emptyPuzzleTrainingOverview;
