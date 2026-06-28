import type { LichessQuestGame, LichessQuestProgress, Quest } from "@/lib/types";
import type { QuestWindow } from "@/lib/quests/timeWindows";

export function evaluateLichessGameQuest(
  studentId: string,
  quest: Quest,
  window: QuestWindow,
  games: LichessQuestGame[],
  mode: "connected" | "mock",
  fetchError?: string
): LichessQuestProgress {
  const ratedFinished = games.filter((game) => game.rated && game.finished);
  const valid = ratedFinished.filter((game) => (game.moveCount || Math.ceil(game.turns / 2)) >= 10);
  const ignoredShortGames = ratedFinished.length - valid.length;
  const isWinQuest = quest.conditionType === "rated_win_count" || quest.conditionType === "rapid_win_count" || quest.conditionType === "blitz_win_count";
  const relevant = isWinQuest ? valid.filter((game) => game.won) : valid;
  const requiredValue = quest.requiredCount ?? 1;
  const label = quest.conditionType === "blitz_win_count" || quest.conditionType === "blitz_games_played_count"
    ? "rated blitz games"
    : quest.conditionType === "rapid_win_count" || quest.conditionType === "rapid_games_played_count"
      ? "rated rapid games"
      : "rated games";
  const countedEvidence = isWinQuest
    ? `Fetched ${games.length} game${games.length === 1 ? "" : "s"} and counted ${relevant.length} ${label} won during ${window.label}. ${ignoredShortGames} rated finished game${ignoredShortGames === 1 ? "" : "s"} under 10 moves ignored.`
    : `Fetched ${games.length} game${games.length === 1 ? "" : "s"} and counted ${relevant.length} ${label} during ${window.label}. ${ignoredShortGames} rated finished game${ignoredShortGames === 1 ? "" : "s"} under 10 moves ignored.`;
  const evidence = fetchError ? `Lichess game sync did not return fresh data: ${fetchError} ${countedEvidence}` : countedEvidence;

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
