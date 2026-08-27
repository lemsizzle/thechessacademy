import { Chess, type Square } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  attemptStarWarsMove,
  findStarWarsSolution,
  generateStarWarsPuzzle,
  initialStarWarsState,
  STAR_WARS_PUZZLES,
  starWarsLegalDestinations,
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
  return state.movableSquares.flatMap((square) => starWarsLegalDestinations(state, square)
    .filter((to) => state.remainingStars.includes(to))
    .map((to) => ({ from: square, to })));
}

function sliderBlockingState(piece: "b" | "q" | "r", star: Square): StarWarsState {
  const chess = new Chess();
  chess.clear();
  chess.put({ color: "w", type: piece }, "a1");
  chess.put({ color: "w", type: "k" }, "h1");
  chess.put({ color: "b", type: "k" }, "h7");
  return { fen: chess.fen(), remainingStars: [star], movableSquares: ["a1"] };
}

function hiddenSupportPuzzle(): StarWarsPuzzle {
  const chess = new Chess();
  chess.clear();
  chess.put({ color: "w", type: "r" }, "a7");
  chess.put({ color: "w", type: "b" }, "e4");
  chess.put({ color: "w", type: "q" }, "g1");
  chess.put({ color: "w", type: "k" }, "g2");
  chess.put({ color: "b", type: "k" }, "h8");
  return {
    id: "hidden-support-regression",
    title: "Hidden support regression",
    briefing: "The visible queen must have a visibly clear path.",
    tier: 1,
    fen: chess.fen(),
    stars: ["d6", "g6", "d5", "e5"],
    pieces: [
      { type: "r", square: "a7" },
      { type: "b", square: "e4" },
      { type: "q", square: "g1" }
    ],
    movableSquares: ["a7", "e4", "g1"],
    hiddenPieceTypes: ["wK", "bK"]
  };
}

function intermediateSquares(from: Square, to: Square) {
  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = Number(from[1]) - 1;
  const toFile = to.charCodeAt(0) - 97;
  const toRank = Number(to[1]) - 1;
  const fileDelta = toFile - fromFile;
  const rankDelta = toRank - fromRank;
  const distance = Math.max(Math.abs(fileDelta), Math.abs(rankDelta));
  const fileStep = Math.sign(fileDelta);
  const rankStep = Math.sign(rankDelta);
  return Array.from({ length: Math.max(0, distance - 1) }, (_, index) => (
    `${String.fromCharCode(97 + fromFile + fileStep * (index + 1))}${fromRank + rankStep * (index + 1) + 1}` as Square
  ));
}

function routeVisibilityError(puzzle: StarWarsPuzzle) {
  const route = findStarWarsSolution(initialStarWarsState(puzzle));
  if (!route || route.length !== puzzle.stars.length) return `${puzzle.id}: intended route is unavailable`;
  const pieceBySquare = new Map(puzzle.pieces.map((piece) => [piece.square, piece.type] as const));
  const remainingStars = new Set(puzzle.stars);
  let state = initialStarWarsState(puzzle);

  for (const [index, move] of route.entries()) {
    const piece = pieceBySquare.get(move.from);
    if (!piece) return `${puzzle.id}: no learner piece on ${move.from} at move ${index + 1}`;
    if (piece === "b" || piece === "r" || piece === "q") {
      const crossedStar = intermediateSquares(move.from, move.to).find((square) => remainingStars.has(square));
      if (crossedStar) return `${puzzle.id}: ${move.from}-${move.to} crosses uncollected star ${crossedStar}`;
    }
    const result = attemptStarWarsMove(state, move);
    if (result.status === "illegal" || result.status === "failed") {
      return `${puzzle.id}: intended move ${move.from}-${move.to} is ${result.status}`;
    }
    state = result.state;
    remainingStars.delete(move.to);
    pieceBySquare.delete(move.from);
    pieceBySquare.set(move.to, piece);
  }
  return remainingStars.size ? `${puzzle.id}: intended route leaves ${remainingStars.size} stars` : null;
}

function expectPerfectRoute(puzzle: StarWarsPuzzle) {
  const initial = initialStarWarsState(puzzle);
  const route = findStarWarsSolution(initial);
  expect(route, puzzle.id).not.toBeNull();
  expect(route, puzzle.id).toHaveLength(puzzle.stars.length);
  expect(routeVisibilityError(puzzle)).toBeNull();

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
      const runtime = new Chess(initialStarWarsState(puzzle).fen, { skipValidation: true });
      const runtimeSquares = runtime.board().flatMap((rank) => rank.flatMap((piece) => piece ? [piece.square] : []));
      expect(runtimeSquares.sort()).toEqual([...puzzle.movableSquares].sort());
    }
  });

  it("is reproducible for the same mission seed without relying on the cache", () => {
    for (const [score, variant] of [[0, 0], [7, 91], [499, 0xffff_ffff], [75_000, 123_456_789]]) {
      expect(generateStarWarsPuzzle(score, variant)).toEqual(generateStarWarsPuzzle(score, variant));
      expect(starWarsPuzzleForScore(score, variant)).toEqual(generateStarWarsPuzzle(score, variant));
    }
    expect(positionSignature(generateStarWarsPuzzle(42, 1))).not.toBe(positionSignature(generateStarWarsPuzzle(42, 2)));
  });

  it("generates 500 unique uncached missions for one long run within its performance budget", { timeout: 35_000 }, () => {
    const ids = new Set<string>();
    const positions = new Set<string>();
    const routeVisibilityErrors: string[] = [];
    const durations: number[] = [];
    const startedAt = performance.now();
    for (let score = 0; score < 500; score += 1) {
      const missionStartedAt = performance.now();
      const puzzle = generateStarWarsPuzzle(score, 0x9e37_79b9);
      durations.push(performance.now() - missionStartedAt);
      ids.add(puzzle.id);
      positions.add(positionSignature(puzzle));
      const visibilityError = routeVisibilityError(puzzle);
      if (visibilityError) routeVisibilityErrors.push(visibilityError);
    }
    const elapsedMs = performance.now() - startedAt;
    const p95Ms = durations.sort((left, right) => left - right)[Math.floor(durations.length * 0.95)];
    expect(ids.size).toBe(500);
    expect(positions.size).toBe(500);
    expect(routeVisibilityErrors).toEqual([]);
    expect(p95Ms).toBeLessThan(75);
    // The aggregate includes full solution replay for every mission and runs
    // alongside the rest of the Vitest pool; user-facing latency is guarded by p95.
    expect(elapsedMs).toBeLessThan(30_000);
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
      const chess = new Chess(state.fen, { skipValidation: true });
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

  it("treats a remaining star as a blocker for every sliding piece", () => {
    for (const [piece, star, beyond, before] of [
      ["r", "c1", "f1", "b1"],
      ["b", "c3", "f6", "b2"],
      ["q", "c3", "f6", "b2"]
    ] as const) {
      const state = sliderBlockingState(piece, star);
      const destinations = starWarsLegalDestinations(state, "a1");
      expect(destinations, piece).toContain(before);
      expect(destinations, piece).toContain(star);
      expect(destinations, piece).not.toContain(beyond);
      expect(attemptStarWarsMove(state, { from: "a1", to: beyond }).status, piece).toBe("illegal");
      expect(attemptStarWarsMove(state, { from: "a1", to: before }).status, piece).toBe("failed");

      const capture = attemptStarWarsMove(state, { from: "a1", to: star });
      expect(capture.status, piece).toBe("solved");
    }
  });

  it("removes invisible support kings before validating a visibly clear move", () => {
    const puzzle = hiddenSupportPuzzle();
    expect(new Chess(puzzle.fen).moves({ square: "g1", verbose: true }).map((move) => move.to)).not.toContain("g6");

    const state = initialStarWarsState(puzzle);
    const runtimePosition = new Chess(state.fen, { skipValidation: true });
    expect(runtimePosition.get("g2")).toBeUndefined();
    expect(runtimePosition.get("h8")).toBeUndefined();
    expect(starWarsLegalDestinations(state, "g1")).toContain("g6");
    const result = attemptStarWarsMove(state, { from: "g1", to: "g6" });
    expect(result.status).toBe("advanced");
    expect(result.state.remainingStars).not.toContain("g6");
    expect(new Chess(result.state.fen, { skipValidation: true }).get("g6")).toMatchObject({ color: "w", type: "q" });
  });

  it("still treats visible learner pieces as blockers", () => {
    const chess = new Chess();
    chess.clear();
    chess.put({ color: "w", type: "q" }, "g1");
    chess.put({ color: "w", type: "r" }, "g3");
    const state: StarWarsState = {
      fen: chess.fen(),
      remainingStars: ["g6"],
      movableSquares: ["g1", "g3"]
    };

    expect(starWarsLegalDestinations(state, "g1")).not.toContain("g6");
    expect(attemptStarWarsMove(state, { from: "g1", to: "g6" }).status).toBe("illegal");
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
      [0, 1, 4, 2],
      [2, 2, 5, 2],
      [5, 3, 6, 3],
      [9, 4, 7, 3]
    ] as const) {
      const puzzle = starWarsPuzzleForScore(score, 5150);
      expect(puzzle.tier).toBe(tier);
      expect(puzzle.stars).toHaveLength(stars);
      expect(puzzle.pieces).toHaveLength(pieces);
    }
  });

  it("starts with four-star routes that require planning with both pieces", () => {
    for (let variant = 0; variant < 12; variant += 1) {
      const puzzle = generateStarWarsPuzzle(0, 20_000 + variant);
      const route = findStarWarsSolution(initialStarWarsState(puzzle));
      expect(puzzle.stars, puzzle.id).toHaveLength(4);
      expect(puzzle.pieces, puzzle.id).toHaveLength(2);
      expect(route, puzzle.id).not.toBeNull();

      const pieceBySquare = new Map(puzzle.pieces.map((piece, index) => [piece.square, index] as const));
      const usedPieces = new Set<number>();
      for (const move of route ?? []) {
        const pieceIndex = pieceBySquare.get(move.from);
        expect(pieceIndex, `${puzzle.id}: ${move.from}-${move.to}`).toBeDefined();
        usedPieces.add(pieceIndex!);
        pieceBySquare.delete(move.from);
        pieceBySquare.set(move.to, pieceIndex!);
      }
      expect(usedPieces.size, puzzle.id).toBe(2);
    }
  });

});
