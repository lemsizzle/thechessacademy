import type { QuestConditionType, QuestSource, QuestTimeWindow, TacticTheme } from "@/lib/types";

export const questSources: Array<{ value: QuestSource; label: string; description: string }> = [
  { value: "manual", label: "Manual / Teacher", description: "Teacher completes this from the dashboard." },
  { value: "lichess_games", label: "Lichess Games", description: "Checks rated games after the student first logs in." },
  { value: "lichess_puzzles", label: "Lichess Puzzles", description: "Checks puzzle activity from the connected Lichess account." },
  { value: "lichess_tournaments", label: "Lichess Arena", description: "Checks imported Arena tournament results." }
];

export const questConditions: Array<{ value: QuestConditionType; label: string; source: QuestSource; countLabel: string }> = [
  { value: "manual", label: "Manual completion", source: "manual", countLabel: "Required Count" },
  { value: "rated_win_count", label: "Win rated games", source: "lichess_games", countLabel: "Rated Wins" },
  { value: "rated_games_played_count", label: "Play rated games", source: "lichess_games", countLabel: "Rated Games" },
  { value: "rapid_win_count", label: "Win rated rapid games", source: "lichess_games", countLabel: "Rapid Wins" },
  { value: "rapid_games_played_count", label: "Play rated rapid games", source: "lichess_games", countLabel: "Rapid Games" },
  { value: "blitz_win_count", label: "Win rated blitz games", source: "lichess_games", countLabel: "Blitz Wins" },
  { value: "puzzle_solved_count", label: "Solve puzzles", source: "lichess_puzzles", countLabel: "Solved Puzzles" },
  { value: "puzzle_attempted_count", label: "Attempt puzzles", source: "lichess_puzzles", countLabel: "Attempted Puzzles" },
  { value: "puzzle_accuracy_threshold", label: "Puzzle accuracy streak", source: "lichess_puzzles", countLabel: "Puzzle Attempts" },
  { value: "puzzle_theme_solved_count", label: "Solve a tactic theme", source: "lichess_puzzles", countLabel: "Theme Puzzles" },
  { value: "arena_score_threshold", label: "Arena score", source: "lichess_tournaments", countLabel: "Arena Points" },
  { value: "tournament_participation", label: "Join Arena tournaments", source: "lichess_tournaments", countLabel: "Tournaments" },
  { value: "rating_peak", label: "Reach rating peak", source: "lichess_games", countLabel: "Rating" }
];

export const questTimeWindows: QuestTimeWindow[] = ["daily", "weekly", "monthly", "tournament", "all_time"];

export const questTacticThemes: TacticTheme[] = ["Fork", "Pin", "Skewer", "Discovered Attack", "Double Attack", "Deflection", "Decoy", "Removing the Defender", "Back Rank Mate", "Mate in One"];

export function getQuestConditionLabel(conditionType?: QuestConditionType) {
  return questConditions.find((condition) => condition.value === conditionType)?.label ?? "Manual completion";
}

export function getQuestSourceLabel(source?: QuestSource) {
  return questSources.find((item) => item.value === source)?.label ?? "Manual / Teacher";
}

export function getQuestCountLabel(conditionType?: QuestConditionType) {
  return questConditions.find((condition) => condition.value === conditionType)?.countLabel ?? "Required Count";
}

export function getConditionsForSource(source?: QuestSource) {
  return questConditions.filter((condition) => condition.source === (source ?? "manual"));
}
