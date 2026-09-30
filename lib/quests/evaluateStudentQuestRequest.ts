import type { fetchStudentGamesForWindow } from "@/lib/lichess/fetchStudentGamesForWindow";
import type { fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { approveQuestAward } from "@/lib/quests/approveQuestAward";
import { createPendingQuestAwards } from "@/lib/quests/createPendingQuestAward";
import type { InternalQuestGameActivity, InternalQuestPuzzleActivity, InternalQuestStarWarsActivity, InternalQuestWoodpeckerSetActivity } from "@/lib/quests/evaluateInternalQuest";
import { evaluateQuestRules } from "@/lib/quests/evaluateQuestRules";
import { loadInternalQuestGames, loadInternalQuestPuzzles, loadInternalQuestStarWarsRuns, loadInternalQuestWoodpeckerSets } from "@/lib/quests/internalQuestActivityServer";
import { getActiveQuestAttempt, getAttemptQuestWindow } from "@/lib/quests/questAttempts";
import { getQuestWindow } from "@/lib/quests/timeWindows";
import type { ArenaTournamentResult, LichessActivitySnapshot, PendingQuestAward, Quest, QuestCompletionEvent, StudentLichessAccount, StudentQuestAttempt } from "@/lib/types";

type EvaluateRequest = {
  studentId: string;
  username: string;
  quests: Quest[];
  arenaResults?: ArenaTournamentResult[];
  account?: StudentLichessAccount;
  existingAwards?: PendingQuestAward[];
  completionEvents?: QuestCompletionEvent[];
  questAttempts?: StudentQuestAttempt[];
  timeZone?: string;
};

function mergeWindows(windows: Array<ReturnType<typeof getQuestWindow>>) {
  const start = new Date(Math.min(...windows.map((window) => window.start.getTime())));
  const end = new Date(Math.max(...windows.map((window) => window.end.getTime())));
  return { start, end, label: `${start.toISOString()} to ${end.toISOString()}` };
}

function isInsideWindow(value: string, window: ReturnType<typeof getQuestWindow>) {
  const time = new Date(value).getTime();
  return time >= window.start.getTime() && time <= window.end.getTime();
}

export async function evaluateStudentQuestRequest(
  input: EvaluateRequest,
  _cookieStore: { get: (name: string) => { value: string } | undefined },
  _options: { allowPuzzleToken?: boolean; skipPuzzleQuestsWithoutToken?: boolean; skipLichessActivity?: boolean } = {}
) {
  const gamesByQuest: Record<string, Awaited<ReturnType<typeof fetchStudentGamesForWindow>>> = {};
  const puzzlesByQuest: Record<string, Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>>> = {};
  const internalGamesByQuest: Record<string, InternalQuestGameActivity[]> = {};
  const internalPuzzlesByQuest: Record<string, InternalQuestPuzzleActivity[]> = {};
  const internalWoodpeckerSetsByQuest: Record<string, InternalQuestWoodpeckerSetActivity[]> = {};
  const internalStarWarsRunsByQuest: Record<string, InternalQuestStarWarsActivity[]> = {};
  const modeByQuest: Record<string, "connected" | "mock"> = {};
  const fetchErrorsByQuest: Record<string, string> = {};
  const snapshots: LichessActivitySnapshot[] = [];
  const windowsByQuest: Record<string, ReturnType<typeof getQuestWindow>> = {};
  const requestCount = 0;
  const rateLimited = false;
  const retryAfterSeconds = 0;
  const evaluatedQuestIds = new Set<string>();
  const internalGameQuests: Quest[] = [];
  const internalPuzzleQuests: Quest[] = [];

  for (const quest of input.quests.filter((item) => item.isActive !== false && (item.source === "internal_games" || item.source === "internal_puzzles"))) {
    const attempt = getActiveQuestAttempt(input.questAttempts ?? [], input.studentId, quest.id);
    if (!attempt && quest.timeWindow !== "all_time") continue;
    const window = attempt ? getAttemptQuestWindow(attempt) : getQuestWindow(quest.timeWindow, input.timeZone);
    windowsByQuest[quest.id] = window;
    evaluatedQuestIds.add(quest.id);
    modeByQuest[quest.id] = "connected";
    if (quest.source === "internal_games") internalGameQuests.push(quest);
    if (quest.source === "internal_puzzles") internalPuzzleQuests.push(quest);
  }

  if (internalGameQuests.length) {
    const mergedWindow = mergeWindows(internalGameQuests.map((quest) => windowsByQuest[quest.id]));
    try {
      const games = await loadInternalQuestGames(input.studentId, mergedWindow);
      for (const quest of internalGameQuests) {
        const window = windowsByQuest[quest.id];
        internalGamesByQuest[quest.id] = games.filter((game) => isInsideWindow(game.completedAt, window));
        snapshots.push({
          id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
          studentId: input.studentId,
          source: "internal_games",
          periodStart: window.start.toISOString(),
          periodEnd: window.end.toISOString(),
          data: { games: internalGamesByQuest[quest.id] },
          mode: "connected",
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Academy game activity could not be read.";
      for (const quest of internalGameQuests) {
        internalGamesByQuest[quest.id] = [];
        fetchErrorsByQuest[quest.id] = message;
      }
    }
  }

  if (internalPuzzleQuests.length) {
    const mergedWindow = mergeWindows(internalPuzzleQuests.map((quest) => windowsByQuest[quest.id]));
    const needsWoodpeckerSets = internalPuzzleQuests.some((quest) => quest.conditionType === "internal_woodpecker_set_completed_count");
    const needsStarWarsRuns = internalPuzzleQuests.some((quest) => quest.conditionType === "internal_star_wars_level_reached");
    const needsPuzzleAttempts = internalPuzzleQuests.some((quest) => (
      quest.conditionType !== "internal_woodpecker_set_completed_count"
      && quest.conditionType !== "internal_star_wars_level_reached"
    ));
    const [attemptResult, woodpeckerSetResult, starWarsRunResult] = await Promise.allSettled([
      needsPuzzleAttempts ? loadInternalQuestPuzzles(input.studentId, mergedWindow) : Promise.resolve([]),
      needsWoodpeckerSets ? loadInternalQuestWoodpeckerSets(input.studentId, mergedWindow) : Promise.resolve([]),
      needsStarWarsRuns ? loadInternalQuestStarWarsRuns(input.studentId, mergedWindow) : Promise.resolve([])
    ]);
    const attempts = attemptResult.status === "fulfilled" ? attemptResult.value : [];
    const woodpeckerSets = woodpeckerSetResult.status === "fulfilled" ? woodpeckerSetResult.value : [];
    const starWarsRuns = starWarsRunResult.status === "fulfilled" ? starWarsRunResult.value : [];

    for (const quest of internalPuzzleQuests) {
      const window = windowsByQuest[quest.id];
      const isWoodpeckerSetQuest = quest.conditionType === "internal_woodpecker_set_completed_count";
      const isStarWarsQuest = quest.conditionType === "internal_star_wars_level_reached";
      internalPuzzlesByQuest[quest.id] = attempts.filter((attempt) => isInsideWindow(attempt.attemptedAt, window));
      internalWoodpeckerSetsByQuest[quest.id] = woodpeckerSets.filter((set) => (
        isInsideWindow(set.startedAt, window) && isInsideWindow(set.completedAt, window)
      ));
      internalStarWarsRunsByQuest[quest.id] = starWarsRuns.filter((run) => (
        isInsideWindow(run.startedAt, window) && isInsideWindow(run.updatedAt, window)
      ));

      const relevantFailure = isStarWarsQuest
        ? starWarsRunResult.status === "rejected" ? starWarsRunResult.reason : undefined
        : isWoodpeckerSetQuest
        ? woodpeckerSetResult.status === "rejected" ? woodpeckerSetResult.reason : undefined
        : attemptResult.status === "rejected" ? attemptResult.reason : undefined;
      if (relevantFailure) {
        fetchErrorsByQuest[quest.id] = relevantFailure instanceof Error
          ? relevantFailure.message
          : "Academy puzzle activity could not be read.";
        continue;
      }

      snapshots.push({
        id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
        studentId: input.studentId,
        source: "internal_puzzles",
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
        data: {
          attempts: internalPuzzlesByQuest[quest.id],
          woodpeckerSets: internalWoodpeckerSetsByQuest[quest.id],
          starWarsRuns: internalStarWarsRunsByQuest[quest.id]
        },
        mode: "connected",
        createdAt: new Date().toISOString()
      });
    }
  }

  const evaluatedQuests = input.quests.filter((quest) => evaluatedQuestIds.has(quest.id));
  const progress = evaluateQuestRules({
    studentId: input.studentId,
    quests: evaluatedQuests,
    gamesByQuest,
    puzzlesByQuest,
    internalGamesByQuest,
    internalPuzzlesByQuest,
    internalWoodpeckerSetsByQuest,
    internalStarWarsRunsByQuest,
    arenaResults: input.arenaResults ?? [],
    account: undefined as StudentLichessAccount | undefined,
    modeByQuest,
    windowsByQuest,
    fetchErrorsByQuest,
    timeZone: input.timeZone
  });
  const generatedAwards = createPendingQuestAwards(
    input.studentId,
    evaluatedQuests,
    progress,
    input.existingAwards ?? [],
    input.completionEvents ?? []
  );
  const autoApproved = generatedAwards.map((award) => approveQuestAward(award));

  return {
    progress,
    newAwards: [],
    autoApprovedAwards: autoApproved.map((item) => item.award),
    autoCompletions: autoApproved.map((item) => item.completion),
    snapshots,
    account: undefined as StudentLichessAccount | undefined,
    requestCount,
    rateLimited,
    retryAfterSeconds
  };
}
