import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { boardDropAction, createOutcome, detectBoardOutcome, legalMovesFrom, promotionOptions, tryMove, undoComputerTurn } from "@/chess/game/rules";

describe("internal chess rules", () => {
  it("accepts legal moves and rejects illegal moves", () => {
    const chess = new Chess();
    expect(legalMovesFrom(chess, "e2").map((move) => move.to)).toEqual(["e3", "e4"]);
    expect(tryMove(chess, { from: "e2", to: "e5" })).toBeNull();
    expect(chess.fen()).toBe(new Chess().fen());
    expect(tryMove(chess, { from: "e2", to: "e4" })?.san).toBe("e4");
  });

  it("accepts legal board drops immediately while holding promotions for a choice", () => {
    const opening = new Chess();
    expect(boardDropAction(opening, "e2", "e4")).toBe("move");
    expect(boardDropAction(opening, "e2", "e5")).toBe("illegal");

    const promotion = new Chess("8/P7/8/8/8/8/8/k6K w - - 0 1");
    expect(boardDropAction(promotion, "a7", "a8")).toBe("promotion");
  });

  it("uses chess.js castling rules", () => {
    const chess = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    expect(tryMove(chess, { from: "e1", to: "g1" })?.san).toBe("O-O");
    expect(chess.get("g1")).toMatchObject({ type: "k", color: "w" });
    expect(chess.get("f1")).toMatchObject({ type: "r", color: "w" });
  });

  it("offers every promotion choice and preserves underpromotion", () => {
    const chess = new Chess("8/P7/8/8/8/8/8/k6K w - - 0 1");
    expect(promotionOptions(chess, "a7", "a8").sort()).toEqual(["b", "n", "q", "r"]);
    expect(tryMove(chess, { from: "a7", to: "a8", promotion: "n" })?.promotion).toBe("n");
    expect(chess.get("a8")).toMatchObject({ type: "n", color: "w" });
  });

  it("supports en passant", () => {
    const chess = new Chess();
    chess.move("e4");
    chess.move("a6");
    chess.move("e5");
    chess.move("d5");
    const move = tryMove(chess, { from: "e5", to: "d6" });
    expect(move?.flags).toContain("e");
    expect(chess.get("d5")).toBeUndefined();
    expect(chess.get("d6")).toMatchObject({ type: "p", color: "w" });
  });

  it("detects checkmate", () => {
    const chess = new Chess();
    chess.move("f3");
    chess.move("e5");
    chess.move("g4");
    chess.move("Qh4#");
    expect(detectBoardOutcome(chess, "white")).toMatchObject({ result: "loss", reason: "checkmate", winnerColor: "black" });
  });

  it("detects stalemate", () => {
    const chess = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    expect(detectBoardOutcome(chess, "white")).toMatchObject({ result: "draw", reason: "stalemate", winnerColor: null });
  });

  it("detects repetition, fifty-move, and insufficient-material draws", () => {
    const repeated = new Chess();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      repeated.move("Nf3"); repeated.move("Nf6"); repeated.move("Ng1"); repeated.move("Ng8");
    }
    expect(detectBoardOutcome(repeated, "white")?.reason).toBe("threefold_repetition");

    const fiftyMove = new Chess("8/8/8/8/8/8/6Rk/5K2 w - - 100 1");
    expect(detectBoardOutcome(fiftyMove, "white")?.reason).toBe("fifty_move_rule");

    const insufficient = new Chess("8/8/8/8/8/8/7k/5K2 w - - 0 1");
    expect(detectBoardOutcome(insufficient, "white")?.reason).toBe("insufficient_material");
  });

  it("takes back the human move and computer response", () => {
    const whiteGame = new Chess();
    whiteGame.move("e4");
    whiteGame.move("e5");
    expect(undoComputerTurn(whiteGame, "white")).toHaveLength(2);
    expect(whiteGame.fen()).toBe(new Chess().fen());

    const blackGame = new Chess();
    blackGame.move("e4");
    const afterOpening = blackGame.fen();
    blackGame.move("e5");
    blackGame.move("Nf3");
    expect(undoComputerTurn(blackGame, "black")).toHaveLength(2);
    expect(blackGame.fen()).toBe(afterOpening);
  });

  it("generates timeout and resignation results from the human perspective", () => {
    expect(createOutcome("timeout", "black", "white")).toMatchObject({ result: "loss", reason: "timeout" });
    expect(createOutcome("resignation", "white", "black")).toMatchObject({ result: "loss", reason: "resignation" });
  });
});
