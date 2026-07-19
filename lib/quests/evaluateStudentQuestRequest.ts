import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { createMockStudentGamesForWindow, fetchStudentGamesForWindow, type LichessGamePerfType } from "@/lib/lichess/fetchStudentGamesForWindow";
import { createMockStudentPuzzleActivityForWindow, fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { isLichessRateLimitError } from "@/lib/lichess/rateLimit";
import { approveQuestAward } from "@/lib/quests/approveQuestAward";
import { createPendingQuestAwards } from "@/lib/quests/createPendingQuestAward";
import { evaluateQuestRules } from "@/lib/quests/evaluateQuestRules";
import { getActiveQuestAttempt, getAttemptQuestWindow } from "@/lib/quests/questAttempts";
import { getQuestWindow, type QuestWindow } from "@/lib/quests/timeWindows";
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

function getPerfTypesForQuest(quest: Quest): LichessGamePerfType[] {
  if (quest.conditionType === "blitz_win_count" || quest.conditionType === "blitz_games_played_count") return ["blitz"];
  if (quest.conditionType === "rapid_win_count" || quest.conditionType === "rapid_games_played_count") return ["rapid"];
  if (quest.conditionType === "rated_win_count" || quest.conditionType === "rated_games_played_count") return ["bullet", "blitz", "rapid", "classical", "correspondence"];
  return ["rapid"];
}

function getEvaluationWindow(input: EvaluateRequest, quest: Quest, attempt: StudentQuestAttempt | undefined) {
  const baseWindow = attempt ? getAttemptQuestWindow(attempt) : getQuestWindow(quest.timeWindow, input.timeZone);
  const baseline = input.account ? new Date(input.account.activityBaselineSetAt ?? input.account.linkedAt) : undefined;
  if (!baseline || Number.isNaN(baseline.getTime()) || baseline <= baseWindow.start) return baseWindow;
  return {
    ...baseWindow,
    start: baseline,
    label: `${baseline.toISOString().slice(0, 10)} to ${baseWindow.end.toISOString().slice(0, 10)}`
  };
}

function mergeWindows(windows: Array<ReturnType<typeof getQuestWindow>>) {
  return {
    start: new Date(Math.min(...windows.map((window) => window.start.getTime()))),
    end: new Date(Math.max(...windows.map((window) => window.end.getTime())))
  };
}

function isInsideWindow(value: string, window: ReturnType<typeof getQuestWindow>) {
  const time = new Date(value).getTime();
  return time >= window.start.getTime() && time <= window.end.getTime();
}

function getAccountActivityWindow(account?: StudentLichessAccount): QuestWindow | undefined {
  if (!account) return undefined;
  const start = new Date(account.activityBaselineSetAt ?? account.linkedAt);
  const end = new Date();
  if (Number.isNaN(start.getTime()) || start >= end) return undefined;
  return { start, end, label: `${start.toISOString()} to ${end.toISOString()}` };
}

export async function evaluateStudentQuestRequest(
  input: EvaluateRequest,
  cookieStore: { get: (name: string) => { value: string } | undefined },
  { allowPuzzleToken = false, skipPuzzleQuestsWithoutToken = false } = {}
) {
  const gamesByQuest: Record<string, Awaited<ReturnType<typeof fetchStudentGamesForWindow>>> = {};
  const puzzlesByQuest: Record<string, Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>>> = {};
  const modeByQuest: Record<string, "connected" | "mock"> = {};
  const fetchErrorsByQuest: Record<string, string> = {};
  const snapshots: LichessActivitySnapshot[] = [];
  const windowsByQuest: Record<string, ReturnType<typeof getQuestWindow>> = {};
  let requestCount = 0;
  let rateLimited = false;
  let retryAfterSeconds = 0;
  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value;
  const token = allowPuzzleToken && encryptedToken ? decryptLichessToken(encryptedToken) : null;
  const activityWindow = getAccountActivityWindow(input.account);
  const evaluatedQuestIds = new Set<string>();
  const eligibleQuests = input.quests.filter((item) => item.isActive !== false && item.source?.startsWith("lichess_"));
  const gameQuests: Quest[] = [];
  const puzzleQuests: Quest[] = [];

  for (const quest of eligibleQuests) {
    const attempt = getActiveQuestAttempt(input.questAttempts ?? [], input.studentId, quest.id);
    if (!attempt && quest.timeWindow !== "all_time" && quest.timeWindow !== "tournament") continue;
    if (quest.source === "lichess_tournaments") {
      evaluatedQuestIds.add(quest.id);
      continue;
    }
    const window = getEvaluationWindow(input, quest, attempt);
    windowsByQuest[quest.id] = window;
    if (quest.source === "lichess_games") gameQuests.push(quest);
    if (quest.source === "lichess_puzzles") puzzleQuests.push(quest);
  }

  const gameWindowsByPerf = new Map<LichessGamePerfType, Array<ReturnType<typeof getQuestWindow>>>();
  for (const quest of gameQuests) {
    const window = windowsByQuest[quest.id];
    if (!window) continue;
    for (const perfType of getPerfTypesForQuest(quest)) {
      gameWindowsByPerf.set(perfType, [...(gameWindowsByPerf.get(perfType) ?? []), window]);
    }
  }
  if (activityWindow) {
    gameWindowsByPerf.set("rapid", [...(gameWindowsByPerf.get("rapid") ?? []), activityWindow]);
    gameWindowsByPerf.set("blitz", [...(gameWindowsByPerf.get("blitz") ?? []), activityWindow]);
  }

  const gamesByPerf = new Map<LichessGamePerfType, Awaited<ReturnType<typeof fetchStudentGamesForWindow>>>();
  const gameErrorsByPerf = new Map<LichessGamePerfType, string>();
  for (const [perfType, windows] of gameWindowsByPerf.entries()) {
    const window = mergeWindows(windows);
    try {
      requestCount += 1;
      gamesByPerf.set(perfType, await fetchStudentGamesForWindow(input.username, window.start, window.end, perfType, token));
    } catch (error) {
      if (isLichessRateLimitError(error)) {
        rateLimited = true;
        retryAfterSeconds = Math.max(retryAfterSeconds, "retryAfterSeconds" in error ? error.retryAfterSeconds : 60);
      }
      gameErrorsByPerf.set(perfType, error instanceof Error ? error.message : "Lichess game activity could not be fetched.");
      if (rateLimited) break;
    }
  }

  for (const quest of gameQuests) {
    const window = windowsByQuest[quest.id];
    if (!window) continue;
    const perfTypes = getPerfTypesForQuest(quest);
    const errors = perfTypes.flatMap((perfType) => gameErrorsByPerf.get(perfType) ?? []);
    const fetchedGames = perfTypes
      .flatMap((perfType) => gamesByPerf.get(perfType) ?? [])
      .filter((game) => isInsideWindow(game.playedAt, window));
    const canUseMockFallback = input.account?.syncStatus === "mock" || token?.startsWith("mock-token-");
    evaluatedQuestIds.add(quest.id);
    if (fetchedGames.length || !errors.length) {
      gamesByQuest[quest.id] = Array.from(new Map(fetchedGames.map((game) => [game.id, game])).values());
      modeByQuest[quest.id] = "connected";
    } else {
      gamesByQuest[quest.id] = canUseMockFallback ? perfTypes.flatMap((perfType) => createMockStudentGamesForWindow(window.start, perfType)) : [];
      modeByQuest[quest.id] = canUseMockFallback ? "mock" : "connected";
      if (!canUseMockFallback) fetchErrorsByQuest[quest.id] = errors[0] ?? "Lichess game activity could not be fetched.";
    }
    snapshots.push({
      id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
      studentId: input.studentId,
      source: "lichess_games",
      periodStart: window.start.toISOString(),
      periodEnd: window.end.toISOString(),
      data: { games: gamesByQuest[quest.id], error: fetchErrorsByQuest[quest.id] },
      mode: modeByQuest[quest.id],
      createdAt: new Date().toISOString()
    });
  }

  let fetchedActivityPuzzles: Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>> = [];
  let activityPuzzleFetchSucceeded = false;
  if (puzzleQuests.length || (activityWindow && token)) {
    const canUseMockFallback = input.account?.syncStatus === "mock" || token?.startsWith("mock-token-");
    const questsNeedingToken = puzzleQuests.filter((quest) => {
      if (token || !skipPuzzleQuestsWithoutToken || canUseMockFallback) return true;
      const window = windowsByQuest[quest.id];
      if (!window) return false;
      snapshots.push({
        id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
        studentId: input.studentId,
        source: "lichess_puzzles",
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
        data: { puzzles: [], error: "Puzzle activity requires the student's Lichess login token." },
        mode: "connected",
        createdAt: new Date().toISOString()
      });
      return false;
    });

    const puzzleWindows = [
      ...questsNeedingToken.flatMap((quest) => windowsByQuest[quest.id] ? [windowsByQuest[quest.id]] : []),
      ...(activityWindow && token ? [activityWindow] : [])
    ];
    let fetchedPuzzles: Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>> = [];
    let puzzleError = "";
    if (puzzleWindows.length) {
      const window = mergeWindows(puzzleWindows);
      try {
        if (!token || token.startsWith("mock-token-")) throw new Error("No real puzzle token.");
        requestCount += 1;
        fetchedPuzzles = await fetchStudentPuzzleActivityForWindow(token, window.start, window.end);
        activityPuzzleFetchSucceeded = true;
      } catch (error) {
        if (isLichessRateLimitError(error)) {
          rateLimited = true;
          retryAfterSeconds = Math.max(retryAfterSeconds, "retryAfterSeconds" in error ? error.retryAfterSeconds : 60);
        }
        puzzleError = error instanceof Error ? error.message : "Lichess puzzle activity could not be fetched.";
      }
    }

    for (const quest of questsNeedingToken) {
      const window = windowsByQuest[quest.id];
      if (!window) continue;
      evaluatedQuestIds.add(quest.id);
      if (fetchedPuzzles.length || !puzzleError) {
        puzzlesByQuest[quest.id] = fetchedPuzzles.filter((puzzle) => isInsideWindow(puzzle.date, window));
        modeByQuest[quest.id] = "connected";
      } else {
        puzzlesByQuest[quest.id] = canUseMockFallback ? createMockStudentPuzzleActivityForWindow(window.start, window.end) : [];
        modeByQuest[quest.id] = canUseMockFallback ? "mock" : "connected";
        if (!canUseMockFallback) fetchErrorsByQuest[quest.id] = puzzleError;
      }
      snapshots.push({
        id: `quest-snapshot-${input.studentId}-${quest.id}-${window.start.toISOString()}`,
        studentId: input.studentId,
        source: "lichess_puzzles",
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
        data: { puzzles: puzzlesByQuest[quest.id], error: fetchErrorsByQuest[quest.id] },
        mode: modeByQuest[quest.id],
        createdAt: new Date().toISOString()
      });
    }
    if (activityWindow && activityPuzzleFetchSucceeded) {
      fetchedActivityPuzzles = fetchedPuzzles.filter((puzzle) => isInsideWindow(puzzle.date, activityWindow));
    }
  }

  let syncedAccount = input.account;
  if (syncedAccount && activityWindow) {
    const rapidFetchSucceeded = gamesByPerf.has("rapid") && !gameErrorsByPerf.has("rapid");
    const blitzFetchSucceeded = gamesByPerf.has("blitz") && !gameErrorsByPerf.has("blitz");
    const rapidActivity = rapidFetchSucceeded
      ? (gamesByPerf.get("rapid") ?? []).filter((game) => isInsideWindow(game.playedAt, activityWindow))
      : undefined;
    const blitzActivity = blitzFetchSucceeded
      ? (gamesByPerf.get("blitz") ?? []).filter((game) => isInsideWindow(game.playedAt, activityWindow))
      : undefined;
    const now = new Date().toISOString();
    syncedAccount = {
      ...syncedAccount,
      ...(rapidActivity ? {
        baselineRapidGames: Math.max(0, syncedAccount.rapidGames - rapidActivity.length),
        baselineRapidWins: 0,
        rapidWins: rapidActivity.filter((game) => game.won).length
      } : {}),
      ...(blitzActivity ? {
        baselineBlitzGames: Math.max(0, syncedAccount.blitzGames - blitzActivity.length),
        baselineBlitzWins: 0,
        blitzWins: blitzActivity.filter((game) => game.won).length
      } : {}),
      ...(activityPuzzleFetchSucceeded ? {
        baselinePuzzleGames: Math.max(0, (syncedAccount.puzzleGames ?? 0) - fetchedActivityPuzzles.length),
        baselinePuzzleCorrect: 0,
        puzzleCorrect: fetchedActivityPuzzles.filter((puzzle) => puzzle.win).length
      } : {}),
      ...(rapidActivity || blitzActivity ? { lastGameSyncAt: now } : {}),
      ...(activityPuzzleFetchSucceeded ? { lastPuzzleSyncAt: now } : {}),
      updatedAt: now
    };
  }

  const evaluatedQuests = input.quests.filter((quest) => evaluatedQuestIds.has(quest.id));
  const progress = evaluateQuestRules({
    studentId: input.studentId,
    quests: evaluatedQuests,
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
    account: syncedAccount,
    requestCount,
    rateLimited,
    retryAfterSeconds
  };
}
