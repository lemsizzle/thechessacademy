import { createPendingAwardsFromProgress } from "@/lib/lichess";
import type { GameTacticFinding, PendingAward, Student, StudentTacticProgress } from "@/lib/types";

export function approveTacticFinding({
  finding,
  student,
  progress,
  pendingAwards
}: {
  finding: GameTacticFinding;
  student: Student;
  progress: StudentTacticProgress[];
  pendingAwards: PendingAward[];
}) {
  const duplicateKey = `${finding.lichessGameId}:${finding.moveNumber}:${finding.tacticTheme}`;
  const alreadyCounted = progress.some((item) => item.studentId === finding.studentId && item.updatedAt === duplicateKey);
  if (alreadyCounted) return { progress, newAwards: [] as PendingAward[] };

  const index = progress.findIndex((item) => item.studentId === finding.studentId && item.tacticTheme === finding.tacticTheme);
  const today = new Date().toISOString().slice(0, 10);
  const nextProgress = index >= 0
    ? progress.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const puzzleSolvedCount = item.puzzleSolvedCount ?? item.puzzlesSolved;
      const submittedGameFoundCount = (item.submittedGameFoundCount ?? 0) + 1;
      return {
        ...item,
        puzzleSolvedCount,
        submittedGameFoundCount,
        totalCount: puzzleSolvedCount + submittedGameFoundCount,
        puzzlesSolved: puzzleSolvedCount + submittedGameFoundCount,
        updatedAt: today
      };
    })
    : [...progress, { studentId: finding.studentId, tacticTheme: finding.tacticTheme, puzzlesSolved: 1, puzzleSolvedCount: 0, submittedGameFoundCount: 1, totalCount: 1, updatedAt: today }];

  return {
    progress: nextProgress,
    newAwards: createPendingAwardsFromProgress(student, nextProgress, pendingAwards)
  };
}
