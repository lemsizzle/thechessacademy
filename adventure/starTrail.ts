import { Chess, type Square } from "chess.js";
import type { AdventurePuzzle, AdventurePuzzleRating } from "@/adventure/types";

const routeStatusMaps = new Map<string, Map<string, boolean>>();
const pawnPromotionRouteCache = new Map<string, boolean>();
const MAX_ROUTE_STATES_PER_PUZZLE = 128;
const MAX_PROMOTION_ROUTE_STATES = 512;

export function keepWhiteToMove(fen: string) {
  const fields = fen.split(" ");
  fields[1] = "w";
  fields[3] = "-";
  return fields.join(" ");
}

function positionKey(fen: string, pieceSquares: string[], remainingStars: string[]) {
  return `${fen.split(" ").slice(0, 4).join(" ")}|${pieceSquares.slice().sort().join(",")}|${remainingStars.slice().sort().join(",")}`;
}

function sameSquareColor(left: string, right: string) {
  const color = (square: string) => (square.charCodeAt(0) - 97 + Number(square[1])) % 2;
  return color(left) === color(right);
}

function pawnCanReachPromotion(fen: string, square: string, remainingStars: string[]) {
  const cacheKey = `${fen.split(" ").slice(0, 4).join(" ")}|${square}|${remainingStars.slice().sort().join(",")}`;
  const cached = pawnPromotionRouteCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const stack = [{ fen, square }];
  const visited = new Set<string>();

  while (stack.length) {
    const state = stack.pop();
    if (!state) break;
    const stateKey = `${state.fen.split(" ").slice(0, 4).join(" ")}|${state.square}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const chess = new Chess(state.fen);
    const pawn = chess.get(state.square as Square);
    if (!pawn || pawn.type !== "p" || pawn.color !== "w") continue;

    for (const candidate of chess.moves({ square: state.square as Square, verbose: true })) {
      const walksIntoStar = remainingStars.includes(candidate.to) && candidate.from[0] === candidate.to[0];
      if (walksIntoStar || candidate.captured === "k") continue;
      if (candidate.promotion) {
        if (pawnPromotionRouteCache.size >= MAX_PROMOTION_ROUTE_STATES) pawnPromotionRouteCache.clear();
        pawnPromotionRouteCache.set(cacheKey, true);
        return true;
      }
      const next = new Chess(state.fen);
      next.move({ from: candidate.from, to: candidate.to });
      stack.push({ fen: keepWhiteToMove(next.fen()), square: candidate.to });
    }
  }

  if (pawnPromotionRouteCache.size >= MAX_PROMOTION_ROUTE_STATES) pawnPromotionRouteCache.clear();
  pawnPromotionRouteCache.set(cacheKey, false);
  return false;
}

function isFastRouteStillPossible(fen: string, pieceSquares: string[], remainingStars: string[]) {
  const chess = new Chess(fen);
  const lessonPieces = pieceSquares.flatMap((square) => {
    const piece = chess.get(square as Square);
    return piece?.color === "w" ? [{ square, type: piece.type }] : [];
  });
  const nonPawnPieces = lessonPieces.filter((piece) => piece.type !== "p");
  const starIsCovered = (star: string) => nonPawnPieces.some((piece) => {
    if (piece.type === "b") return sameSquareColor(piece.square, star);
    return true;
  });
  const uncoveredStars = remainingStars.filter((star) => !starIsCovered(star));
  if (!uncoveredStars.length) return true;

  const pawns = lessonPieces.filter((piece) => piece.type === "p");
  if (pawns.some((pawn) => pawnCanReachPromotion(fen, pawn.square, remainingStars))) return true;

  // A non-promoting pawn may still finish a short capture-only lesson such as
  // Pawn 3. If no real diagonal star capture remains, the attempt is stuck.
  return pawns.some((pawn) => chess.moves({ square: pawn.square as Square, verbose: true }).some((move) => (
    remainingStars.includes(move.to) && move.from[0] !== move.to[0] && Boolean(move.captured)
  )));
}

/**
 * Uses a compact, memoized route-state map instead of searching thousands of
 * future board positions after every learner move.
 */
export function hasPlayableStarTrailMove(puzzle: AdventurePuzzle, fen: string, pieceSquares: string[], remainingStars: string[]) {
  if (!puzzle.starTrail || !remainingStars.length) return true;
  const stateKey = positionKey(fen, pieceSquares, remainingStars);
  const routeMap = routeStatusMaps.get(puzzle.id) ?? new Map<string, boolean>();
  routeStatusMaps.set(puzzle.id, routeMap);
  const cached = routeMap.get(stateKey);
  if (cached !== undefined) return cached;

  const playable = isFastRouteStillPossible(fen, pieceSquares, remainingStars);
  if (routeMap.size >= MAX_ROUTE_STATES_PER_PUZZLE) routeMap.clear();
  routeMap.set(stateKey, playable);
  return playable;
}

export function starTrailRating(moves: number, minimumMoves: number): AdventurePuzzleRating["stars"] {
  if (moves <= minimumMoves) return 3;
  if (moves <= minimumMoves + 2) return 2;
  return 1;
}
