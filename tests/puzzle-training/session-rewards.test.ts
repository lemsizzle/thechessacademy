import { describe, expect, it, vi } from "vitest";
import { applyTrainingReceipt, createTrainingRewardStore, emptyTrainingTally, restoreTrainingTally } from "@/lib/puzzle-training/sessionRewards";

describe("running training reward tally", () => {
  it("adds separate puzzles, badges, daily, endgames and search rounds; cumulative Star Wars receipts only add the difference", () => {
    let tally = emptyTrainingTally();
    for (const receipt of [
      { id: "puzzle:run:a", xp: 2, coins: 2 }, { id: "puzzle:run:b", xp: 2, coins: 2 },
      { id: "badge:bronze", xp: 0, coins: 20 }, { id: "daily:2026-11-19", xp: 10, coins: 10 },
      { id: "endgame:one", xp: 3, coins: 3 }, { id: "endgame:two", xp: 3, coins: 3 },
      { id: "hide:one", xp: 10, coins: 10 }, { id: "hide:two", xp: 10, coins: 10 },
      { id: "star:run", xp: 3, coins: 3 }, { id: "star:run", xp: 9, coins: 9 },
      { id: "star:run", xp: 6, coins: 6 }, { id: "star:run", xp: 9, coins: 9 }
    ]) tally = applyTrainingReceipt(tally, receipt);
    expect(tally).toMatchObject({ xp: 49, coins: 69 });
    expect(applyTrainingReceipt(tally, { id: "endgame:one", xp: 3, coins: 3 })).toBe(tally);
  });

  it("restores across reloads, isolates students and resets totals without recounting an existing run", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const store = createTrainingRewardStore("student-a", storage);
    store.record({ id: "star:run", xp: 6, coins: 6 });
    const restored = createTrainingRewardStore("student-a", storage);
    expect(restored.getSnapshot().xp).toBe(6);
    expect(createTrainingRewardStore("student-b", storage).getSnapshot().xp).toBe(0);
    restored.reset();
    restored.record({ id: "star:run", xp: 6, coins: 6 });
    expect(restored.getSnapshot().xp).toBe(0);
    restored.record({ id: "star:run", xp: 9, coins: 9 });
    expect(restored.getSnapshot()).toMatchObject({ xp: 3, coins: 3 });
    expect(createTrainingRewardStore("student-a", storage).getSnapshot().xp).toBe(3);
  });

  it("does not interrupt play when storage is restricted or full", () => {
    const store = createTrainingRewardStore("a", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } });
    const changed = vi.fn(); const unsubscribe = store.subscribe(changed);
    store.record({ id: "endgame:a", xp: 3, coins: 3 });
    store.record({ id: "endgame:a", xp: 3, coins: 3 });
    expect(store.getSnapshot().xp).toBe(3);
    expect(changed).toHaveBeenCalledOnce(); unsubscribe();
  });

  it("rejects malformed local data and invalid or negative payouts", () => {
    for (const raw of ["broken", "null", '{"xp":10}', '{"xp":-1,"coins":0,"receipts":{}}']) expect(restoreTrainingTally(raw)).toEqual(emptyTrainingTally());
    const empty = emptyTrainingTally();
    for (const xp of [NaN, Infinity, -1, 0.5]) expect(applyTrainingReceipt(empty, { id: "x", xp, coins: 3 })).toBe(empty);
    expect(applyTrainingReceipt(empty, { id: "helped", xp: 0, coins: 0 })).toBe(empty);
  });
});
