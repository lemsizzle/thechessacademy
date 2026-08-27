import { Chess, type Square } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  attemptStarWarsMove,
  findStarWarsSolution,
  generateStarWarsPuzzle,
  initialStarWarsState,
  STAR_WARS_PUZZLES,
  starWarsPuzzleForScore,
  starWarsSolutionMoves,
  starWarsTierForScore,
  type StarWarsPuzzle,
  type StarWarsState
} from "@/lib/puzzle-training/starWars";

function positionSignature(puzzle: StarWarsPuzzle) {
  return `${puzzle.fen}|${[...puzzle.stars].sort().join(",")}`;
}

function starLandingMoves(state: StarWarsState) {
  const chess = new Chess(state.fen);
  return state.movableSquares.flatMap((square) => chess.moves({ square, verbose: true })
    .filter((move) => state.remainingStars.includes(move.to))
    .map((move) => ({ from: move.from, to: move.to })));
}

function expectPerfectRoute(puzzle: StarWarsPuzzle) {
  const initial = initialStarWarsState(puzzle);
  const route = findStarWarsSolution(initial);
  expect(route, puzzle.id).not.toBeNull();
  expect(route, puzzle.id).toHaveLength(puzzle.stars.length);

  let state = initial;
  for (const [index, move] of (route ?? []).entries()) {
    const before = state.remainingStars.length;
    expect(state.remainingStars, `${puzzle.id} move ${index + 1}`).toContain(move.to);
    const result = attemptStarWarsMove(state, move);
    expect(result.status, `${puzzle.id} move ${index + 1}`).toBe(index === puzzle.stars.length - 1 ? "solved" : "advanced");
    expect(result.state.remainingStars).toHaveLength(before - 1);
    state = result.state;
  }
  expect(state.remainingStars).toHaveLength(0);
}

describe("Star Wars training", () => {
  it("keeps a compatible preview bank made only from valid non-pawn learner pieces", () => {
    expect(STAR_WARS_PUZZLES.length).toBeGreaterThanOrEqual(10);
    expect(STAR_WARS_PUZZLES.some((puzzle) => puzzle.pieces.length > 1)).toBe(true);
    for (const puzzle of STAR_WARS_PUZZLES) {
      expect(() => new Chess(puzzle.fen)).not.toThrow();
      expect(puzzle.pieces.map((piece) => piece.type)).not.toContain("p");
      expect(new Set(puzzle.stars).size).toBe(puzzle.stars.length);
      expect(puzzle.stars.some((star) => puzzle.movableSquares.includes(star))).toBe(false);
    }
  });

  it("is reproducible for the same mission seed without relying on the cache", () => {
    for (const [score, variant] of [[0, 0], [7, 91], [499, 0xffff_ffff], [75_000, 123_456_789]]) {
      expect(generateStarWarsPuzzle(score, variant)).toEqual(generateStarWarsPuzzle(score, variant));
      expect(starWarsPuzzleForScore(score, variant)).toEqual(generateStarWarsPuzzle(score, variant));
    }
    expect(positionSignature(generateStarWarsPuzzle(42, 1))).not.toBe(positionSignature(generateStarWarsPuzzle(42, 2)));
  });

  it("generates 500 unique uncached missions for one long run within its performance budget", { timeout: 20_000 }, () => {
    const ids = new Set<string>();
    const positions = new Set<string>();
    const durations: number[] = [];
    const startedAt = performance.now();
    for (let score = 0; score < 500; score += 1) {
      const missionStartedAt = performance.now();
      const puzzle = generateStarWarsPuzzle(score, 0x9e37_79b9);
      durations.push(performance.now() - missionStartedAt);
      ids.add(puzzle.id);
      positions.add(positionSignature(puzzle));
    }
    const elapsedMs = performance.now() - startedAt;
    const p95Ms = durations.sort((left, right) => left - right)[Math.floor(durations.length * 0.95)];
    expect(ids.size).toBe(500);
    expect(positions.size).toBe(500);
    expect(elapsedMs).toBeLessThan(15_000);
    expect(p95Ms).toBeLessThan(50);
  });

  it("proves sampled missions have a route with exactly one star per move", { timeout: 15_000 }, () => {
    const seeds = [
      ...Array.from({ length: 16 }, (_, score) => [score, 0] as const),
      ...Array.from({ length: 12 }, (_, index) => [100 + index * 37, 42] as const),
      ...Array.from({ length: 8 }, (_, index) => [10_000 + index * 211, 0xffff_ffff] as const)
    ];
    for (const [score, variant] of seeds) expectPerfectRoute(starWarsPuzzleForScore(score, variant));
  });

  it("ends the run after the first legal move that misses a star", () => {
    const option = Array.from({ length: 20 }, (_, score) => starWarsPuzzleForScore(score, 771)).flatMap((puzzle) => {
      const state = initialStarWarsState(puzzle);
      const chess = new Chess(state.fen);
      const move = state.movableSquares.flatMap((square) => chess.moves({ square, verbose: true }))
        .find((candidate) => !state.remainingStars.includes(candidate.to));
      return move ? [{ state, move: { from: move.from, to: move.to } }] : [];
    })[0];

    expect(option).toBeDefined();
    const result = attemptStarWarsMove(option.state, option.move);
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.reason).toBe("missed-star");
    expect(result.state).toEqual(option.state);
  });

  it("accepts every first move that preserves a complete perfect route", () => {
    for (let score = 0; score < 3; score += 1) {
      const puzzle = starWarsPuzzleForScore(score, 808);
      const state = initialStarWarsState(puzzle);
      const validMoves = starWarsSolutionMoves(state);
      expect(validMoves.length, puzzle.id).toBeGreaterThan(0);
      for (const move of validMoves) {
        expect(attemptStarWarsMove(state, move).status, `${puzzle.id}: ${move.from}-${move.to}`).not.toBe("failed");
      }
    }
  });

  it("allows a star capture even when the chosen order cannot finish perfectly", () => {
    let option: { state: StarWarsState; move: { from: Square; to: Square } } | undefined;
    for (const puzzle of [...STAR_WARS_PUZZLES, ...Array.from({ length: 24 }, (_, score) => starWarsPuzzleForScore(score, 1_337))]) {
      const state = initialStarWarsState(puzzle);
      const routeMoves = starWarsSolutionMoves(state);
      const deadEnd = starLandingMoves(state).find((move) => !routeMoves.some((routeMove) => (
        routeMove.from === move.from && routeMove.to === move.to
      )));
      if (!deadEnd) continue;
      option = { state, move: deadEnd };
      break;
    }

    expect(option).toBeDefined();
    expect(attemptStarWarsMove(option!.state, option!.move).status).toBe("advanced");
  });

  it("scales star and piece counts with the score tier", () => {
    expect(starWarsTierForScore(0)).toBe(1);
    expect(starWarsTierForScore(2)).toBe(2);
    expect(starWarsTierForScore(5)).toBe(3);
    expect(starWarsTierForScore(9)).toBe(4);

    for (const [score, tier, stars, pieces] of [
      [0, 1, 3, 1],
      [2, 2, 4, 2],
      [5, 3, 5, 2],
      [9, 4, 6, 3]
    ] as const) {
      const puzzle = starWarsPuzzleForScore(score, 5150);
      expect(puzzle.tier).toBe(tier);
      expect(puzzle.stars).toHaveLength(stars);
      expect(puzzle.pieces).toHaveLength(pieces);
    }
  });

});
