import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import { StockfishCancelledError } from "@/chess/engine/StockfishService";
import { analyzeEndgame } from "@/lib/endgames/engine";

class FakeWorker {
  static instances: FakeWorker[] = [];
  static delay = 0;
  static failFirst = false;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  commands: string[] = [];
  constructor() { FakeWorker.instances.push(this); }
  emit(data: string) { if (!this.terminated) this.onmessage?.({ data }); }
  postMessage(command: string) {
    this.commands.push(command);
    if (command === "uci") setTimeout(() => {
      if (FakeWorker.failFirst && FakeWorker.instances[0] === this) this.onerror?.();
      else this.emit("uciok");
    }, FakeWorker.delay);
    if (command === "isready") queueMicrotask(() => this.emit("readyok"));
    if (command.startsWith("go ")) queueMicrotask(() => { this.emit("info depth 14 multipv 1 score cp 800 pv e2e4"); this.emit("bestmove e2e4"); });
  }
  terminate() { this.terminated = true; }
}
const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
beforeEach(() => { vi.useFakeTimers(); FakeWorker.instances = []; FakeWorker.delay = 0; FakeWorker.failFirst = false; vi.stubGlobal("Worker", FakeWorker); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("endgame engine loading", () => {
  it("survives a cold download longer than the old 15-second cutoff and reuses the worker", async () => {
    FakeWorker.delay = 20_000;
    const engine = new AnalysisStockfishService({ multiPv: 1 });
    const result = analyzeEndgame(engine, fen);
    await vi.advanceTimersByTimeAsync(20_001);
    expect((await result)[0].uci).toBe("e2e4");
    const next = analyzeEndgame(engine, fen); await vi.advanceTimersByTimeAsync(1); await next;
    expect(FakeWorker.instances).toHaveLength(1);
    expect(FakeWorker.instances[0].commands).toContain("setoption name MultiPV value 1");
    engine.terminate(); expect(vi.getTimerCount()).toBe(0);
  });
  it("automatically recovers after a failed first worker", async () => {
    FakeWorker.failFirst = true;
    const engine = new AnalysisStockfishService(); const result = analyzeEndgame(engine, fen);
    await vi.advanceTimersByTimeAsync(10);
    expect((await result)[0].uci).toBe("e2e4"); expect(FakeWorker.instances).toHaveLength(2);
    engine.terminate();
  });
  it("cancels startup immediately without retrying or leaving a timer", async () => {
    FakeWorker.delay = 20_000;
    const engine = new AnalysisStockfishService(); const result = analyzeEndgame(engine, fen);
    const rejection = expect(result).rejects.toBeInstanceOf(StockfishCancelledError);
    engine.terminate(); await rejection;
    await vi.advanceTimersByTimeAsync(61_000);
    expect(FakeWorker.instances).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds a stalled startup and provides an error after one automatic retry", async () => {
    FakeWorker.delay = 120_000;
    const engine = new AnalysisStockfishService(); const result = analyzeEndgame(engine, fen);
    const rejection = expect(result).rejects.toThrow("too long to load");
    await vi.advanceTimersByTimeAsync(120_010); await rejection;
    expect(FakeWorker.instances).toHaveLength(2); engine.terminate();
  });
});
