import { BOT_DIFFICULTIES } from "@/chess/game/config";
import { mapLichessThemeToTactic } from "@/lib/lichess/gameTacticThemeMap";
import type { LichessQuestProgress, Quest } from "@/lib/types";
import type { QuestWindow } from "@/lib/quests/timeWindows";

export type InternalQuestGameActivity = {
  id: string;
  completedAt: string;
  opponentType: "computer" | "student";
  opponentId?: string;
  result: "win" | "loss" | "draw";
  takebackCount?: number;
};

export type InternalQuestPuzzleActivity = {
  id: string;
  attemptedAt: string;
  solved: boolean;
  firstTryCorrect: boolean;
  selectedTheme: string;
  themes: string[];
};

function academyReadError(kind: "game" | "puzzle", error: string) {
  const clean = error.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return `Academy ${kind} quest activity could not be read. ${clean}`.trim();
}

export function evaluateInternalGameQuest(
  studentId: string,
  quest: Quest,
  window: QuestWindow,
  games: InternalQuestGameActivity[],
  fetchError?: string
): LichessQuestProgress {
  const computerOnly = quest.conditionType === "internal_computer_games_played_count" || quest.conditionType === "internal_computer_games_won_count";
  const liveOnly = quest.conditionType === "internal_live_games_played_count" || quest.conditionType === "internal_live_games_won_count";
  const winsOnly = quest.conditionType === "internal_games_won_count" || quest.conditionType === "internal_computer_games_won_count" || quest.conditionType === "internal_live_games_won_count";
  const modeGames = computerOnly
    ? games.filter((game) => game.opponentType === "computer")
    : liveOnly ? games.filter((game) => game.opponentType === "student") : games;
  const opponentGames = computerOnly && quest.requiredOpponentId
    ? modeGames.filter((game) => game.opponentId === quest.requiredOpponentId)
    : modeGames;
  const questEligibleGames = quest.conditionType === "internal_computer_games_won_count"
    ? opponentGames.filter((game) => (game.takebackCount ?? 0) === 0)
    : opponentGames;
  const counted = winsOnly ? questEligibleGames.filter((game) => game.result === "win") : questEligibleGames;
  const requiredValue = quest.requiredCount ?? 1;
  const targetBot = quest.requiredOpponentId ? BOT_DIFFICULTIES.find((bot) => bot.id === quest.requiredOpponentId) : undefined;
  const modeLabel = targetBot ? targetBot.name : computerOnly ? "computer" : liveOnly ? "student-vs-student" : "Academy";
  const actionLabel = winsOnly ? "wins" : "completed games";

  return {
    studentId,
    questId: quest.id,
    sourcePeriodStart: window.start.toISOString(),
    sourcePeriodEnd: window.end.toISOString(),
    currentValue: counted.length,
    requiredValue,
    completed: counted.length >= requiredValue,
    evidence: fetchError
      ? academyReadError("game", fetchError)
      : targetBot
        ? `Counted ${counted.length} ${actionLabel} against ${modeLabel} from ${games.length} completed in-app game${games.length === 1 ? "" : "s"} during ${window.label}.`
        : `Counted ${counted.length} ${modeLabel} ${actionLabel} from ${games.length} completed in-app game${games.length === 1 ? "" : "s"} during ${window.label}.`,
    mode: "connected",
    updatedAt: new Date().toISOString()
  };
}

export function evaluateInternalPuzzleQuest(
  studentId: string,
  quest: Quest,
  window: QuestWindow,
  attempts: InternalQuestPuzzleActivity[],
  fetchError?: string
): LichessQuestProgress {
  const solved = attempts.filter((attempt) => attempt.solved);
  const firstTry = solved.filter((attempt) => attempt.firstTryCorrect);
  const themedSolved = quest.requiredTheme
    ? solved.filter((attempt) => [...attempt.themes, attempt.selectedTheme].some((theme) => mapLichessThemeToTactic(theme) === quest.requiredTheme))
    : solved;
  const accuracy = attempts.length ? Math.round((solved.length / attempts.length) * 100) : 0;
  const isAccuracy = quest.conditionType === "internal_puzzle_accuracy_threshold";
  const currentValue = quest.conditionType === "internal_puzzle_attempted_count" || isAccuracy
    ? attempts.length
    : quest.conditionType === "internal_puzzle_first_try_count"
      ? firstTry.length
      : quest.conditionType === "internal_puzzle_theme_solved_count" ? themedSolved.length : solved.length;
  const requiredValue = quest.requiredCount ?? 1;
  const completed = currentValue >= requiredValue && (!isAccuracy || accuracy >= (quest.requiredAccuracy ?? 0));
  const countedEvidence = isAccuracy
    ? `Attempted ${attempts.length} Academy puzzles with ${accuracy}% accuracy during ${window.label}.`
    : quest.conditionType === "internal_puzzle_theme_solved_count"
      ? `Solved ${themedSolved.length} ${quest.requiredTheme ?? "themed"} Academy puzzles during ${window.label}.`
      : quest.conditionType === "internal_puzzle_first_try_count"
        ? `Solved ${firstTry.length} Academy puzzles correctly on the first try during ${window.label}.`
        : `Solved ${solved.length} of ${attempts.length} Academy puzzles during ${window.label}.`;

  return {
    studentId,
    questId: quest.id,
    sourcePeriodStart: window.start.toISOString(),
    sourcePeriodEnd: window.end.toISOString(),
    currentValue,
    requiredValue,
    accuracy,
    completed,
    evidence: fetchError ? academyReadError("puzzle", fetchError) : countedEvidence,
    mode: "connected",
    updatedAt: new Date().toISOString()
  };
}
