import { Chess, type Move, type Square } from "chess.js";
import { blackPiecesRemaining, findUnprotectedBlackCapture, hasUnprotectedBlackCapture } from "@/adventure/fundamentals";
import { hasPlayableStarTrailMove, keepWhiteToMove } from "@/adventure/starTrail";
import type { AdventurePuzzle } from "@/adventure/types";

export type AdventureHintMove = { from: string; to: string };

const MAX_CAPTURE_HINT_STATES = 1_500;

function visibleLegalMoves(chess: Chess, movableSquares: readonly string[]) {
  return chess.moves({ verbose: true })
    .filter((move) => movableSquares.includes(move.from) && move.captured !== "k");
}

function play(chess: Chess, move: Move) {
  const next = new Chess(chess.fen());
  next.move({ from: move.from, to: move.to, promotion: move.promotion });
  return next;
}

function updatedMovableSquares(movableSquares: readonly string[], move: Move) {
  return [...movableSquares.filter((square) => square !== move.from), move.to];
}

function configuredHintMove(puzzle: AdventurePuzzle, chess: Chess, movableSquares: readonly string[]) {
  const expected = puzzle.expectedMove;
  if (expected) {
    const isLegal = chess.moves({ square: expected.from as Square, verbose: true })
      .some((move) => move.to === expected.to);
    if (isLegal) return expected;
  }

  const arrows = puzzle.starTrail?.hintArrows ?? puzzle.hintArrows ?? [];
  for (const arrow of arrows) {
    if (arrow.color === "#fb7185" || !movableSquares.includes(arrow.from)) continue;
    const isLegal = chess.moves({ square: arrow.from as Square, verbose: true })
      .some((move) => move.to === arrow.to);
    if (isLegal) return { from: arrow.from, to: arrow.to };
  }

  return null;
}

function starTrailHintMove(
  puzzle: AdventurePuzzle,
  chess: Chess,
  movableSquares: readonly string[],
  remainingStars: readonly string[]
) {
  const candidates = visibleLegalMoves(chess, movableSquares)
    .filter((move) => !(move.piece === "p" && remainingStars.includes(move.to) && move.from[0] === move.to[0]))
    .map((move) => {
      const next = play(chess, move);
      const collectedStar = remainingStars.includes(move.to) && (move.piece !== "p" || Boolean(move.captured));
      const nextStars = collectedStar ? remainingStars.filter((square) => square !== move.to) : [...remainingStars];
      const nextMovableSquares = updatedMovableSquares(movableSquares, move);
      const nextFen = keepWhiteToMove(next.fen());
      const routeContinues = nextStars.length === 0
        || hasPlayableStarTrailMove(puzzle, nextFen, nextMovableSquares, nextStars);
      return { move, collectedStar, routeContinues };
    })
    .filter((candidate) => candidate.routeContinues)
    .sort((left, right) => Number(right.collectedStar) - Number(left.collectedStar));

  const best = candidates[0]?.move;
  return best ? { from: best.from, to: best.to } : null;
}

function captureAllHintMove(puzzle: AdventurePuzzle, chess: Chess, movableSquares: readonly string[]) {
  type SearchState = { fen: string; movableSquares: string[]; firstMove: AdventureHintMove | null; depth: number };
  const maximumDepth = Math.max(4, (puzzle.fundamental?.parMoves ?? 1) + 2);
  const queue: SearchState[] = [{ fen: chess.fen(), movableSquares: [...movableSquares], firstMove: null, depth: 0 }];
  let queueIndex = 0;
  const visited = new Set<string>();
  let inspectedStates = 0;

  while (queueIndex < queue.length && inspectedStates < MAX_CAPTURE_HINT_STATES) {
    const state = queue[queueIndex];
    queueIndex += 1;
    const stateKey = `${state.fen.split(" ").slice(0, 4).join(" ")}|${state.movableSquares.slice().sort().join(",")}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);
    inspectedStates += 1;

    const position = new Chess(state.fen);
    const candidates = visibleLegalMoves(position, state.movableSquares)
      .sort((left, right) => Number(Boolean(right.captured)) - Number(Boolean(left.captured)));

    for (const candidate of candidates) {
      const next = play(position, candidate);
      if (findUnprotectedBlackCapture(next, puzzle.opponentSquares)) continue;
      const firstMove = state.firstMove ?? { from: candidate.from, to: candidate.to };
      if (blackPiecesRemaining(next) === 0) return firstMove;
      if (state.depth + 1 >= maximumDepth) continue;
      queue.push({
        fen: keepWhiteToMove(next.fen()),
        movableSquares: updatedMovableSquares(state.movableSquares, candidate),
        firstMove,
        depth: state.depth + 1
      });
    }
  }

  return null;
}

function fundamentalHintMove(puzzle: AdventurePuzzle, chess: Chess, movableSquares: readonly string[]) {
  const goal = puzzle.fundamental?.goal;
  if (!goal) return null;
  if (goal === "capture-all") return captureAllHintMove(puzzle, chess, movableSquares);

  for (const candidate of visibleLegalMoves(chess, movableSquares)) {
    const next = play(chess, candidate);
    const reachesGoal = goal === "safe-move"
      ? !hasUnprotectedBlackCapture(next, puzzle.opponentSquares)
      : goal === "escape-check"
        ? !next.isCheck()
        : goal === "check"
          ? next.isCheck()
          : next.isCheckmate();
    if (reachesGoal) return { from: candidate.from, to: candidate.to };
  }

  return null;
}

/** Returns one legal, lesson-valid move for the board's current position. */
export function findAdventureHintMove(
  puzzle: AdventurePuzzle,
  fen: string,
  movableSquares: readonly string[],
  remainingStars: readonly string[] = []
): AdventureHintMove | null {
  const chess = new Chess(fen);
  const configured = configuredHintMove(puzzle, chess, movableSquares);
  if (configured) return configured;
  if (puzzle.starTrail) return starTrailHintMove(puzzle, chess, movableSquares, remainingStars);
  if (puzzle.fundamental) return fundamentalHintMove(puzzle, chess, movableSquares);
  return null;
}
