import { EventEmitter } from "node:events";
import { Chess } from "chess.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), recovery: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("@/chess/bots/recoveryMove", () => ({ chooseBotRecoveryMove: mocks.recovery }));
import { chooseArenaBotMove } from "@/chess/engine/arenaStockfishServer";

beforeEach(() => {
  vi.useFakeTimers();
  mocks.recovery.mockImplementation(() => { throw new Error("Unexpected engine recovery"); });
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe("Arena engine promotion replies", () => {
  it.each(["q", "r", "b", "n"])("preserves the %s promotion suffix for either color without recovery", async suffix => {
    for (const [fen, movePrefix] of [
      ["8/2P5/8/8/8/6b1/5k2/7K w - - 0 1", "c7c8"],
      ["7k/5K2/6B1/8/8/8/2p5/8 b - - 0 1", "c2c1"]
    ]) {
      const chess = new Chess(fen);
      expect(chess.moves({ verbose: true }).map(move => move.lan).sort()).toEqual(
        ["b", "n", "q", "r"].map(promotion => movePrefix + promotion)
      );
      const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stdin: Object.assign(new EventEmitter(), { write: vi.fn() }),
        stderr: { resume: vi.fn() },
        kill: vi.fn()
      });
      mocks.spawn.mockReturnValue(child);
      const pending = chooseArenaBotMove(fen, "queen", { moveHistory: [] });
      const uci = movePrefix + suffix;
      child.stdout.emit("data", Buffer.from(`info depth 12 multipv 1 score cp 600 pv ${uci}\nbestmove ${uci}\n`));

      const move = await pending;
      expect(move).toBe(uci);
      expect(chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }).promotion).toBe(suffix);
      expect(mocks.recovery).not.toHaveBeenCalled();
      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    }
  });
});
