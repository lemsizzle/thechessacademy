import { afterEach, describe, expect, it, vi } from "vitest";
import { Chess } from "chess.js";
import { repertoirePositionKey, selectRepertoireMove } from "@/chess/bots/repertoire";
import { SIR_LEM_REPERTOIRE } from "@/chess/bots/sirLemRepertoire";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { StockfishCancelledError, StockfishService } from "@/chess/engine/StockfishService";
import { buildSirLemProfile, type LichessProfileGame } from "@/scripts/lib/buildSirLemProfile";
import type { BotRepertoire } from "@/chess/types";

const sirLem = BOT_DIFFICULTIES.find((bot) => bot.id === "so-pawny")!;
const position = (...moves: string[]) => { const chess = new Chess(); moves.forEach((move) => chess.move(move)); return chess; };
const bookFor = (chess: Chess, ...moves: string[]): BotRepertoire => ({
  [repertoirePositionKey(chess)]: moves.map((uci) => ({ uci, count: 2, weight: 1 }))
});
const game = (id: string, moves: string, black = false, ageDays = 0): LichessProfileGame => ({
  id, moves, rated: true, variant: "standard", status: "resign", createdAt: Date.UTC(2026, 8, 1) - ageDays * 86_400_000,
  players: { [black ? "black" : "white"]: { user: { id: "sO_pAwNy" } } }
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Sir Lem position memory", () => {
  it("recognizes transpositions and different move counters without needing move history", () => {
    const a = position("Nf3", "d5", "d4", "Nf6");
    const b = position("d4", "Nf6", "Nf3", "d5");
    expect(repertoirePositionKey(a)).toBe(repertoirePositionKey(b));
    const book = bookFor(a, "c2c4");
    expect(selectRepertoireMove(b.fen(), book)).toBe("c2c4");
    expect(selectRepertoireMove(`${repertoirePositionKey(b)} 8 15`, book)).toBe("c2c4");
  });

  it("does not mix colors, castling rights, or legal en passant rights", () => {
    const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const book = bookFor(castle, "e1g1");
    expect(selectRepertoireMove(castle.fen(), book)).toBe("e1g1");
    expect(selectRepertoireMove(castle.fen().replace(" KQkq ", " Qkq "), book)).toBeNull();
    expect(selectRepertoireMove(castle.fen().replace(" w ", " b "), book)).toBeNull();
    const ep = new Chess("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2");
    const epBook = bookFor(ep, "e5d6");
    expect(selectRepertoireMove(ep.fen(), epBook)).toBe("e5d6");
    expect(selectRepertoireMove(ep.fen().replace(" d6 ", " - "), epBook)).toBeNull();
  });

  it("samples the recorded distribution rather than inventing a different move", () => {
    const chess = new Chess();
    const book = { [repertoirePositionKey(chess)]: [
      { uci: "e2e4", count: 8, weight: 800 }, { uci: "d2d4", count: 2, weight: 200 }
    ] };
    const selections = Array.from({ length: 100 }, (_, index) => selectRepertoireMove(chess.fen(), book, () => (index + 0.5) / 100));
    expect(selections.filter((move) => move === "e2e4")).toHaveLength(80);
    expect(selections.filter((move) => move === "d2d4")).toHaveLength(20);
  });

  it("filters illegal entries, keeps underpromotions and returns null out of book", () => {
    const start = new Chess();
    expect(selectRepertoireMove(start.fen(), bookFor(start, "e2e5", "h8h1"))).toBeNull();
    expect(selectRepertoireMove(start.fen(), bookFor(start, "e2e5", "e2e4"))).toBe("e2e4");
    expect(selectRepertoireMove(position("a3").fen(), bookFor(start, "e2e4"))).toBeNull();
    const promotion = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    expect(selectRepertoireMove(promotion.fen(), bookFor(promotion, "a7a8n"))).toBe("a7a8n");
    expect(selectRepertoireMove(`${repertoirePositionKey(start)} 100 60`, bookFor(start, "e2e4"))).toBeNull();
  });
});

describe("public-game profile builder", () => {
  it("is deterministic and learns only the source player's moves, including losses", () => {
    const games = [game("a", "e4 d6 d4 Nf6"), game("b", "e4 d6 d4 Nf6"),
      game("c", "d4 d5 c4 e6", true), game("d", "d4 d5 c4 e6", true)];
    const built = buildSirLemProfile(games);
    expect(buildSirLemProfile([...games].reverse())).toEqual(built);
    expect(built.source.games).toBe(4);
    expect(built.repertoire[repertoirePositionKey(new Chess())]).toEqual([{ uci: "e2e4", count: 2, weight: 2000 }]);
    expect(built.repertoire[repertoirePositionKey(position("d4"))]).toEqual([{ uci: "d7d5", count: 2, weight: 2000 }]);
    expect(built.repertoire[repertoirePositionKey(position("e4"))]).toBeUndefined();
  });

  it("combines transpositions and retains rare choices instead of truncating to four", () => {
    const games = [game("a", "Nf3 d5 d4 Nf6 c4"), game("b", "d4 Nf6 Nf3 d5 c4")];
    const built = buildSirLemProfile(games);
    expect(built.repertoire[repertoirePositionKey(position("Nf3", "d5", "d4", "Nf6"))]).toEqual([{ uci: "c2c4", count: 2, weight: 2000 }]);
    const many = buildSirLemProfile(["e4", "d4", "c4", "Nf3", "b3"].map((san, i) => game(String(i), san)));
    expect(many.repertoire[repertoirePositionKey(new Chess())]).toHaveLength(5);
  });

  it("weights recent games more while retaining older repertoire and actual counts", () => {
    const built = buildSirLemProfile([game("a", "e4", false, 180), game("b", "d4")]);
    expect(built.repertoire[repertoirePositionKey(new Chess())]).toEqual([
      { uci: "d2d4", count: 1, weight: 1000 }, { uci: "e2e4", count: 1, weight: 500 }
    ]);
  });

  it("excludes duplicate, corrupt, ongoing, nonstandard and other players' games", () => {
    const a = game("a", "e4 e5");
    const built = buildSirLemProfile([a, a, game("b", "e4 e5"), game("bad", "e4 e5 nonsense"),
      { ...game("casual", "d4"), rated: false }, { ...game("variant", "d4"), variant: "chess960" },
      { ...game("ongoing", "d4"), status: "started" }, { ...game("other", "d4"), players: {} }]);
    expect(built.source.games).toBe(2);
    expect(built.repertoire[repertoirePositionKey(new Chess())]).toEqual([{ uci: "e2e4", count: 2, weight: 2000 }]);
  });

  it("counts a repeated position only once per source game", () => {
    const built = buildSirLemProfile([game("a", "Nf3 Nf6 Ng1 Ng8 d4"), game("b", "Nf3 Nf6 Ng1 Ng8 d4")]);
    expect(built.repertoire[repertoirePositionKey(new Chess())]).toEqual([{ uci: "g1f3", count: 2, weight: 2000 }]);
  });
});

describe("engine integration", () => {
  it("plays remembered choices without launching Stockfish, including after reload", async () => {
    const worker = vi.fn();
    vi.stubGlobal("Worker", worker);
    vi.spyOn(Math, "random").mockReturnValue(0);
    const chess = position("e4");
    const service = new StockfishService();
    await expect(service.requestMove(chess.fen(), sirLem)).resolves.toBe(SIR_LEM_REPERTOIRE[repertoirePositionKey(chess)][0].uci);
    expect(worker).not.toHaveBeenCalled();
    service.terminate();
  });

  it("cancels during repertoire loading and does not return a stale move", async () => {
    const service = new StockfishService();
    const result = service.requestMove(new Chess().fen(), sirLem);
    service.stop();
    await expect(result).rejects.toBeInstanceOf(StockfishCancelledError);
    await expect(service.requestMove(new Chess().fen(), sirLem)).resolves.toMatch(/^[a-h][1-8][a-h][1-8]$/);
    service.terminate();
    await expect(service.requestMove(new Chess().fen(), sirLem)).rejects.toThrow("terminated");
  });

  it("uses the normal legal engine fallback outside the repertoire", async () => {
    class Worker {
      static messages: string[] = [];
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage(message: string) {
        Worker.messages.push(message);
        const reply = message === "uci" ? "uciok" : message === "isready" ? "readyok"
          : message.startsWith("go ") ? "bestmove e2e4" : null;
        if (reply) queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", Worker);
    const service = new StockfishService();
    const fen = "7k/8/8/8/8/8/4R3/K7 w - - 0 1";
    await expect(service.requestMove(fen, sirLem)).resolves.toBe("e2e4");
    expect(Worker.messages).toContain(`position fen ${fen}`);
    service.terminate();
  });
});
