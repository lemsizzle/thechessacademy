import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  attemptStarWarsMove,
  findStarWarsSolution,
  initialStarWarsState,
  STAR_WARS_PUZZLES,
  starWarsPuzzleForScore,
  starWarsSolutionMoves,
  starWarsTierForScore
} from "@/lib/puzzle-training/starWars";

describe("Star Wars training", () => {
  it("ships a varied bank made only from non-pawn learner pieces", () => {
    expect(STAR_WARS_PUZZLES.length).toBeGreaterThanOrEqual(10);
    expect(STAR_WARS_PUZZLES.some((puzzle) => puzzle.pieces.length > 1)).toBe(true);
    expect(STAR_WARS_PUZZLES.flatMap((puzzle) => puzzle.pieces.map((piece) => piece.type))).not.toContain("p");
    for (const puzzle of STAR_WARS_PUZZLES) expect(() => new Chess(puzzle.fen)).not.toThrow();
  });

  it("gives every puzzle a perfect route with exactly one move per star", () => {
    for (const puzzle of STAR_WARS_PUZZLES) {
      const initial = initialStarWarsState(puzzle);
      const route = findStarWarsSolution(initial);
      expect(route, puzzle.id).not.toBeNull();
      expect(route, puzzle.id).toHaveLength(puzzle.stars.length);

      let state = initial;
      for (const [index, move] of (route ?? []).entries()) {
        const before = state.remainingStars.length;
        const result = attemptStarWarsMove(state, move);
        expect(["advanced", "solved"], `${puzzle.id} move ${index + 1}`).toContain(result.status);
        expect(result.state.remainingStars).toHaveLength(before - 1);
        state = result.state;
      }
      expect(state.remainingStars).toHaveLength(0);
    }
  });

  it("ends the run after the first legal move that misses a star", () => {
    const puzzle = STAR_WARS_PUZZLES.find((candidate) => candidate.id === "knight-launch");
    expect(puzzle).toBeDefined();
    const state = initialStarWarsState(puzzle!);
    const result = attemptStarWarsMove(state, { from: "b1", to: "a3" });
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.reason).toBe("missed-star");
    expect(result.state).toEqual(state);
  });

  it("accepts every first move that preserves a complete perfect route", () => {
    for (const puzzle of STAR_WARS_PUZZLES) {
      const state = initialStarWarsState(puzzle);
      const validMoves = starWarsSolutionMoves(state);
      expect(validMoves.length, puzzle.id).toBeGreaterThan(0);
      for (const move of validMoves) {
        expect(attemptStarWarsMove(state, move).status, `${puzzle.id}: ${move.from}-${move.to}`).not.toBe("failed");
      }
    }
  });

  it("allows a star capture even when the chosen order cannot finish perfectly", () => {
    const option = STAR_WARS_PUZZLES.flatMap((puzzle) => {
      const state = initialStarWarsState(puzzle);
      const routeMoves = starWarsSolutionMoves(state);
      const chess = new Chess(state.fen);
      const deadEnds = state.movableSquares.flatMap((square) => chess.moves({ square, verbose: true })
        .filter((move) => state.remainingStars.includes(move.to))
        .map((move) => ({ from: move.from, to: move.to })))
        .filter((move) => !routeMoves.some((routeMove) => routeMove.from === move.from && routeMove.to === move.to));
      return deadEnds.map((move) => ({ state, move }));
    })[0];

    expect(option).toBeDefined();
    expect(attemptStarWarsMove(option.state, option.move).status).toBe("advanced");
  });

  it("raises difficulty as the player's score grows", () => {
    expect(starWarsTierForScore(0)).toBe(1);
    expect(starWarsTierForScore(2)).toBe(2);
    expect(starWarsTierForScore(5)).toBe(3);
    expect(starWarsTierForScore(9)).toBe(4);
    expect(starWarsPuzzleForScore(0).tier).toBe(1);
    expect(starWarsPuzzleForScore(12).tier).toBe(4);
  });
});
