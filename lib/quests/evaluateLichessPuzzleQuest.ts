import { mapLichessThemeToTactic } from "@/lib/lichess/gameTacticThemeMap";
import { formatSyncErrorForEvidence } from "@/lib/quests/formatQuestEvidence";
import type { LichessQuestProgress, LichessQuestPuzzleActivity, Quest } from "@/lib/types";
import type { QuestWindow } from "@/lib/quests/timeWindows";

export function evaluateLichessPuzzleQuest(
  studentId: string,
  quest: Quest,
  window: QuestWindow,
  activities: LichessQuestPuzzleActivity[],
  mode: "connected" | "mock",
  fetchError?: string
): LichessQuestProgress {
  const attempted = activities.length;
  const solved = activities.filter((activity) => activity.win);
  const themedSolved = quest.requiredTheme
    ? solved.filter((activity) => activity.themes.some((theme) => mapLichessThemeToTactic(theme) === quest.requiredTheme))
    : solved;
  const accuracy = attempted ? Math.round((solved.length / attempted) * 100) : 0;
  const isAccuracy = quest.conditionType === "puzzle_accuracy_threshold";
  const currentValue = quest.conditionType === "puzzle_attempted_count" || isAccuracy
    ? attempted
    : quest.conditionType === "puzzle_theme_solved_count" ? themedSolved.length : solved.length;
  const requiredValue = quest.requiredCount ?? 1;
  const completed = currentValue >= requiredValue && (!isAccuracy || accuracy >= (quest.requiredAccuracy ?? 0));
  const countedEvidence = isAccuracy
    ? `Attempted ${attempted} Lichess puzzles with ${accuracy}% accuracy during ${window.label}.`
    : quest.conditionType === "puzzle_theme_solved_count"
      ? `Solved ${themedSolved.length} ${quest.requiredTheme ?? "themed"} Lichess puzzles during ${window.label}.`
      : `Solved ${solved.length} of ${attempted} Lichess puzzles during ${window.label}.`;
  const evidence = fetchError ? formatSyncErrorForEvidence("puzzle", fetchError) : countedEvidence;

  return {
    studentId,
    questId: quest.id,
    sourcePeriodStart: window.start.toISOString(),
    sourcePeriodEnd: window.end.toISOString(),
    currentValue,
    requiredValue,
    accuracy,
    completed,
    evidence,
    mode,
    updatedAt: new Date().toISOString()
  };
}
