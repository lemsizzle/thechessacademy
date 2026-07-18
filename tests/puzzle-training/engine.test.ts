import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  applyUciMove,
  filterPuzzlesByTheme,
  legalDestinations,
  parseUciMove,
  prepareLichessPuzzle,
  replayPuzzleToIndex,
  validateLichessPuzzle,
  validatePuzzleMove
} from "../../lib/puzzle-training/engine";
import {
  alternateMatePuzzle,
  forkPuzzle,
  matePuzzle,
  multiMovePuzzle,
  pinPuzzle,
  promotionPuzzle,
  skewerPuzzle
} from "../fixtures/lichessPuzzles";

describe("official Lichess puzzle semantics", () => {
  it("loads the source FEN and validates the complete sequence", () => {
    expect(validateLichessPuzzle(forkPuzzle.initial_fen, forkPuzzle.moves)).toBe(true);
  });

  it("applies move zero as the opponent setup move", () => {
    const prepared = prepareLichessPuzzle(forkPuzzle.initial_fen, forkPuzzle.moves);
    expect(prepared.displayFen).not.toBe(forkPuzzle.initial_fen);
    expect(new Chess(prepared.displayFen).get("e7")).toMatchObject({ type: "k", color: "b" });
  });

  it("orients the board toward the student side", () => {
    expect(prepareLichessPuzzle(forkPuzzle.initial_fen, forkPuzzle.moves).orientation).toBe("white");
  });

  it("uses moves[1] as the first student answer", () => {
    expect(prepareLichessPuzzle(forkPuzzle.initial_fen, forkPuzzle.moves).firstStudentMove).toBe("e5c6");
  });

  it("accepts the correct first student move", () => {
    expect(validatePuzzleMove(forkPuzzle, 1, { from: "e5", to: "c6" }).accepted).toBe(true);
  });

  it("rejects a legal but incorrect move and restores the same position", () => {
    const before = replayPuzzleToIndex(forkPuzzle, 1).fen();
    const result = validatePuzzleMove(forkPuzzle, 1, { from: "e5", to: "f7" });
    expect(result).toMatchObject({ accepted: false, completed: false, positionFen: before, nextMoveIndex: 1 });
  });

  it("applies the automatic opponent reply after a correct partial solution", () => {
    const result = validatePuzzleMove(multiMovePuzzle, 1, { from: "a2", to: "e6" });
    expect(result).toMatchObject({ accepted: true, completed: false, opponentMove: "d7d8", nextMoveIndex: 3 });
    expect(new Chess(result.positionFen).get("d8")).toMatchObject({ type: "k", color: "b" });
  });

  it("completes a multi-move sequence on the final student move", () => {
    expect(validatePuzzleMove(multiMovePuzzle, 3, { from: "f7", to: "f8" })).toMatchObject({ accepted: true, completed: true });
  });

  it("supports UCI promotion suffixes", () => {
    expect(parseUciMove("e7e8n")).toEqual({ from: "e7", to: "e8", promotion: "n" });
    expect(validatePuzzleMove(promotionPuzzle, 1, { from: "e7", to: "e8" })).toMatchObject({ accepted: true, completed: true });
  });

  it("accepts a different legal checkmate for a mate-in-one puzzle", () => {
    expect(validatePuzzleMove(alternateMatePuzzle, 1, { from: "f5", to: "f8" })).toMatchObject({ accepted: true, completed: true });
  });

  it("rejects malformed or incomplete official sequences", () => {
    expect(() => validateLichessPuzzle(forkPuzzle.initial_fen, ["e8e7"])).toThrow(/setup move/i);
  });

  it("applies UCI moves and exposes legal destinations", () => {
    const chess = new Chess(forkPuzzle.initial_fen);
    applyUciMove(chess, "e8e7");
    expect(legalDestinations(chess.fen(), "e5")).toContain("c6");
  });
});

describe("theme filtering", () => {
  const puzzles = [forkPuzzle, pinPuzzle, skewerPuzzle, matePuzzle];

  it.each([
    ["fork", forkPuzzle],
    ["pin", pinPuzzle],
    ["skewer", skewerPuzzle],
    ["mateIn1", matePuzzle]
  ] as const)("filters %s puzzles", (theme, expected) => {
    expect(filterPuzzlesByTheme(puzzles, theme)).toEqual([expected]);
  });

  it("keeps every supported tactic in mixed mode", () => {
    expect(filterPuzzlesByTheme(puzzles, "mixed")).toHaveLength(4);
  });
});
