import { Chess } from "chess.js";

export type ExplorationPosition = {
  fen: string;
  lastMoveUci: string;
};

export type ReviewMove = ExplorationPosition & {
  san: string;
};

const UCI_MOVE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function playReviewMove(fen: string, uci: string): ReviewMove | null {
  const match = UCI_MOVE.exec(uci);
  if (!match) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from: match[1], to: match[2], promotion: match[3] });
    return move ? { fen: chess.fen(), lastMoveUci: uci, san: move.san } : null;
  } catch {
    return null;
  }
}

export function continueExploration(line: ExplorationPosition[], uci: string) {
  const current = line[line.length - 1];
  if (!current) return null;
  const move = playReviewMove(current.fen, uci);
  return move ? { move, line: [...line, { fen: move.fen, lastMoveUci: move.lastMoveUci }] } : null;
}

export function undoExploration(line: ExplorationPosition[]) {
  return line.length > 1 ? line.slice(0, -1) : line;
}

export function resetExploration(line: ExplorationPosition[]) {
  return line.length > 1 ? [line[0]] : line;
}
