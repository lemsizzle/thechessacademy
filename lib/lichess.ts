import { badges } from "@/data/badges";
import { mapLichessThemeToTactic } from "@/lib/lichess/gameTacticThemeMap";
import type { LichessPuzzleActivity, PendingAward, Student, StudentTacticProgress, TacticTheme } from "@/lib/types";
export { mapLichessThemeToTactic } from "@/lib/lichess/gameTacticThemeMap";

export function getTacticProgressCount(progress: StudentTacticProgress) {
  return progress.totalCount ?? progress.puzzlesSolved ?? 0;
}

export function parseLichessPuzzleActivityNdjson(ndjson: string): LichessPuzzleActivity[] {
  return ndjson
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as {
          puzzle?: { id?: string; themes?: string[]; rating?: number };
          date?: string | number;
        };
        const puzzleId = parsed.puzzle?.id;
        if (!puzzleId) return [];
        return [{
          puzzleId,
          themes: parsed.puzzle?.themes ?? [],
          rating: parsed.puzzle?.rating,
          date: typeof parsed.date === "number" ? new Date(parsed.date).toISOString() : parsed.date ?? new Date().toISOString()
        }];
      } catch {
        return [];
      }
    });
}

export function summarizePuzzleThemes(activities: LichessPuzzleActivity[]) {
  const counts = new Map<TacticTheme, number>();
  for (const activity of activities) {
    const tactics = Array.from(new Set(activity.themes.map(mapLichessThemeToTactic).filter((theme): theme is TacticTheme => Boolean(theme))));
    for (const tactic of tactics) counts.set(tactic, (counts.get(tactic) ?? 0) + 1);
  }
  return counts;
}

export function mergeTacticProgress(progress: StudentTacticProgress[], studentId: string, counts: Map<TacticTheme, number>) {
  const merged = [...progress];
  for (const [tacticTheme, puzzlesSolved] of counts) {
    const index = merged.findIndex((item) => item.studentId === studentId && item.tacticTheme === tacticTheme);
    if (index >= 0) {
      const submittedGameFoundCount = merged[index].submittedGameFoundCount ?? 0;
      const nextPuzzleCount = Math.max(merged[index].puzzleSolvedCount ?? merged[index].puzzlesSolved, puzzlesSolved);
      merged[index] = {
        ...merged[index],
        puzzlesSolved: nextPuzzleCount + submittedGameFoundCount,
        puzzleSolvedCount: nextPuzzleCount,
        submittedGameFoundCount,
        totalCount: nextPuzzleCount + submittedGameFoundCount,
        updatedAt: new Date().toISOString().slice(0, 10)
      };
    } else {
      merged.push({
        studentId,
        tacticTheme,
        puzzlesSolved,
        puzzleSolvedCount: puzzlesSolved,
        submittedGameFoundCount: 0,
        totalCount: puzzlesSolved,
        updatedAt: new Date().toISOString().slice(0, 10)
      });
    }
  }
  return merged;
}

export function createPendingAwardsFromProgress(student: Student, progress: StudentTacticProgress[], existingPendingAwards: PendingAward[]) {
  return progress.flatMap((item) => {
    if (item.studentId !== student.id) return [];
    return badges
      .filter((badge) => (
        badge.tacticTheme === item.tacticTheme &&
        (badge.requiredPuzzleCount ?? Number.POSITIVE_INFINITY) <= getTacticProgressCount(item) &&
        !student.badgeIds.includes(badge.id) &&
        !existingPendingAwards.some((award) => award.studentId === student.id && award.badgeId === badge.id && award.status !== "rejected")
      ))
      .map((badge): PendingAward => ({
        id: `pending-lichess-${student.id}-${badge.id}`,
        studentId: student.id,
        source: "lichess",
        tacticTheme: item.tacticTheme,
        badgeId: badge.id,
        badgeName: badge.name,
        xpValue: badge.xpValue,
        puzzlesSolved: getTacticProgressCount(item),
        status: "pending",
        createdAt: new Date().toISOString().slice(0, 10)
      }));
  });
}

export function getMockLichessNdjson(username: string) {
  const base = username.length % 2 === 0 ? ["fork", "pin", "mateIn1"] : ["deflection", "backRankMate", "doubleAttack"];
  return Array.from({ length: 14 }, (_, index) => JSON.stringify({
    date: Date.now() - index * 86400000,
    puzzle: {
      id: `${username}-mock-${index + 1}`,
      rating: 900 + index * 12,
      themes: [base[index % base.length]]
    }
  })).join("\n");
}
