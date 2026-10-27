import { EventEmitter } from "node:events";
import { Chess } from "chess.js";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
import { chooseArenaBotMove } from "@/chess/engine/arenaStockfishServer";

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe("tournament engine recovery", () => {
  it.each(["timeout", "partial", "exit", "error"])("finishes a claimed turn after engine %s", async mode => {
    vi.useFakeTimers();
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stdin: Object.assign(new EventEmitter(), { write: vi.fn() }),
      stderr: { resume: vi.fn() },
      kill: vi.fn()
    });
    mocks.spawn.mockReturnValue(child);
    const fen = new Chess().fen();
    const pending = chooseArenaBotMove(fen, "knight", { moveHistory: [] });
    if (mode === "partial") child.stdout.emit("data", Buffer.from("info depth 4 multipv 1 score cp 20 pv e2e4\n"));
    if (mode === "exit") child.emit("exit", 1);
    if (mode === "error") child.emit("error", new Error("Spawn failed"));
    await vi.advanceTimersByTimeAsync(10_000);
    const move = await pending;
    expect(() => new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })).not.toThrow();
    if (mode === "partial") expect(move).toBe("e2e4");
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
