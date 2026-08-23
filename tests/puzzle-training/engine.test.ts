import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  applyUciMove,
  filterPuzzlesByTheme,
  legalDestinations,
  parseUciMove,
  premoveDestinations,
  prepareLichessPuzzle,
  prepareTrainingPuzzle,
  replayPuzzleToIndex,
  validateLichessPuzzle,
  validatePuzzleMove
} from "../../lib/puzzle-training/engine";
import { parsePuzzleLevel, puzzleLevelRatingRange } from "../../lib/puzzle-training/types";
import {
  alternateMatePuzzle,
  forkPuzzle,
  matePuzzle,
  multiMovePuzzle,
  pinPuzzle,
  promotionPuzzle,
  skewerPuzzle
} from "../fixtures/lichessPuzzles";

const studyPuzzle = {
  ...forkPuzzle,
  initial_fen: new Chess().fen(),
  moves: ["e2e4"],
  start_mode: "direct" as const,
  accepted_moves: ["e2e4", "d2d4"],
  source_kind: "study" as const,
  teacher_prompt: "Claim the center."
};

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

  it("offers student premoves while the opponent has the turn", () => {
    const chess = new Chess();
    chess.move("e4");
    expect(chess.turn()).toBe("b");
    expect(premoveDestinations(chess.fen(), "g1", "w")).toContain("f3");
    expect(premoveDestinations(chess.fen(), "e4", "w")).toContain("d5");
    expect(premoveDestinations(chess.fen(), "g8", "w")).toEqual([]);
  });

  it("uses Lichess-style geometry instead of current check restrictions", () => {
    const fen = "7k/8/8/8/8/8/1r6/K7 b - - 0 1";
    expect(legalDestinations(fen.replace(" b ", " w "), "a1")).not.toContain("b1");
    expect(premoveDestinations(fen, "a1", "w")).toContain("b1");
  });
});

describe("teacher-authored Study puzzle semantics", () => {
  it("starts directly from the authored position", () => {
    const prepared = prepareTrainingPuzzle(studyPuzzle);
    expect(prepared.displayFen).toBe(new Chess().fen());
    expect(prepared.firstStudentMove).toBe("e2e4");
  });

  it("accepts any teacher-approved move without mutating the puzzle", () => {
    expect(validatePuzzleMove(studyPuzzle, 0, { from: "e2", to: "e4" })).toMatchObject({ accepted: true, completed: true });
    expect(validatePuzzleMove(studyPuzzle, 0, { from: "d2", to: "d4" })).toMatchObject({ accepted: true, completed: true });
    expect(validatePuzzleMove(studyPuzzle, 0, { from: "c2", to: "c4" })).toMatchObject({ accepted: false, completed: false, nextMoveIndex: 0 });
    expect(studyPuzzle.moves).toEqual(["e2e4"]);
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

describe("level filtering", () => {
  it.each([
    ["beginner", { minimum: 600, maximum: 999 }],
    ["improver", { minimum: 1000, maximum: 1399 }],
    ["intermediate", { minimum: 1400, maximum: 1799 }],
    ["advanced", { minimum: 1800, maximum: 1999 }],
    ["expert", { minimum: 2000, maximum: 2200 }]
  ] as const)("maps %s to a non-overlapping rating range", (level, expected) => {
    expect(puzzleLevelRatingRange(level)).toEqual(expected);
  });

  it("uses all levels for missing or invalid query values", () => {
    expect(parsePuzzleLevel(null)).toBe("all");
    expect(parsePuzzleLevel("grandmaster")).toBe("all");
    expect(puzzleLevelRatingRange("all")).toBeNull();
  });
});
