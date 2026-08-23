import { Chess, type Move, type Square } from "chess.js";
import type { ChessPuzzleRow, LichessPuzzleTheme, PuzzleMoveInput, PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const UCI_PATTERN = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

export function parseUciMove(uci: string): PuzzleMoveInput {
  const match = UCI_PATTERN.exec(uci.trim());
  if (!match) throw new Error(`Invalid UCI move: ${uci}`);
  return { from: match[1], to: match[2], promotion: match[3] as PuzzleMoveInput["promotion"] };
}

export function applyUciMove(chess: Chess, uci: string): Move {
  const parsed = parseUciMove(uci);
  const move = chess.move(parsed);
  if (!move) throw new Error(`Illegal UCI move ${uci} for ${chess.fen()}`);
  return move;
}

export function validateLichessPuzzle(initialFen: string, moves: string[]) {
  if (moves.length < 2 || moves.length % 2 !== 0) throw new Error("A Lichess puzzle must contain a setup move and end on a student move.");
  const chess = new Chess(initialFen);
  for (const move of moves) applyUciMove(chess, move);
  return true;
}

export function prepareLichessPuzzle(initialFen: string, moves: string[]) {
  if (moves.length < 2) throw new Error("Puzzle has no student solution move.");
  const chess = new Chess(initialFen);
  applyUciMove(chess, moves[0]);
  return {
    displayFen: chess.fen(),
    orientation: chess.turn() === "w" ? "white" as const : "black" as const,
    sideToMove: chess.turn() === "w" ? "White" as const : "Black" as const,
    firstStudentMove: moves[1]
  };
}

export function firstStudentMoveIndex(puzzle: Pick<ChessPuzzleRow, "start_mode">) {
  return puzzle.start_mode === "direct" ? 0 : 1;
}

export function prepareTrainingPuzzle(puzzle: Pick<ChessPuzzleRow, "initial_fen" | "moves" | "start_mode">) {
  if (puzzle.start_mode === "after_setup") return prepareLichessPuzzle(puzzle.initial_fen, puzzle.moves);
  if (!puzzle.moves.length) throw new Error("Puzzle has no student solution move.");
  const chess = new Chess(puzzle.initial_fen);
  return {
    displayFen: chess.fen(),
    orientation: chess.turn() === "w" ? "white" as const : "black" as const,
    sideToMove: chess.turn() === "w" ? "White" as const : "Black" as const,
    firstStudentMove: puzzle.moves[0]
  };
}

export function replayPuzzleToIndex(puzzle: Pick<ChessPuzzleRow, "initial_fen" | "moves">, nextMoveIndex: number) {
  const startMode = "start_mode" in puzzle ? puzzle.start_mode : "after_setup";
  const firstIndex = startMode === "direct" ? 0 : 1;
  if (nextMoveIndex < firstIndex || nextMoveIndex >= puzzle.moves.length || (nextMoveIndex - firstIndex) % 2 !== 0) {
    throw new Error("Puzzle token is not on a student move.");
  }
  const chess = new Chess(puzzle.initial_fen);
  for (let index = 0; index < nextMoveIndex; index += 1) applyUciMove(chess, puzzle.moves[index]);
  return chess;
}

function normalizedCandidate(input: PuzzleMoveInput, expected: PuzzleMoveInput) {
  const promotion = input.promotion ?? (input.from === expected.from && input.to === expected.to ? expected.promotion : undefined);
  return { from: input.from, to: input.to, promotion };
}

export function validatePuzzleMove(puzzle: ChessPuzzleRow, nextMoveIndex: number, input: PuzzleMoveInput) {
  const chess = replayPuzzleToIndex(puzzle, nextMoveIndex);
  const expectedUci = puzzle.moves[nextMoveIndex];
  const expected = parseUciMove(expectedUci);
  const candidate = normalizedCandidate(input, expected);
  let candidateMove: Move;

  try {
    candidateMove = chess.move(candidate);
  } catch {
    return { accepted: false, completed: false, positionFen: chess.fen(), nextMoveIndex };
  }

  const candidateUci = `${candidateMove.from}${candidateMove.to}${candidateMove.promotion ?? ""}`;
  const firstIndex = firstStudentMoveIndex(puzzle);
  const acceptedStudyMove = nextMoveIndex === firstIndex && puzzle.start_mode === "direct" && puzzle.accepted_moves.includes(candidateUci);
  const alternateMate = nextMoveIndex === firstIndex && puzzle.themes.includes("mateIn1") && chess.isCheckmate();
  if (candidateUci !== expectedUci && !acceptedStudyMove && !alternateMate) {
    return { accepted: false, completed: false, positionFen: replayPuzzleToIndex(puzzle, nextMoveIndex).fen(), nextMoveIndex };
  }

  const studentFen = chess.fen();
  if (alternateMate || nextMoveIndex === puzzle.moves.length - 1) {
    return { accepted: true, completed: true, positionFen: studentFen, studentFen, nextMoveIndex: puzzle.moves.length };
  }

  const opponentMove = puzzle.moves[nextMoveIndex + 1];
  applyUciMove(chess, opponentMove);
  const followingIndex = nextMoveIndex + 2;
  if (followingIndex >= puzzle.moves.length) throw new Error("Puzzle sequence ended on an opponent move.");
  return { accepted: true, completed: false, positionFen: chess.fen(), studentFen, opponentMove, nextMoveIndex: followingIndex };
}

export function legalDestinations(fen: string, source: string): string[] {
  const chess = new Chess(fen);
  return chess.moves({ square: source as Square, verbose: true }).map((move) => move.to);
}

export function premoveDestinations(fen: string, source: string, studentColor: "w" | "b"): string[] {
  const fields = fen.split(" ");
  if (fields.length !== 6) return [];
  fields[1] = studentColor;
  fields[3] = "-";
  try {
    return legalDestinations(fields.join(" "), source);
  } catch {
    return [];
  }
}

export function filterPuzzlesByTheme<T extends { themes: string[] }>(puzzles: T[], theme: PuzzleThemeSlug) {
  if (theme === "mixed") return puzzles.filter((puzzle) => puzzle.themes.some((tag) => (lichessThemeSet as Set<string>).has(tag)));
  return puzzles.filter((puzzle) => puzzle.themes.includes(theme));
}

const lichessThemeSet = new Set<LichessPuzzleTheme>(["fork", "pin", "skewer", "mateIn1"]);
