import type { GameMove } from "@/chess/types";

export function replayFenAtPly(initialFen: string, moves: GameMove[], ply: number) {
  const boundedPly = Math.max(0, Math.min(Math.trunc(ply), moves.length));
  return boundedPly === 0 ? initialFen : moves[boundedPly - 1]?.fenAfter ?? initialFen;
}

export function stepReplayPly(selectedPly: number | null, direction: -1 | 1, moveCount: number) {
  const currentPly = selectedPly ?? moveCount;
  const nextPly = Math.max(0, Math.min(currentPly + direction, moveCount));
  return nextPly === moveCount ? null : nextPly;
}
