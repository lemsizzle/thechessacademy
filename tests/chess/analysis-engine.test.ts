import { afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { AnalysisStockfishService } from "@/chess/engine/AnalysisStockfishService";
import { StockfishCancelledError } from "@/chess/engine/StockfishService";

describe("analysis Stockfish service", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests three principal variations and returns them in rank order", async () => {
    class FakeWorker {
      static latest: FakeWorker;
      messages: string[] = [];
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { FakeWorker.latest = this; }
      postMessage(message: string) {
        this.messages.push(message);
        if (message === "uci") queueMicrotask(() => this.onmessage?.({ data: "uciok" } as MessageEvent));
        if (message === "isready") queueMicrotask(() => this.onmessage?.({ data: "readyok" } as MessageEvent));
        if (message.startsWith("go ")) queueMicrotask(() => {
          this.onmessage?.({ data: "info depth 12 multipv 2 score cp 24 pv d2d4 d7d5" } as MessageEvent);
          this.onmessage?.({ data: "info depth 12 multipv 1 score cp 31 pv e2e4 e7e5" } as MessageEvent);
          this.onmessage?.({ data: "info depth 12 multipv 3 score cp 18 pv g1f3 d7d5" } as MessageEvent);
          this.onmessage?.({ data: "bestmove e2e4" } as MessageEvent);
        });
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", FakeWorker);
    const service = new AnalysisStockfishService();
    await expect(service.analyze(new Chess().fen(), 50)).resolves.toMatchObject([{ rank: 1 }, { rank: 2 }, { rank: 3 }]);
    expect(FakeWorker.latest.messages).toContain("setoption name MultiPV value 3");
    service.terminate();
  });

  it("hard-cancels stale work and terminates its worker", async () => {
    class WaitingWorker {
      static latest: WaitingWorker;
      messages: string[] = [];
      terminated = false;
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { WaitingWorker.latest = this; }
      postMessage(message: string) {
        this.messages.push(message);
        if (message === "uci") queueMicrotask(() => this.onmessage?.({ data: "uciok" } as MessageEvent));
        if (message === "isready") queueMicrotask(() => this.onmessage?.({ data: "readyok" } as MessageEvent));
      }
      terminate() { this.terminated = true; }
    }
    vi.stubGlobal("Worker", WaitingWorker);
    const service = new AnalysisStockfishService();
    const pending = service.analyze(new Chess().fen(), 5000);
    await vi.waitFor(() => expect(WaitingWorker.latest.messages.some((message) => message.startsWith("go "))).toBe(true));
    service.stop();
    await expect(pending).rejects.toBeInstanceOf(StockfishCancelledError);
    expect(WaitingWorker.latest.terminated).toBe(true);
    service.terminate();
  });
});
