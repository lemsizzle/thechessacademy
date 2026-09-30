import { afterEach, describe, expect, it, vi } from "vitest";
import { getLichessOAuthScopeParam, getLichessOAuthScopes } from "@/lib/auth/lichessOAuth";
import { POST as syncMe } from "@/app/api/lichess/sync/me/route";
import { GET as syncCron } from "@/app/api/cron/lichess-team-tournaments/route";
import { evaluateStudentQuestRequest } from "@/lib/quests/evaluateStudentQuestRequest";
import type { Quest } from "@/lib/types";

const mocks = vi.hoisted(() => ({ games: vi.fn(), puzzles: vi.fn() }));
vi.mock("@/lib/quests/internalQuestActivityServer", () => ({
  loadInternalQuestGames: mocks.games,
  loadInternalQuestPuzzles: mocks.puzzles,
  loadInternalQuestStarWarsRuns: vi.fn(),
  loadInternalQuestWoodpeckerSets: vi.fn()
}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Lichess is identity only", () => {
  it("does not request activity scopes even with old deployment configuration", () => {
    vi.stubEnv("LICHESS_OAUTH_SCOPES", "puzzle:read team:read");
    expect(getLichessOAuthScopes()).toEqual([]);
    expect(getLichessOAuthScopeParam()).toBe("");
  });

  it("rejects stale sync requests and the retired cron without fetching anything", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const handler of [syncMe, syncCron]) {
      const response = handler(new Request("https://chessquest.app/api/lichess/sync/me"));
      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ code: "LICHESS_ACTIVITY_RETIRED" });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores external goals and tokens while awarding completed internal game quests", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    mocks.games.mockResolvedValue([{ id: "g1", completedAt: new Date().toISOString(), opponentType: "computer", result: "win" }]);
    const base: Quest = {
      id: "internal", title: "First game", description: "Play here", type: "weekly",
      status: "available", isActive: true, isLive: true, xpReward: 100,
      source: "internal_games", conditionType: "internal_games_played_count", requiredCount: 1, timeWindow: "all_time"
    };
    const cookies = { get: vi.fn(() => ({ value: "old-activity-token" })) };
    const result = await evaluateStudentQuestRequest({ studentId: "student", username: "player", quests: [
      base,
      { ...base, id: "external-game", source: "lichess_games", conditionType: "rapid_games_played_count" },
      { ...base, id: "external-puzzle", source: "lichess_puzzles", conditionType: "puzzle_solved_count" }
    ] }, cookies, { allowPuzzleToken: true, skipLichessActivity: false });
    expect(result.progress.map(item => item.questId)).toEqual(["internal"]);
    expect(result.autoCompletions).toHaveLength(1);
    expect(result.autoCompletions[0].xpAwarded).toBe(100);
    expect(result.account).toBeUndefined();
    expect(cookies.get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
