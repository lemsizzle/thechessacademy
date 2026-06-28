import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { createMockStudentGamesForWindow, fetchStudentGamesForWindow, type LichessGamePerfType } from "@/lib/lichess/fetchStudentGamesForWindow";
import { createMockStudentPuzzleActivityForWindow, fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { approveQuestAward } from "@/lib/quests/approveQuestAward";
import { createPendingQuestAwards } from "@/lib/quests/createPendingQuestAward";
import { evaluateQuestRules } from "@/lib/quests/evaluateQuestRules";
import { getQuestWindow } from "@/lib/quests/timeWindows";
import type { ArenaTournamentResult, LichessActivitySnapshot, PendingQuestAward, Quest, QuestCompletionEvent, StudentLichessAccount } from "@/lib/types";

type EvaluateRequest = {
  studentId: string;
  username: string;
  quests: Quest[];
  arenaResults?: ArenaTournamentResult[];
  account?: StudentLichessAccount;
  existingAwards?: PendingQuestAward[];
  completionEvents?: QuestCompletionEvent[];
  timeZone?: string;
};

function getPerfTypesForQuest(quest: Quest): LichessGamePerfType[] {
  if (quest.conditionType === "blitz_win_count") return ["blitz"];
  if (quest.conditionType === "rapid_win_count" || quest.conditionType === "rapid_games_played_count") return ["rapid"];
  if (quest.conditionType === "rated_win_count" || quest.conditionType === "rated_games_played_count") return ["bullet", "blitz", "rapid", "classical", "correspondence"];
  return ["rapid"];
}

async function fetchGamesForPerfTypes(username: string, start: Date, end: Date, perfTypes: LichessGamePerfType[], accessToken?: string | null) {
  const results = await Promise.allSettled(perfTypes.map((perfType) => fetchStudentGamesForWindow(username, start, end, perfType, accessToken)));
  const games = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!games.length && results.some((result) => result.status === "rejected")) throw new Error("No Lichess game activity could be fetched.");
  return Array.from(new Map(games.map((game) => [game.id, game])).values());
}

export async function evaluateStudentQuestRequest(
  input: EvaluateRequest,
  cookieStore: { get: (name: string) => { value: string } | undefined },
  { allowPuzzleToken = false } = {}
) {
  const gamesByQuest: Record<string, Awaited<ReturnType<typeof fetchStudentGamesForWindow>>> = {};
  const puzzlesByQuest: Record<string, Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>>> = {};
  const modeByQuest: Record<string, "connected" | "mock"> = {};
  const fetchErrorsByQuest: Record<string, string> = {};
  const snapshots: LichessActivitySnapshot[] = [];
  const windowsByQuest: Record<string, ReturnType<typeof getQuestWindow>> = {};
  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value;
  const token = allowPuzzleToken && encryptedToken ? decryptLichessToken(encryptedToken) : null;
  const gameCache = new Map<string, Awaited<ReturnType<typeof fetchStudentGamesForWindow>>>();
  const puzzleCache = new Map<string, Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>>>();

  for (const quest of input.quests.filter((item) => item.isActive !== false && item.source?.startsWith("lichess_"))) {
    if (quest.source === "lichess_games") {
      const baseWindow = getQuestWindow(quest.timeWindow, input.timeZone);
      const baseline = input.account ? new Date(input.account.activityBaselineSetAt ?? input.account.linkedAt) : undefined;
      const window = baseline && baseline > baseWindow.start
        ? { ...baseWindow, start: baseline, label: `${baseline.toISOString().slice(0, 10)} to ${baseWindow.end.toISOString().slice(0, 10)}` }
        : baseWindow;
      windowsByQuest[quest.id] = window;
      const perfTypes = getPerfTypesForQuest(quest);
      const cacheKey = `${perfTypes.join("-")}-${window.start.toISOString()}-${window.end.toISOString()}`;
      try {
        const games = gameCache.get(cacheKey) ?? await fetchGamesForPerfTypes(input.username, window.start, window.end, perfTypes, token);
        gameCache.set(cacheKey, games);
        gamesByQuest[quest.id] = games;
        modeByQuest[quest.id] = "connected";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Lichess game activity could not be fetched.";
        const canUseMockFallback = input.account?.syncStatus === "mock" || token?.startsWith("mock-token-");
        gamesByQuest[quest.id] = canUseMockFallback ? perfTypes.flatMap((perfType) => createMockStudentGamesForWindow(window.start, perfType)) : [];
        modeByQuest[quest.id] = canUseMockFallback ? "mock" : "connected";
        if (!canUseMockFallback) fetchErrorsByQuest[quest.id] = message;
      }
      snapshots.push({
        id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
        studentId: input.studentId,
        source: quest.source,
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
        data: { games: gamesByQuest[quest.id], error: fetchErrorsByQuest[quest.id] },
        mode: modeByQuest[quest.id],
        createdAt: new Date().toISOString()
      });
    }

    if (quest.source === "lichess_puzzles") {
      const baseWindow = getQuestWindow(quest.timeWindow, input.timeZone);
      const baseline = input.account ? new Date(input.account.activityBaselineSetAt ?? input.account.linkedAt) : undefined;
      const window = baseline && baseline > baseWindow.start
        ? { ...baseWindow, start: baseline, label: `${baseline.toISOString().slice(0, 10)} to ${baseWindow.end.toISOString().slice(0, 10)}` }
        : baseWindow;
      windowsByQuest[quest.id] = window;
      const cacheKey = `${window.start.toISOString()}-${window.end.toISOString()}`;
      try {
        if (!token || token.startsWith("mock-token-")) throw new Error("No real puzzle token.");
        const puzzles = puzzleCache.get(cacheKey) ?? await fetchStudentPuzzleActivityForWindow(token, window.start, window.end);
        puzzleCache.set(cacheKey, puzzles);
        puzzlesByQuest[quest.id] = puzzles;
        modeByQuest[quest.id] = "connected";
      } catch {
        puzzlesByQuest[quest.id] = createMockStudentPuzzleActivityForWindow(window.start, window.end);
        modeByQuest[quest.id] = "mock";
      }
      snapshots.push({
        id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
        studentId: input.studentId,
        source: quest.source,
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
        data: { puzzles: puzzlesByQuest[quest.id] },
        mode: modeByQuest[quest.id],
        createdAt: new Date().toISOString()
      });
    }
  }

  const progress = evaluateQuestRules({
    studentId: input.studentId,
    quests: input.quests,
    gamesByQuest,
    puzzlesByQuest,
    arenaResults: input.arenaResults ?? [],
    account: input.account,
    modeByQuest,
    windowsByQuest,
    fetchErrorsByQuest,
    timeZone: input.timeZone
  });
  const generatedAwards = createPendingQuestAwards(
    input.studentId,
    input.quests,
    progress,
    input.existingAwards ?? [],
    input.completionEvents ?? []
  );
  const autoApproved = generatedAwards
    .filter((award) => input.quests.find((quest) => quest.id === award.questId)?.approvalRequired === false)
    .map((award) => approveQuestAward(award));
  const newAwards = generatedAwards.filter((award) => input.quests.find((quest) => quest.id === award.questId)?.approvalRequired !== false);

  return {
    progress,
    newAwards,
    autoApprovedAwards: autoApproved.map((item) => item.award),
    autoCompletions: autoApproved.map((item) => item.completion),
    snapshots
  };
}
