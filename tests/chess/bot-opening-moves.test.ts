import { afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { openingMoveChoices } from "@/chess/bots/openingMoves";
import { selectHumanLikeMove } from "@/chess/bots/humanMoveSelector";
import { repertoirePositionKey, selectRepertoireMove } from "@/chess/bots/repertoire";
import { StockfishService } from "@/chess/engine/StockfishService";
import { chooseArenaBotMove } from "@/chess/engine/arenaStockfishServer";

const position = (...moves: string[]) => {
  const chess = new Chess();
  moves.forEach(move => chess.move(move));
  return chess;
};
const openings = [position(), position("e4"), position("e4", "e5"), position("e4", "e5", "Nf3")];
const intermediate = BOT_DIFFICULTIES.find(bot => bot.id === "rook")!;

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("bot opening discipline", () => {
  it.each([0, 1, 2, 3])("filters both edge files on opening ply %i for every bot above 500", index => {
    const chess = openings[index];
    const rank = chess.turn() === "w" ? "2" : "7";
    for (const bot of BOT_DIFFICULTIES.filter(bot => bot.estimatedRating > 500)) {
      const choices = openingMoveChoices(chess.fen(), bot)!;
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.every(move => !move.startsWith(`a${rank}`) && !move.startsWith(`h${rank}`))).toBe(true);
      // Even a top-ranked edge push or a sampled large-error band cannot bypass it.
      const edge = chess.turn() === "w" ? "a2a3" : "h7h5";
      const candidates = [edge, choices[0]].map((uci, rank) => ({ uci, rank: rank + 1, depth: 8, scoreCp: rank ? -500 : 100, mate: null, pv: [uci] }));
      expect(selectHumanLikeMove({ fen: chess.fen(), bot, candidates, random: () => 0.99 })).toBe(choices[0]);
    }
  });

  it("keeps 500 and lower unchanged, starts at 501, and ends at move three", () => {
    expect(openingMoveChoices(openings[0].fen(), { estimatedRating: 500 })).toBeNull();
    expect(openingMoveChoices(openings[0].fen(), { estimatedRating: 400 })).toBeNull();
    expect(openingMoveChoices(openings[0].fen(), { estimatedRating: 501 })).not.toBeNull();
    for (const chess of [position("e4", "e5", "Nf3", "Nc6"), position("e4", "e5", "Nf3", "Nc6", "Bc4")]) {
      expect(openingMoveChoices(chess.fen(), intermediate)).toBeNull();
    }
  });

  it("allows edge-pawn captures and positions with only edge-pawn moves", () => {
    const capture = "rnbqkbnr/1ppppppp/8/p7/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 2";
    expect(openingMoveChoices(capture, intermediate)).toContain("a5b4");
    expect(openingMoveChoices(capture, intermediate)).not.toContain("a5a4");
    const forced = "1r6/8/8/8/8/8/P1k5/K7 w - - 0 1";
    expect(new Chess(forced).moves()).toEqual(["a3", "a4"]);
    expect(openingMoveChoices(forced, intermediate)).toBeNull();
    expect(selectHumanLikeMove({ fen: forced, bot: intermediate, candidates: [{ uci: "a2a3", rank: 1, depth: 8, scoreCp: 0, mate: null, pv: ["a2a3"] }] })).toBe("a2a3");
  });

  it("filters recorded openings before sampling and falls back when no book choice fits", () => {
    const chess = new Chess();
    const key = repertoirePositionKey(chess);
    const choices = openingMoveChoices(chess.fen(), intermediate);
    const edge = { uci: "h2h4", count: 100, weight: 100 };
    const book = { [key]: [edge, { uci: "e2e4", count: 1, weight: 1 }] };
    expect(selectRepertoireMove(chess.fen(), book, () => 0, choices)).toBe("e2e4");
    expect(selectRepertoireMove(chess.fen(), { [key]: [edge] }, () => 0, choices)).toBeNull();
  });

  it("asks the browser engine to search only allowed openings with the same time budget", async () => {
    class Worker {
      static messages: string[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage(message: string) {
        Worker.messages.push(message);
        const reply = message === "uci" ? "uciok" : message === "isready" ? "readyok" : message.startsWith("go ") ? "bestmove e2e4" : null;
        if (reply) queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", Worker);
    const service = new StockfishService();
    try {
      await expect(service.requestMove(new Chess().fen(), intermediate)).resolves.toBe("e2e4");
      const command = Worker.messages.find(message => message.startsWith("go "))!;
      expect(command).toContain(`go movetime ${intermediate.thinkTimeMs} searchmoves `);
      expect(command.split(" ")).toContain("e2e4");
      for (const edge of ["a2a3", "a2a4", "h2h3", "h2h4"]) expect(command.split(" ")).not.toContain(edge);
    } finally { service.terminate(); }
  });

  it.each([[0, "arena-525"], [3, "arena-975"]] as const)("plays a legal non-edge opening with the real tournament engine (%i, %s)", async (index, id) => {
    const chess = openings[index];
    const uci = await chooseArenaBotMove(chess.fen(), id, { moveHistory: [] });
    const move = new Chess(chess.fen()).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    expect(move.piece === "p" && ["a", "h"].includes(move.from[0]) && !move.isCapture()).toBe(false);
  }, 15_000);
});
