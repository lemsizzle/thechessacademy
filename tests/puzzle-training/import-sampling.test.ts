import { describe, expect, it } from "vitest";
import {
  BoundedIdTracker,
  considerForReservoir,
  emptyReservoirs,
  emptyThemeCounts,
  finalizeReservoirs,
  quotasComplete,
  tryAddFast,
  type ImportCandidate
} from "../../lib/puzzle-training/importSampling";

function candidate(id: string, themes: string[]): ImportCandidate {
  return { lichess_puzzle_id: id, themes };
}

describe("fast puzzle selection", () => {
  it("stores an overlapping puzzle once and counts each matching theme", () => {
    const selected = new Map<string, ImportCandidate>();
    const counts = emptyThemeCounts();
    expect(tryAddFast(candidate("one", ["fork", "pin"]), selected, counts, 2)).toBe(true);
    expect(selected.size).toBe(1);
    expect(counts).toMatchObject({ fork: 1, pin: 1 });
  });

  it("does not exceed any theme cap or add duplicate IDs", () => {
    const selected = new Map<string, ImportCandidate>();
    const counts = emptyThemeCounts();
    expect(tryAddFast(candidate("one", ["fork"]), selected, counts, 1)).toBe(true);
    expect(tryAddFast(candidate("one", ["fork"]), selected, counts, 1)).toBe(false);
    expect(tryAddFast(candidate("two", ["fork", "pin"]), selected, counts, 1)).toBe(false);
    expect(counts.fork).toBe(1);
    expect(counts.pin).toBe(0);
  });
});

describe("bounded reservoir sampling", () => {
  it("keeps each theme reservoir bounded while scanning more candidates", () => {
    const reservoirs = emptyReservoirs<ImportCandidate>();
    const qualifying = emptyThemeCounts();
    for (let index = 0; index < 20; index += 1) {
      considerForReservoir(candidate(`fork-${index}`, ["fork"]), reservoirs, qualifying, 3, () => 0.25);
    }
    expect(reservoirs.fork).toHaveLength(3);
    expect(qualifying.fork).toBe(20);
  });

  it("unifies overlapping reservoirs without exceeding theme targets", () => {
    const reservoirs = emptyReservoirs<ImportCandidate>();
    const qualifying = emptyThemeCounts();
    const rows = [
      candidate("overlap", ["fork", "pin"]),
      candidate("fork", ["fork"]),
      candidate("pin", ["pin"]),
      candidate("skewer-1", ["skewer"]),
      candidate("skewer-2", ["skewer"]),
      candidate("mate-1", ["mateIn1"]),
      candidate("mate-2", ["mateIn1"])
    ];
    for (const row of rows) considerForReservoir(row, reservoirs, qualifying, 2, () => 0.99);
    const result = finalizeReservoirs(reservoirs, 2, () => 0.99);
    expect(result.selected.size).toBeLessThanOrEqual(8);
    expect(Object.values(result.counts).every((count) => count <= 2)).toBe(true);
    expect(quotasComplete(result.counts, 2)).toBe(true);
  });
});

describe("bounded source duplicate tracking", () => {
  it("recognizes a repeated ID without growing with the source file", () => {
    const tracker = new BoundedIdTracker(8192, 3);
    expect(tracker.hasAndAdd("puzzle-one")).toBe(false);
    expect(tracker.hasAndAdd("puzzle-two")).toBe(false);
    expect(tracker.hasAndAdd("puzzle-one")).toBe(true);
  });
});
