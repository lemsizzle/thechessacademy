import { Chess } from "chess.js";
import {
  applyUciMove,
  firstStudentMoveIndex,
  replayPuzzleToIndex
} from "@/lib/puzzle-training/engine";
import type { PuzzleSessionPuzzle } from "@/lib/puzzle-training/types";

const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export type SurvivalReviewPosition = {
  sourcePly: number;
  moveNumber: number;
  color: "white" | "black";
  fen: string;
  playedMoveSan: string;
  playedMoveUci: string;
  bestMoveSan: string;
  bestMoveUci: string;
  acceptedMovesUci: string[];
  bestLineSan: string;
  explanation: string;
  solutionExplanation: string;
};

function uciForMove(move: { from: string; to: string; promotion?: string }) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function acceptedMoves(puzzle: PuzzleSessionPuzzle, nextMoveIndex: number, position: Chess) {
  const expectedMove = puzzle.moves[nextMoveIndex];
  const accepted = new Set<string>([expectedMove]);
  if (nextMoveIndex === firstStudentMoveIndex(puzzle) && puzzle.start_mode === "direct") {
    puzzle.accepted_moves.filter((move) => UCI_PATTERN.test(move)).forEach((move) => accepted.add(move));
  }
  if (nextMoveIndex === firstStudentMoveIndex(puzzle) && puzzle.themes.includes("mateIn1")) {
    for (const move of position.moves({ verbose: true })) {
      const candidate = new Chess(position.fen());
      candidate.move({ from: move.from, to: move.to, promotion: move.promotion });
      if (candidate.isCheckmate()) accepted.add(uciForMove(move));
    }
  }
  return [...accepted].slice(0, 12);
}

function solutionLine(puzzle: PuzzleSessionPuzzle, nextMoveIndex: number, position: Chess) {
  const line = new Chess(position.fen());
  const san: string[] = [];
  for (let index = nextMoveIndex; index < puzzle.moves.length && san.length < 10; index += 1) {
    san.push(applyUciMove(line, puzzle.moves[index]).san);
  }
  return san.join(" ");
}

export function buildSurvivalReviewPosition(input: {
  puzzle: PuzzleSessionPuzzle;
  nextMoveIndex: number;
  attemptedMoveUci?: string;
  attemptedMoveSan?: string;
}): SurvivalReviewPosition {
  const position = replayPuzzleToIndex(input.puzzle, input.nextMoveIndex);
  const fen = position.fen();
  const bestMoveUci = input.puzzle.moves[input.nextMoveIndex];
  const bestMoveSan = applyUciMove(new Chess(fen), bestMoveUci).san;
  const themes = input.puzzle.themes.slice(0, 3).join(", ");

  return {
    sourcePly: input.nextMoveIndex + 1,
    moveNumber: Math.max(1, Number(fen.split(" ")[5]) || 1),
    color: position.turn() === "w" ? "white" : "black",
    fen,
    playedMoveSan: input.attemptedMoveSan?.slice(0, 32) ?? "",
    playedMoveUci: input.attemptedMoveUci?.toLowerCase() ?? "",
    bestMoveSan: bestMoveSan.slice(0, 32),
    bestMoveUci,
    acceptedMovesUci: acceptedMoves(input.puzzle, input.nextMoveIndex, position),
    bestLineSan: solutionLine(input.puzzle, input.nextMoveIndex, position).slice(0, 500),
    explanation: "This position cost a life in Survival. Find the move that keeps the solution going.",
    solutionExplanation: `The key move is ${bestMoveSan}.${themes ? ` Look for the ${themes} idea in the continuation.` : " Follow the forcing continuation."}`
  };
}
