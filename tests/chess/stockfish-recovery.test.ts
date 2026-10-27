import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { StockfishCancelledError, StockfishService } from "@/chess/engine/StockfishService";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { chooseBotRecoveryMove } from "@/chess/bots/recoveryMove";

const fen = new Chess().fen();
const bot = BOT_DIFFICULTIES[2];
const context = { moveHistory: [] };
class Worker {
  static instances: Worker[] = [];
  static mode = "healthy";
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor() { Worker.instances.push(this); }
  emit(data: string) { this.onmessage?.({ data }); }
  postMessage(message: string) {
    if (Worker.mode === "startup-stall") return;
    if (message === "uci") queueMicrotask(() => this.emit("uciok"));
    if (message === "isready") queueMicrotask(() => this.emit("readyok"));
    if (!message.startsWith("go ")) return;
    if (Worker.mode === "post-error") throw new Error("Worker crashed");
    queueMicrotask(() => {
      if (Worker.mode === "crash") return this.onerror?.();
      if (Worker.mode === "partial") this.emit("info depth 6 multipv 1 score cp 25 pv e2e4");
      if (Worker.mode === "healthy") this.emit("bestmove e2e4");
      if (Worker.mode === "invalid") this.emit("bestmove a1a8");
    });
  }
  terminate() { this.terminated = true; }
}
function legal(uci: string) {
  expect(() => new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })).not.toThrow();
  expect(uci).not.toMatch(/^[ah]2[ah][34]$/);
}
beforeEach(() => { vi.useFakeTimers(); Worker.instances = []; Worker.mode = "healthy"; vi.stubGlobal("Worker", Worker); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("computer engine recovery", () => {
  it("bounds silent startup and starts a fresh engine on the next turn", async () => {
    Worker.mode = "startup-stall";
    const service = new StockfishService();
    const result = service.requestMove(fen, bot, context);
    await vi.advanceTimersByTimeAsync(8_000);
    legal(await result);
    expect(Worker.instances[0].terminated).toBe(true);
    Worker.mode = "healthy";
    await expect(service.requestMove(fen, bot, context)).resolves.toBe("e2e4");
    expect(Worker.instances).toHaveLength(2);
    service.terminate();
  });
  it("uses partial legal analysis instead of waiting forever for bestmove", async () => {
    Worker.mode = "partial";
    const service = new StockfishService();
    const result = service.requestMove(fen, bot, context);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(result).resolves.toBe("e2e4");
    expect(Worker.instances[0].terminated).toBe(true);
    service.terminate();
  });
  it.each(["silent", "crash", "post-error", "invalid"])("returns a legal move after %s search failure", async mode => {
    Worker.mode = mode;
    const service = new StockfishService();
    const result = service.requestMove(fen, bot, context);
    await vi.advanceTimersByTimeAsync(4_000);
    legal(await result);
    expect(Worker.instances[0].terminated).toBe(true);
    service.terminate();
  });
  it("cancels startup without playing a recovery move", async () => {
    Worker.mode = "startup-stall";
    const service = new StockfishService();
    const result = service.requestMove(fen, bot, context);
    const cancelled = expect(result).rejects.toBeInstanceOf(StockfishCancelledError);
    service.stop();
    await cancelled;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(Worker.instances).toHaveLength(1);
  });
  it("ignores output from a recycled engine during the next search", async () => {
    Worker.mode = "silent";
    const service = new StockfishService();
    const first = service.requestMove(fen, bot, context);
    await vi.advanceTimersByTimeAsync(4_000);
    await first;
    Worker.mode = "partial";
    const second = service.requestMove(fen, bot, context);
    await vi.advanceTimersByTimeAsync(1);
    Worker.instances[0].emit("bestmove d2d4");
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(second).resolves.toBe("e2e4");
    service.terminate();
  });
  it("never plays a recovery move after canceling an active search", async () => {
    Worker.mode = "silent";
    const service = new StockfishService();
    const request = service.requestMove(fen, bot, context);
    const cancelled = expect(request).rejects.toBeInstanceOf(StockfishCancelledError);
    await vi.advanceTimersByTimeAsync(1);
    service.stop();
    await cancelled;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.getTimerCount()).toBe(0);
    Worker.mode = "healthy";
    await expect(service.requestMove(fen, bot, context)).resolves.toBe("e2e4");
    service.terminate();
  });
  it("does not fabricate a move in a completed position", () => {
    expect(() => chooseBotRecoveryMove("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", bot, context)).toThrow();
  });
});
