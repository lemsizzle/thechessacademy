import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertNewPuzzleBatch, loadExistingPuzzleIds } from "@/lib/puzzle-training/importDatabase";

function database(pages: Array<{ data: Array<{ lichess_puzzle_id: string }> | null; error: { message: string } | null }>) {
  const query = { select: vi.fn(), not: vi.fn(), order: vi.fn(), limit: vi.fn(), gt: vi.fn(), then: vi.fn() };
  for (const method of [query.select, query.not, query.order, query.limit, query.gt]) method.mockReturnValue(query);
  query.then.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve(pages.shift()).then(resolve));
  return { db: { from: () => query } as unknown as SupabaseClient, query };
}
describe("additive puzzle imports", () => {
  it("retries a network failure with conflict-ignore protection", async () => {
    const upsert = vi.fn().mockResolvedValueOnce({ error: { message: "fetch failed" }, status: 0 })
      .mockResolvedValueOnce({ error: null, count: 1, status: 201 });
    const db = { from: () => ({ upsert }) } as unknown as SupabaseClient;
    const rows = [{ lichess_puzzle_id: "new" }];
    expect(await insertNewPuzzleBatch(db, rows, async () => {})).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(2);
    for (const call of upsert.mock.calls) expect(call).toEqual([rows, { onConflict: "lichess_puzzle_id", ignoreDuplicates: true, count: "exact" }]);
  });
  it("does not retry validation errors", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "invalid row" }, status: 400 });
    await expect(insertNewPuzzleBatch({ from: () => ({ upsert }) } as unknown as SupabaseClient, [], async () => {})).rejects.toThrow("invalid row");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it("loads every ID even if the API caps a page below the requested size", async () => {
    const { db, query } = database([
      { data: [{ lichess_puzzle_id: "aaa" }, { lichess_puzzle_id: "bbb" }], error: null },
      { data: [{ lichess_puzzle_id: "ccc" }], error: null }, { data: [], error: null }
    ]);
    expect([...(await loadExistingPuzzleIds(db))]).toEqual(["aaa", "bbb", "ccc"]);
    expect(query.gt.mock.calls).toEqual([["lichess_puzzle_id", "bbb"], ["lichess_puzzle_id", "ccc"]]);
    expect(query.select).toHaveBeenCalledWith("lichess_puzzle_id");
  });
  it("fails closed when IDs cannot be read", async () => {
    const { db } = database([{ data: null, error: { message: "offline" } }]);
    await expect(loadExistingPuzzleIds(db)).rejects.toThrow("offline");
  });
});
