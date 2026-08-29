import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseServiceClient: vi.fn(),
  getSurvivalLeaderboardScores: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getSupabaseServiceClient }));
vi.mock("@/lib/leaderboard/survivalServer", () => ({
  getSurvivalLeaderboardScores: mocks.getSurvivalLeaderboardScores
}));

type TableFixture = {
  rows: unknown[];
  count?: number;
  error?: { message: string } | null;
  maxRows?: number;
};

function createServiceClient(
  fixtures: Record<string, TableFixture>,
  rpcFixtures: Record<string, { data?: unknown; error?: { message: string } | null }> = {}
) {
  const from = vi.fn((table: string) => {
    const fixture = fixtures[table] ?? { rows: [] };
    let limit: number | null = null;
    let greaterThanId: string | null = null;

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      gt: vi.fn((column: string, value: string) => {
        if (column === "id") greaterThanId = value;
        return query;
      }),
      limit: vi.fn((value: number) => {
        limit = value;
        return query;
      }),
      then: (
        resolve: (value: { data: unknown[]; count: number; error: TableFixture["error"] }) => unknown,
        reject?: (reason: unknown) => unknown
      ) => {
        let rows = fixture.rows;
        if (greaterThanId) {
          rows = rows.filter((row) => String((row as { id?: unknown }).id ?? "") > greaterThanId!);
        }
        if (limit !== null || fixture.maxRows !== undefined) {
          rows = rows.slice(0, Math.min(limit ?? Number.MAX_SAFE_INTEGER, fixture.maxRows ?? Number.MAX_SAFE_INTEGER));
        }
        return Promise.resolve({
          data: rows,
          count: fixture.count ?? fixture.rows.length,
          error: fixture.error ?? null
        }).then(resolve, reject);
      }
    };

    return query;
  });

  const rpc = vi.fn(async (name: string) => ({
    data: rpcFixtures[name]?.data ?? [],
    error: rpcFixtures[name]?.error ?? null
  }));

  return { from, rpc };
}

describe("getStudentPuzzleTrainingOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty overview without a configured service client", async () => {
    mocks.getSupabaseServiceClient.mockReturnValue(null);
    const { emptyPuzzleTrainingOverview } = await import("@/lib/puzzle-training/overview");
    const { getStudentPuzzleTrainingOverview } = await import("@/lib/puzzle-training/overviewServer");

    await expect(getStudentPuzzleTrainingOverview("student-a")).resolves.toEqual(emptyPuzzleTrainingOverview);
    expect(mocks.getSurvivalLeaderboardScores).not.toHaveBeenCalled();
  });

  it("loads complete persisted stats and paginates the attempt history", async () => {
    const attempts = Array.from({ length: 1_001 }, (_, index) => ({
      id: `attempt-${index.toString().padStart(4, "0")}`,
      solved: index % 2 === 0,
      elapsed_seconds: index === 0 ? -10 : "2"
    }));
    const client = createServiceClient({
      student_puzzle_attempts: { rows: attempts, maxRows: 600 },
      student_daily_puzzle_rewards: {
        count: 3,
        rows: [
          { rewarded_at: "2026-08-28T09:00:00.000Z" },
          { rewarded_at: "2026-08-27T09:00:00.000Z" }
        ]
      },
      student_woodpecker_cycle_results: {
        count: 15,
        rows: [
          {
            set_size: "20",
            puzzles_per_minute: "9.4",
            accuracy: "95",
            selected_theme: "fork",
            completed_at: "2026-08-28T08:00:00.000Z",
            cycle_number: "3"
          },
          {
            set_size: 20,
            puzzles_per_minute: 8.1,
            accuracy: 90,
            selected_theme: "pin",
            completed_at: "2026-08-27T08:00:00.000Z",
            cycle_number: null
          }
        ]
      },
      student_woodpecker_set_results: {
        count: 4,
        rows: [{
          set_size: "20",
          cycle_count: "3",
          selected_theme: "fork",
          started_at: "2026-08-27T07:00:00.000Z",
          completed_at: "2026-08-28T08:00:00.000Z"
        }]
      }
    }, {
      get_student_hide_and_seek_overview: {
        data: [{
          attempts: "9",
          personal_best: "948",
          average_found_percent: "84.6",
          average_wrong_count: "1.2",
          average_elapsed_ms: "41500",
          latest_attempt_at: "2026-08-28T05:00:00.000Z"
        }]
      }
    });
    mocks.getSupabaseServiceClient.mockReturnValue(client);
    mocks.getSurvivalLeaderboardScores.mockResolvedValue([
      { studentId: "student-a", theme: "pin", weekScore: 4, monthScore: 8, allTimeScore: 12 },
      { studentId: "student-a", theme: "mixed", weekScore: 7, monthScore: 9, allTimeScore: 13 },
      { studentId: "student-a", theme: "fork", weekScore: 3, monthScore: 6, allTimeScore: 10 },
      { studentId: "student-b", theme: "mixed", weekScore: 50, monthScore: 50, allTimeScore: 50 }
    ]);

    const { getStudentPuzzleTrainingOverview } = await import("@/lib/puzzle-training/overviewServer");
    const overview = await getStudentPuzzleTrainingOverview("student-a");

    expect(overview.overall).toEqual({
      attempts: 1_001,
      solved: 501,
      accuracy: 50,
      elapsedSeconds: 2_000
    });
    expect(overview.daily).toEqual({
      completed: 3,
      xpEarned: 30,
      coinsEarned: 30,
      latestCompletedAt: "2026-08-28T09:00:00.000Z"
    });
    expect(overview.survival).toEqual({ weekScore: 7, monthScore: 9, allTimeScore: 13 });
    expect(overview.survivalByTheme.map((record) => record.theme)).toEqual(["mixed", "fork", "pin"]);
    expect(overview.latestWoodpeckerCycle).toEqual({
      setSize: 20,
      puzzlesPerMinute: 9.4,
      accuracy: 95,
      theme: "fork",
      completedAt: "2026-08-28T08:00:00.000Z",
      cycleNumber: 3
    });
    expect(overview.woodpecker.completedCycles).toBe(15);
    expect(overview.woodpecker.completedSets).toBe(4);
    expect(overview.woodpecker.recentCycles).toHaveLength(2);
    expect(overview.woodpecker.recentSets).toEqual([{
      setSize: 20,
      cycleCount: 3,
      theme: "fork",
      startedAt: "2026-08-27T07:00:00.000Z",
      completedAt: "2026-08-28T08:00:00.000Z"
    }]);
    expect(overview.hideAndSeek).toEqual({
      attempts: 9,
      personalBest: 948,
      averageFoundPercent: 84.6,
      averageWrongCount: 1.2,
      averageElapsedMs: 41_500,
      latestAttemptAt: "2026-08-28T05:00:00.000Z"
    });
    expect(client.rpc).toHaveBeenCalledWith("get_student_hide_and_seek_overview", { p_student_id: "student-a" });
    expect(client.from.mock.calls.filter(([table]) => table === "student_puzzle_attempts")).toHaveLength(2);
  });

  it("uses preloaded Survival scores without another leaderboard request", async () => {
    const client = createServiceClient({
      student_puzzle_attempts: { rows: [] },
      student_daily_puzzle_rewards: { rows: [] },
      student_woodpecker_cycle_results: { rows: [] },
      student_woodpecker_set_results: { rows: [] }
    });
    mocks.getSupabaseServiceClient.mockReturnValue(client);

    const { getStudentPuzzleTrainingOverview } = await import("@/lib/puzzle-training/overviewServer");
    const overview = await getStudentPuzzleTrainingOverview("student-a", [{
      studentId: "student-a",
      theme: "fork",
      weekScore: 2,
      monthScore: 4,
      allTimeScore: 6
    }]);

    expect(mocks.getSurvivalLeaderboardScores).not.toHaveBeenCalled();
    expect(overview.survival).toEqual({ weekScore: 0, monthScore: 0, allTimeScore: 0 });
    expect(overview.survivalByTheme).toEqual([{
      theme: "fork",
      weekScore: 2,
      monthScore: 4,
      allTimeScore: 6
    }]);
  });
});
