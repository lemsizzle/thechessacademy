import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], queries: [] as Record<string, string>[], error: null as null | { message: string } }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: () => {
  const filters: Record<string, string> = {};
  db.queries.push(filters);
  const query = {
    select: () => query,
    eq: (key: string, value: string) => { filters[key] = value; return query; },
    maybeSingle: async () => ({ data: db.rows.find(row => Object.entries(filters).every(([key, value]) => row[key] === value)) ?? null, error: db.error })
  };
  return query;
} }) }));
import { getCompletedGame } from "@/chess/persistence/studyServer";
const student = { kind: "student" as const, studentId: "a", name: "Student" };
beforeEach(() => {
  db.rows = [
    { id: "replay-a", player_id: "a", source_live_game_id: "match", player_color: "white" },
    { id: "replay-b", player_id: "b", source_live_game_id: "match", player_color: "black" }
  ];
  db.queries = [];
  db.error = null;
});
describe("completed game lookup", () => {
  it("opens history IDs directly without an extra query", async () => {
    expect(await getCompletedGame(student, "replay-a")).toMatchObject({ id: "replay-a", playerId: "a" });
    expect(db.queries).toHaveLength(1);
  });
  it("resolves a live match to the requesting student's saved perspective", async () => {
    expect(await getCompletedGame(student, "match")).toMatchObject({ id: "replay-a", playerColor: "white" });
    expect(await getCompletedGame({ ...student, studentId: "b" }, "match")).toMatchObject({ id: "replay-b", playerColor: "black" });
    expect(db.queries[1]).toEqual({source_live_game_id:"match",player_id:"a"});
  });
  it("does not expose a replay by another student's saved ID", async () => {
    await expect(getCompletedGame(student, "replay-b")).rejects.toThrow("Completed game not found");
  });
  it("does not expose either perspective to a student outside the match", async () => {
    await expect(getCompletedGame({ ...student, studentId: "outsider" }, "match")).rejects.toThrow("Completed game not found");
  });
  it("keeps teacher reads explicit and does not choose an arbitrary perspective", async () => {
    expect(await getCompletedGame({kind:"admin"}, "replay-b")).toMatchObject({id:"replay-b"});
    await expect(getCompletedGame({kind:"admin"}, "match")).rejects.toThrow("Completed game not found");
  });
  it("does not fall back after database errors", async () => {
    db.error = {message:"Database unavailable"};
    await expect(getCompletedGame(student, "match")).rejects.toThrow("Database unavailable");
    expect(db.queries).toHaveLength(1);
  });
});
