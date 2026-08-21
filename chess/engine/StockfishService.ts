import { selectHumanLikeMove } from "@/chess/bots/humanMoveSelector";
import type { BotDifficulty, BotMoveContext, StockfishCandidate } from "@/chess/types";

const STOCKFISH_WORKER_URL = "/vendor/stockfish/stockfish-18-lite-single.js";

export class StockfishCancelledError extends Error {
  constructor() {
    super("Stockfish request cancelled.");
    this.name = "StockfishCancelledError";
  }
}

type PendingAnalysis = {
  resolve: (move: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  fen: string;
  difficulty: BotDifficulty;
  context: BotMoveContext;
  candidates: Map<number, StockfishCandidate>;
};

export function parseStockfishInfo(line: string): StockfishCandidate | null {
  if (!line.startsWith("info ") || !line.includes(" pv ") || !line.includes(" score ")) return null;
  const tokens = line.trim().split(/\s+/);
  const valueAfter = (name: string) => {
    const index = tokens.indexOf(name);
    return index >= 0 ? tokens[index + 1] : undefined;
  };
  const pvIndex = tokens.indexOf("pv");
  const scoreIndex = tokens.indexOf("score");
  const scoreType = tokens[scoreIndex + 1];
  const scoreValue = Number(tokens[scoreIndex + 2]);
  const rank = Number(valueAfter("multipv") ?? 1);
  const depth = Number(valueAfter("depth") ?? 0);
  const pv = tokens.slice(pvIndex + 1);
  const uci = pv[0];
  if (!uci || !/^([a-h][1-8]){2}[qrbn]?$/.test(uci) || !Number.isFinite(scoreValue) || !Number.isFinite(rank)) return null;

  return {
    uci,
    rank,
    depth: Number.isFinite(depth) ? depth : 0,
    scoreCp: scoreType === "cp" ? scoreValue : null,
    mate: scoreType === "mate" ? scoreValue : null,
    pv,
    bound: tokens.includes("lowerbound") ? "lower" : tokens.includes("upperbound") ? "upper" : undefined
  };
}

export class StockfishService {
  private worker: Worker | null = null;
  private initializePromise: Promise<void> | null = null;
  private initializeResolve: (() => void) | null = null;
  private initializeReject: ((error: Error) => void) | null = null;
  private sawUciOk = false;
  private pendingAnalysis: PendingAnalysis | null = null;
  private permanentlyTerminated = false;

  async initialize() {
    if (this.permanentlyTerminated) throw new Error("Stockfish service has been terminated.");
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = new Promise<void>((resolve, reject) => {
      this.initializeResolve = resolve;
      this.initializeReject = reject;
    });

    try {
      const worker = new Worker(STOCKFISH_WORKER_URL);
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<unknown>) => this.handleMessage(String(event.data ?? ""));
      worker.onerror = () => this.failWorker(new Error("The computer opponent could not be loaded."));
      worker.postMessage("uci");
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new Error("The computer opponent could not be loaded."));
    }

    return this.initializePromise;
  }

  private handleMessage(payload: string) {
    for (const line of payload.split(/\r?\n/)) this.handleLine(line.trim());
  }

  private handleLine(line: string) {
    if (line === "uciok") {
      this.sawUciOk = true;
      this.worker?.postMessage("isready");
      return;
    }
    if (line === "readyok" && this.sawUciOk) {
      this.initializeResolve?.();
      this.initializeResolve = null;
      this.initializeReject = null;
      return;
    }

    if (this.pendingAnalysis) {
      const candidate = parseStockfishInfo(line);
      if (candidate) {
        const previous = this.pendingAnalysis.candidates.get(candidate.rank);
        if (!previous || candidate.depth >= previous.depth) this.pendingAnalysis.candidates.set(candidate.rank, candidate);
        return;
      }
    }

    if (!line.startsWith("bestmove ") || !this.pendingAnalysis) return;
    const pending = this.pendingAnalysis;
    this.pendingAnalysis = null;
    clearTimeout(pending.timeout);
    const bestMove = line.split(/\s+/)[1];
    if (!bestMove || bestMove === "(none)") {
      pending.reject(new Error("Stockfish did not return a legal move."));
      return;
    }

    const candidates = [...pending.candidates.values()].sort((left, right) => left.rank - right.rank);
    if (!candidates.some((candidate) => candidate.uci === bestMove)) {
      candidates.unshift({ uci: bestMove, rank: 1, depth: 0, scoreCp: null, mate: null, pv: [bestMove] });
    }
    try {
      pending.resolve(selectHumanLikeMove({
        fen: pending.fen,
        candidates,
        bot: pending.difficulty,
        context: pending.context
      }));
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error("The computer could not choose a move."));
    }
  }

  private failWorker(error: Error) {
    this.initializeReject?.(error);
    this.initializeReject = null;
    this.initializeResolve = null;
    if (this.pendingAnalysis) {
      clearTimeout(this.pendingAnalysis.timeout);
      this.pendingAnalysis.reject(error);
      this.pendingAnalysis = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.initializePromise = null;
    this.sawUciOk = false;
  }

  private async configureAnalysis(difficulty: BotDifficulty) {
    await this.initialize();
    const worker = this.worker;
    if (!worker) throw new Error("Stockfish is not available.");
    worker.postMessage("setoption name Skill Level value 20");
    worker.postMessage("setoption name UCI_LimitStrength value false");
    worker.postMessage(`setoption name MultiPV value ${difficulty.multiPv}`);
  }

  async requestMove(fen: string, difficulty: BotDifficulty, context: BotMoveContext = { moveHistory: [] }) {
    if (this.pendingAnalysis) this.stop();
    await this.configureAnalysis(difficulty);
    const worker = this.worker;
    if (!worker) throw new Error("Stockfish is not available.");

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pendingAnalysis) return;
        this.pendingAnalysis = null;
        reject(new Error("The computer opponent took too long to respond."));
        this.recycleWorker();
      }, Math.max(12_000, difficulty.thinkTimeMs + 8_000));
      this.pendingAnalysis = {
        resolve,
        reject,
        timeout,
        fen,
        difficulty,
        context,
        candidates: new Map()
      };
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go movetime ${difficulty.thinkTimeMs}`);
    });
  }

  /**
   * Cancelling a live search recycles the worker. This is intentionally hard:
   * late analysis or bestmove output cannot leak into a takeback or new game.
   */
  stop() {
    if (this.pendingAnalysis) {
      clearTimeout(this.pendingAnalysis.timeout);
      this.pendingAnalysis.reject(new StockfishCancelledError());
      this.pendingAnalysis = null;
    }
    this.recycleWorker();
  }

  private recycleWorker() {
    this.worker?.postMessage("quit");
    this.worker?.terminate();
    this.worker = null;
    this.initializePromise = null;
    this.initializeResolve = null;
    this.initializeReject = null;
    this.sawUciOk = false;
  }

  terminate() {
    this.permanentlyTerminated = true;
    this.stop();
  }
}
