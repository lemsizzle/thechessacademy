import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { validateCompletedGame } from "@/chess/persistence/completedGame";

function checkmatePayload() {
  const chess = new Chess();
  const moves = ["f3", "e5", "g4", "Qh4#"].map((san) => {
    const move = chess.move(san);
    return { from: move.from, to: move.to, promotion: move.promotion };
  });
  return {
    opponentId: "pawny",
    opponentName: "Ignored client name",
    playerColor: "white",
    result: "loss",
    resultReason: "checkmate",
    winnerColor: "black",
    timeControlId: "10+5",
    initialFen: new Chess().fen(),
    finalFen: chess.fen(),
    pgn: chess.pgn(),
    moves,
    startedAt: "2026-08-15T01:00:00.000Z",
    completedAt: "2026-08-15T01:01:00.000Z"
  };
}

describe("completed game validation", () => {
  it("replays and normalizes a completed checkmate", () => {
    const game = validateCompletedGame(checkmatePayload());
    expect(game.opponentName).toBe("Pawny");
    expect(game.moves).toHaveLength(4);
    expect(game.pgn).toContain("Qh4#");
    expect(game.finalFen).toBe(checkmatePayload().finalFen);
  });

  it("rejects a final FEN that does not match the move list", () => {
    expect(() => validateCompletedGame({ ...checkmatePayload(), finalFen: new Chess().fen() })).toThrow("Final position does not match");
  });

  it("rejects an impossible reported board result", () => {
    expect(() => validateCompletedGame({ ...checkmatePayload(), result: "draw", winnerColor: null })).toThrow("board position does not match");
  });

  it("accepts an unfinished board only for a valid human resignation", () => {
    const chess = new Chess();
    const move = chess.move("e4");
    const game = validateCompletedGame({
      ...checkmatePayload(),
      result: "loss",
      resultReason: "resignation",
      winnerColor: "black",
      finalFen: chess.fen(),
      moves: [{ from: move.from, to: move.to }]
    });
    expect(game.resultReason).toBe("resignation");
  });
});
