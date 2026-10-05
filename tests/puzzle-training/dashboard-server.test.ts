import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseDashboardQuery } from "@/lib/puzzle-training/dashboard";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
import { getPuzzleDashboard, hasPuzzleHistory, savePuzzleReplay } from "@/lib/puzzle-training/dashboardServer";

const student = "20000000-0000-4000-8000-000000000002";
const puzzle = "30000000-0000-4000-8000-000000000003";
function database(errorTable = "", code = "XX001") {
  const selects: string[] = [];
  const scopes: unknown[][] = [];
  const writes: unknown[] = [];
  const pages: unknown[] = [];
  const attempts = Array.from({ length: 5 }, (_, index) => ({ id: String(index), puzzle_id: index === 0 ? puzzle : `p${index}`,
    attempted_at: "2026-10-04T10:00:00Z", solved: true, first_try_correct: index !== 0, incorrect_move_count: index === 0 ? 1 : 0,
    hints_used: 0, elapsed_seconds: 20, training_mode: "survival", chess_puzzles: { rating: 1200, themes: ["fork"], opening_tags: [], is_active: true } }));
  const db = { from: vi.fn((table: string) => {
    let cursor = "";
    let limit = 500;
    const filters: Record<string, unknown> = {};
    const query = {
      select: vi.fn((fields: string) => { selects.push(fields); return query; }),
      eq: vi.fn((field: string, value: unknown) => { scopes.push([table, field, value]); filters[field] = value; return query; }),
      gt: vi.fn((field: string, value: string) => { cursor = value; pages.push([field, value]); return query; }),
      gte: vi.fn(() => query), lte: vi.fn(() => query), order: vi.fn(() => query),
      limit: vi.fn((value: number) => { limit = value; return query; }),
      upsert: vi.fn((...args: unknown[]) => { writes.push(args); return query; }),
      then: (resolve: (value: unknown) => unknown) => {
        const rows = table === "student_puzzle_attempts" ? attempts.filter(row => (!cursor || row.id > cursor) && (!filters.puzzle_id || row.puzzle_id === filters.puzzle_id)).slice(0, Math.min(limit, 2)) : [];
        return Promise.resolve({ data: rows, error: table === errorTable ? { code, message: "private error" } : null }).then(resolve);
      }
    };
    return query;
  }) };
  mocks.client.mockReturnValue(db);
  return { db, scopes, selects, pages, writes };
}

describe("dashboard data access", () => {
  beforeEach(() => vi.resetAllMocks());
  it("loads past the API row cap, always scopes reads, and never selects answers", async () => {
    const evidence = database();
    const data = await getPuzzleDashboard(student, parseDashboardQuery({}), Date.parse("2026-10-05T10:00:00Z"));
    expect(data.played).toBe(5);
    expect(data.toReplay).toBe(1);
    expect(evidence.pages.length).toBeGreaterThan(1);
    expect(evidence.scopes.filter((scope) => scope[1] === "student_id")).toHaveLength(5);
    expect(evidence.scopes.every((scope) => scope[2] === student)).toBe(true);
    expect(evidence.selects.join(" ")).not.toMatch(/initial_fen|accepted_moves|game_url|\*/);
    expect(data.history[0]).not.toHaveProperty("chess_puzzles");
  });
  it("degrades safely before migration but does not hide unrelated database failures", async () => {
    database("student_puzzle_replays", "42P01");
    expect((await getPuzzleDashboard(student, parseDashboardQuery({ period: "all" }))).replayAvailable).toBe(false);
    database("student_puzzle_replays");
    await expect(getPuzzleDashboard(student, parseDashboardQuery({}))).rejects.toThrow("Could not load your replay progress");
    database("student_puzzle_attempts");
    await expect(getPuzzleDashboard(student, parseDashboardQuery({}))).rejects.toThrow("Could not load your puzzle results");
  });
  it("validates history identifiers before hitting the database", async () => {
    const evidence = database();
    expect(await hasPuzzleHistory(student, "bad-id")).toBe(false);
    expect(evidence.db.from).not.toHaveBeenCalled();
    expect(await hasPuzzleHistory(student, puzzle)).toBe(true);
    expect(evidence.scopes).toContainEqual(["student_puzzle_attempts", "student_id", student]);
  });
  it("upserts only the practice marker, never normal attempts or rewards", async () => {
    const evidence = database();
    await savePuzzleReplay(student, puzzle);
    expect(evidence.db.from).toHaveBeenCalledExactlyOnceWith("student_puzzle_replays");
    expect(evidence.writes).toEqual([[{ student_id: student, puzzle_id: puzzle, cleared_at: expect.any(String) }, { onConflict: "student_id,puzzle_id" }]]);
  });
});
