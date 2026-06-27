import { badges } from "@/data/badges";
import { studentTacticProgress } from "@/data/studentTacticProgress";
import { getTacticProgressCount } from "@/lib/lichess";
import type { Badge, TacticTheme } from "@/lib/types";

export function getTacticBadgeProgress(studentId: string, tacticTheme: TacticTheme) {
  return studentTacticProgress.find((item) => item.studentId === studentId && item.tacticTheme === tacticTheme) ?? {
    studentId,
    tacticTheme,
    puzzlesSolved: 0,
    totalCount: 0
  };
}

export function getUnlockedTacticBadges(studentId: string, tacticTheme: TacticTheme) {
  const progress = getTacticBadgeProgress(studentId, tacticTheme);
  return badges.filter((badge) => badge.tacticTheme === tacticTheme && (badge.requiredPuzzleCount ?? 0) <= getTacticProgressCount(progress));
}

export function getNextTacticBadge(studentId: string, tacticTheme: TacticTheme) {
  const progress = getTacticBadgeProgress(studentId, tacticTheme);
  return badges
    .filter((badge) => badge.tacticTheme === tacticTheme && (badge.requiredPuzzleCount ?? 0) > getTacticProgressCount(progress))
    .sort((a, b) => (a.requiredPuzzleCount ?? 0) - (b.requiredPuzzleCount ?? 0))[0];
}

export function getClosestNextTacticBadge(studentId: string) {
  const nextBadges = badges
    .map((badge) => {
      if (!badge.tacticTheme) return null;
      const progress = getTacticBadgeProgress(studentId, badge.tacticTheme);
      const required = badge.requiredPuzzleCount ?? 0;
      const count = getTacticProgressCount(progress);
      if (count >= required) return null;
      return {
        badge,
        progress,
        remaining: required - count
      };
    })
    .filter((item): item is { badge: Badge; progress: ReturnType<typeof getTacticBadgeProgress>; remaining: number } => Boolean(item));

  return nextBadges.sort((a, b) => a.remaining - b.remaining || (a.badge.requiredPuzzleCount ?? 0) - (b.badge.requiredPuzzleCount ?? 0))[0];
}

export function evaluateTacticBadgeUnlocks(studentId: string, tacticTheme: TacticTheme, puzzlesSolved: number, existingBadgeIds: string[] = []) {
  return badges.filter((badge) => (
    badge.tacticTheme === tacticTheme &&
    (badge.requiredPuzzleCount ?? 0) <= puzzlesSolved &&
    !existingBadgeIds.includes(badge.id)
  ));
}
