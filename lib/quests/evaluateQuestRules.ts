import type { ArenaTournamentResult, LichessQuestProgress, Quest, StudentLichessAccount } from "@/lib/types";
import { getQuestWindow, type QuestWindow } from "@/lib/quests/timeWindows";
import { evaluateLichessGameQuest } from "@/lib/quests/evaluateLichessGameQuest";
import { evaluateLichessPuzzleQuest } from "@/lib/quests/evaluateLichessPuzzleQuest";
import { getLichessXpBreakdown } from "@/lib/lichessXp";
import type { LichessQuestGame, LichessQuestPuzzleActivity } from "@/lib/types";

type EvaluationInput = {
  studentId: string;
  quests: Quest[];
  gamesByQuest: Record<string, LichessQuestGame[]>;
  puzzlesByQuest: Record<string, LichessQuestPuzzleActivity[]>;
  arenaResults: ArenaTournamentResult[];
  account?: StudentLichessAccount;
  modeByQuest: Record<string, "connected" | "mock">;
  windowsByQuest?: Record<string, QuestWindow>;
  timeZone?: string;
};

export function evaluateQuestRules(input: EvaluationInput) {
  return input.quests.flatMap((quest): LichessQuestProgress[] => {
    if (quest.isActive === false || !quest.source || !quest.conditionType) return [];
    if (quest.source === "lichess_games") {
      const window = input.windowsByQuest?.[quest.id] ?? getQuestWindow(quest.timeWindow, input.timeZone);
      return [evaluateLichessGameQuest(input.studentId, quest, window, input.gamesByQuest[quest.id] ?? [], input.modeByQuest[quest.id] ?? "mock")];
    }
    if (quest.source === "lichess_puzzles") {
      const window = input.windowsByQuest?.[quest.id] ?? getQuestWindow(quest.timeWindow, input.timeZone);
      return [evaluateLichessPuzzleQuest(input.studentId, quest, window, input.puzzlesByQuest[quest.id] ?? [], input.modeByQuest[quest.id] ?? "mock")];
    }
    if (quest.source === "lichess_tournaments") {
      return input.arenaResults
        .filter((result) => {
          if (result.studentId !== input.studentId) return false;
          if (!input.account || !result.tournamentStartsAt) return true;
          const baseline = new Date(input.account.activityBaselineSetAt ?? input.account.linkedAt).getTime();
          return new Date(result.tournamentStartsAt).getTime() >= baseline;
        })
        .map((result) => ({
          studentId: input.studentId,
          questId: quest.id,
          sourcePeriodStart: result.tournamentStartsAt ?? result.importedAt,
          sourcePeriodEnd: result.tournamentStartsAt ?? result.importedAt,
          currentValue: result.score,
          requiredValue: quest.requiredScore ?? quest.requiredCount ?? 1,
          completed: result.score >= (quest.requiredScore ?? quest.requiredCount ?? 1),
          evidence: `Scored ${result.score} Arena points and finished rank ${result.rank} in tournament ${result.lichessTournamentId}.`,
          mode: "connected" as const,
          updatedAt: new Date().toISOString()
        }));
    }
    if (quest.conditionType === "rating_peak" && input.account) {
      const xp = getLichessXpBreakdown(input.account);
      const peak = Math.max(xp.blitzPeak ?? 0, xp.rapidPeak ?? 0, xp.puzzlePeak ?? 0);
      const requiredValue = quest.requiredScore ?? quest.requiredCount ?? 1;
      const window = getQuestWindow("all_time", input.timeZone);
      return [{
        studentId: input.studentId,
        questId: quest.id,
        sourcePeriodStart: window.start.toISOString(),
        sourcePeriodEnd: window.end.toISOString(),
        currentValue: peak,
        requiredValue,
        completed: peak >= requiredValue,
        evidence: `Reached a recorded Lichess rating peak of ${peak}.`,
        mode: "connected" as const,
        updatedAt: new Date().toISOString()
      }];
    }
    return [];
  });
}
