import { describe, expect, it } from "vitest";
import { Chess, type Square } from "chess.js";
import { castlingDropTarget } from "@/chess/game/castlingInput";

describe("king-on-rook castling", () => {
  it.each([
    ["w", "e1", "h1", "g1", "f1"], ["w", "e1", "a1", "c1", "d1"],
    ["b", "e8", "h8", "g8", "f8"], ["b", "e8", "a8", "c8", "d8"]
  ])("castles %s from %s onto %s", (turn, from, rook, destination, rookDestination) => {
    const chess = new Chess(`r3k2r/8/8/8/8/8/8/R3K2R ${turn} KQkq - 0 1`);
    const to = castlingDropTarget(chess.fen(), from, rook);
    expect(to).toBe(destination);
    chess.move({ from, to });
    expect(chess.get(destination as Square)?.type).toBe("k");
    expect(chess.get(rookDestination as Square)?.type).toBe("r");
  });

  it.each([
    "r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1",
    "r3k2r/8/8/8/8/8/8/R3KB1R w KQkq - 0 1",
    "k3r3/8/8/8/8/8/8/4K2R w K - 0 1",
    "k4r2/8/8/8/8/8/8/4K2R w K - 0 1",
    "k5r1/8/8/8/8/8/8/4K2R w K - 0 1",
    "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1"
  ])("does not translate illegal castling: %s", fen => {
    expect(castlingDropTarget(fen, "e1", "h1")).toBe("h1");
  });

  it("preserves ordinary moves and incomplete positions", () => {
    expect(castlingDropTarget(new Chess().fen(), "e2", "e4")).toBe("e4");
    expect(castlingDropTarget("invalid", "e1", "h1")).toBe("h1");
    expect(castlingDropTarget({}, "e1", "h1")).toBe("h1");
  });
});
