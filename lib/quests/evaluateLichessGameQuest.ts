import type { LichessQuestGame, LichessQuestProgress, Quest } from "@/lib/types";
import type { QuestWindow } from "@/lib/quests/timeWindows";

export function evaluateLichessGameQuest(studentId: string, quest: Quest, window: QuestWindow, games: LichessQuestGame[], mode: "connected" | "mock"): LichessQuestProgress {
  const valid = games.filter((game) => game.rated && game.finished && game.turns >= 10);
  const isWinQuest = quest.conditionType === "rated_win_count" || quest.conditionType === "rapid_win_count" || quest.conditionType === "blitz_win_count";
  const relevant = isWinQuest ? valid.filter((game) => game.won) : valid;
  const requiredValue = quest.requiredCount ?? 1;
  const label = quest.conditionType === "blitz_win_count"
    ? "rated blitz games"
    : quest.conditionType === "rapid_win_count" || quest.conditionType === "rapid_games_played_count"
      ? "rated rapid games"
      : "rated games";
  const evidence = isWinQuest
    ? `Won ${relevant.length} ${label} during ${window.label}. Games under 10 moves were ignored.`
    : `Played ${relevant.length} ${label} during ${window.label}. Games under 10 moves were ignored.`;

  return {
    studentId,
    questId: quest.id,
    sourcePeriodStart: window.start.toISOString(),
    sourcePeriodEnd: window.end.toISOString(),
    currentValue: relevant.length,
    requiredValue,
    completed: relevant.length >= requiredValue,
    evidence,
    mode,
    updatedAt: new Date().toISOString()
  };
}
