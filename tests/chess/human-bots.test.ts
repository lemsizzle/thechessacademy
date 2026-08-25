import { afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { adjustedErrorBandWeights, estimatePositionComplexity, scoreHumanCandidates, selectHumanLikeMove } from "@/chess/bots/humanMoveSelector";
import { parseStockfishInfo, StockfishService } from "@/chess/engine/StockfishService";
import { BOT_DIFFICULTIES } from "@/chess/game/config";
import { SIR_LEM_SOURCE } from "@/chess/bots/sirLemOpeningBook";
import type { StockfishCandidate } from "@/chess/types";

function bot(id: string) {
  const profile = BOT_DIFFICULTIES.find((item) => item.id === id);
  if (!profile) throw new Error(`Missing bot ${id}`);
  return profile;
}

function candidate(uci: string, rank: number, scoreCp: number): StockfishCandidate {
  return { uci, rank, depth: 10, scoreCp, mate: null, pv: [uci] };
}

function sequenceRandom(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function playUci(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) });
}

describe("Stockfish MultiPV parsing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("collects centipawn score, rank, depth, bound, and principal variation", () => {
    expect(parseStockfishInfo("info depth 11 seldepth 12 multipv 2 score cp 33 upperbound nodes 82286 pv e2e3 e7e5")).toEqual({
      uci: "e2e3",
      rank: 2,
      depth: 11,
      scoreCp: 33,
      mate: null,
      pv: ["e2e3", "e7e5"],
      bound: "upper"
    });
  });

  it("parses mate scores and ignores non-analysis lines", () => {
    expect(parseStockfishInfo("info depth 8 multipv 1 score mate 3 nodes 500 pv h5f7 e8e7")).toMatchObject({
      uci: "h5f7",
      mate: 3,
      scoreCp: null
    });
    expect(parseStockfishInfo("info string NNUE evaluation loaded")).toBeNull();
    expect(parseStockfishInfo("bestmove e2e4 ponder e7e5")).toBeNull();
  });

  it("configures full-strength analysis and lets the human layer choose the move", async () => {
    class FakeWorker {
      static latest: FakeWorker;
      messages: string[] = [];
      onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        FakeWorker.latest = this;
      }

      postMessage(message: string) {
        this.messages.push(message);
        if (message === "uci") queueMicrotask(() => this.onmessage?.({ data: "uciok" } as MessageEvent));
        if (message === "isready") queueMicrotask(() => this.onmessage?.({ data: "readyok" } as MessageEvent));
        if (message.startsWith("go ")) queueMicrotask(() => {
          this.onmessage?.({ data: "info depth 8 multipv 1 score cp 30 nodes 100 pv e2e4 e7e5" } as MessageEvent);
          this.onmessage?.({ data: "bestmove e2e4 ponder e7e5" } as MessageEvent);
        });
      }

      terminate() {}
    }

    vi.stubGlobal("Worker", FakeWorker);
    const service = new StockfishService();
    await expect(service.requestMove(new Chess().fen(), bot("pawny"))).resolves.toBe("e2e4");
    expect(FakeWorker.latest.messages).toContain("setoption name Skill Level value 20");
    expect(FakeWorker.latest.messages).toContain("setoption name UCI_LimitStrength value false");
    expect(FakeWorker.latest.messages).toContain("setoption name MultiPV value 10");
    service.terminate();
  });
});

describe("human-like computer profiles", () => {
  it("defines academy personalities and the Sir Lem mirror backed by 5-10 analysis lines", () => {
    expect(BOT_DIFFICULTIES.map((profile) => profile.name)).toEqual([
      "Pawny", "Zippy Knight", "Benny Bishop", "Rocky Rook", "Quinn Queen", "Sir Lem"
    ]);
    expect(BOT_DIFFICULTIES.every((profile) => profile.multiPv >= 5 && profile.multiPv <= 10)).toBe(true);
    expect(BOT_DIFFICULTIES.map((profile) => profile.estimatedRating)).toEqual([375, 575, 775, 975, 1225, 1600]);
    expect(BOT_DIFFICULTIES.map((profile) => profile.portrait)).toEqual([
      "/bots/pawny.png",
      "/bots/zippy-knight.png",
      "/bots/benny-bishop.png",
      "/bots/rocky-rook.png",
      "/bots/quinn-queen.png",
      "/bots/sir-lem.png"
    ]);
  });

  it("gives the Sir Lem mirror its expanded e4 and Pirc opening preferences", () => {
    const opening = scoreHumanCandidates(new Chess().fen(), [candidate("e2e4", 1, 0), candidate("g1f3", 2, 0)], bot("so-pawny"));
    const afterE4 = new Chess();
    afterE4.move("e4");
    const pirc = scoreHumanCandidates(afterE4.fen(), [candidate("d7d6", 1, 0), candidate("e7e5", 2, 0)], bot("so-pawny"), { moveHistory: ["e2e4"] });
    const score = (list: typeof opening, uci: string) => list.find((item) => item.candidate.uci === uci)?.totalScore ?? -Infinity;
    expect(score(opening, "e2e4")).toBeGreaterThan(score(opening, "g1f3"));
    expect(score(pirc, "d7d6")).toBeGreaterThan(score(pirc, "e7e5"));
  });

  it("builds Sir Lem from the expanded public game archive", () => {
    expect(SIR_LEM_SOURCE.username).toBe("So_Pawny");
    expect(SIR_LEM_SOURCE.games).toBeGreaterThan(3_000);
    expect(SIR_LEM_SOURCE.openingPositions).toBeGreaterThanOrEqual(500);
    expect(bot("so-pawny").openingBook).toHaveLength(SIR_LEM_SOURCE.openingPositions);
  });

  it("keeps every Sir Lem opening-book continuation legal", () => {
    for (const rule of bot("so-pawny").openingBook ?? []) {
      const chess = new Chess();
      for (const move of rule.after) expect(() => playUci(chess, move)).not.toThrow();
      for (const choice of rule.moves) {
        const position = new Chess(chess.fen());
        expect(() => playUci(position, choice.uci)).not.toThrow();
      }
    }
  });

  it("makes Pawny favor beginner pawn habits while Benny favors development", () => {
    const fen = new Chess().fen();
    const choices = [candidate("g1f3", 1, 0), candidate("a2a3", 2, 0)];
    const pawnyScores = scoreHumanCandidates(fen, choices, bot("pawny"));
    const bennyScores = scoreHumanCandidates(fen, choices, bot("bishop"));
    const score = (list: typeof pawnyScores, uci: string) => list.find((item) => item.candidate.uci === uci)?.totalScore ?? -Infinity;
    expect(score(pawnyScores, "a2a3")).toBeGreaterThan(score(pawnyScores, "g1f3"));
    expect(score(bennyScores, "g1f3")).toBeGreaterThan(score(bennyScores, "a2a3"));
  });

  it("gives Zippy a strong preference for a plausible check", () => {
    const fen = "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1";
    const move = selectHumanLikeMove({
      fen,
      candidates: [candidate("e2a2", 1, 0), candidate("e2b5", 2, 0)],
      bot: bot("knight"),
      random: sequenceRandom(0, 0.99)
    });
    expect(move).toBe("e2b5");
  });

  it("separates Zippy's attack bias from Rocky's defensive personality", () => {
    const fen = "4k3/8/8/8/1p6/2N5/8/3QK3 w - - 0 1";
    const choices = [candidate("d1h5", 1, 0), candidate("c3b5", 2, 0)];
    const zippy = scoreHumanCandidates(fen, choices, bot("knight"));
    const rocky = scoreHumanCandidates(fen, choices, bot("rook"));
    const score = (list: typeof zippy, uci: string) => list.find((item) => item.candidate.uci === uci)?.totalScore ?? -Infinity;
    expect(score(zippy, "d1h5")).toBeGreaterThan(score(zippy, "c3b5"));
    expect(score(rocky, "c3b5")).toBeGreaterThan(score(rocky, "d1h5"));
  });

  it("filters an unforced king wander when reasonable candidates exist", () => {
    const fen = "4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1";
    const move = selectHumanLikeMove({
      fen,
      candidates: [candidate("e1d1", 1, 0), candidate("e2a2", 2, 0), candidate("e2b5", 3, 0)],
      bot: bot("pawny"),
      random: sequenceRandom(0, 0)
    });
    expect(move).not.toBe("e1d1");
  });

  it("uses configurable centipawn-loss bands instead of always taking the best move", () => {
    const fen = new Chess().fen();
    const choices = [candidate("e2e4", 1, 100), candidate("g1f3", 2, 60), candidate("a2a3", 3, 0)];
    expect(selectHumanLikeMove({ fen, candidates: choices, bot: bot("queen"), random: sequenceRandom(0, 0) })).toBe("e2e4");
    expect(selectHumanLikeMove({ fen, candidates: choices, bot: bot("pawny"), random: sequenceRandom(0.3, 0) })).toBe("a2a3");
  });

  it("raises larger-error likelihood more for Pawny when a position is complex", () => {
    const quiet = estimatePositionComplexity(new Chess().fen());
    const tactical = estimatePositionComplexity("4k3/8/8/3q4/3Q4/8/8/4K3 w - - 0 1");
    expect(tactical).toBeGreaterThan(quiet);

    const pawny = bot("pawny");
    const quinn = bot("queen");
    const pawnyWeights = adjustedErrorBandWeights(pawny, tactical);
    const quinnWeights = adjustedErrorBandWeights(quinn, tactical);
    const pawnyLargeErrorGrowth = pawnyWeights.at(-1)! / pawny.errorBands.at(-1)!.weight;
    const quinnLargeErrorGrowth = quinnWeights.at(-1)! / quinn.errorBands.at(-1)!.weight;
    expect(pawnyLargeErrorGrowth).toBeGreaterThan(quinnLargeErrorGrowth);
    expect(pawnyLargeErrorGrowth).toBeGreaterThan(1);
  });
});
