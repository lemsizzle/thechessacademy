import { parseStockfishInfo, StockfishCancelledError } from "@/chess/engine/StockfishService";
import type { StockfishCandidate } from "@/chess/types";
import { Chess } from "chess.js";

const WORKER_URL = "/vendor/stockfish/stockfish-18-lite-single.js";

type Pending = {
  resolve: (lines: StockfishCandidate[]) => void;
  reject: (error: Error) => void;
  candidates: Map<number, StockfishCandidate>;
  timeout: ReturnType<typeof setTimeout>;
};

export class AnalysisStockfishService {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((error: Error) => void) | null = null;
  private pending: Pending | null = null;
  private uciOk = false;
  private terminated = false;

  private async ready() {
    if (this.terminated) throw new Error("Analysis engine has been terminated.");
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    try {
      this.worker = new Worker(WORKER_URL);
      this.worker.onmessage = (event: MessageEvent<unknown>) => {
        for (const line of String(event.data ?? "").split(/\r?\n/)) this.handleLine(line.trim());
      };
      this.worker.onerror = () => this.fail(new Error("Stockfish analysis could not be loaded."));
      this.worker.postMessage("uci");
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error("Stockfish analysis could not be loaded."));
    }
    return this.readyPromise;
  }

  private handleLine(line: string) {
    if (line === "uciok") {
      this.uciOk = true;
      this.worker?.postMessage("isready");
      return;
    }
    if (line === "readyok" && this.uciOk) {
      this.readyResolve?.();
      this.readyResolve = null;
      this.readyReject = null;
      return;
    }
    if (this.pending) {
      const candidate = parseStockfishInfo(line);
      if (candidate) {
        const previous = this.pending.candidates.get(candidate.rank);
        if (!previous || candidate.depth >= previous.depth) this.pending.candidates.set(candidate.rank, candidate);
      }
    }
    if (!line.startsWith("bestmove ") || !this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timeout);
    const lines = [...pending.candidates.values()].sort((a, b) => a.rank - b.rank).slice(0, 3);
    if (!lines.length) pending.reject(new Error("Stockfish returned no analysis lines."));
    else pending.resolve(lines);
  }

  async analyze(fen: string, movetime = 900) {
    this.stop();
    const position = new Chess(fen);
    if (position.isGameOver()) return [];
    await this.ready();
    const worker = this.worker;
    if (!worker) throw new Error("Stockfish analysis is unavailable.");
    worker.postMessage("setoption name Skill Level value 20");
    worker.postMessage("setoption name UCI_LimitStrength value false");
    worker.postMessage("setoption name MultiPV value 3");
    return new Promise<StockfishCandidate[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending) return;
        this.pending = null;
        reject(new Error("Stockfish analysis timed out."));
        this.recycle();
      }, Math.max(10_000, movetime + 6_000));
      this.pending = { resolve, reject, candidates: new Map(), timeout };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${movetime}`);
    });
  }

  stop() {
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(new StockfishCancelledError());
      this.pending = null;
      this.recycle();
    }
  }

  private fail(error: Error) {
    this.readyReject?.(error);
    this.readyResolve = null;
    this.readyReject = null;
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(error);
      this.pending = null;
    }
    this.recycle();
  }

  private recycle() {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.readyResolve = null;
    this.readyReject = null;
    this.uciOk = false;
  }

  terminate() {
    this.terminated = true;
    this.stop();
    this.recycle();
  }
}
