import { firstStudentMoveIndex } from "./engine";
import { createPuzzleSessionToken, readPuzzleSessionToken, type OpaquePuzzleSessionToken, type PuzzleSessionToken } from "./sessionToken";
import { puzzleLevelRatingRange, type PuzzleLevelSlug } from "./types";

// A prepared board carries an encrypted server-issued solution, never client answers.
export function readPreparedNextPuzzle(token: unknown, current: PuzzleSessionToken, level: PuzzleLevelSlug, exactId?: string): OpaquePuzzleSessionToken | null {
  if (typeof token !== "string") return null;
  try {
    const next = readPuzzleSessionToken(token);
    const range = puzzleLevelRatingRange(level);
    if (next.version !== 2 || Date.parse(next.expiresAt) - Date.now() < 300_000 || next.dailyDate || current.dailyDate
      || next.studentId !== current.studentId || next.sessionId !== current.sessionId
      || next.trainingMode !== current.trainingMode || next.selectedTheme !== current.selectedTheme
      || next.woodpeckerRunId !== current.woodpeckerRunId || next.woodpeckerCycleNumber !== current.woodpeckerCycleNumber
      || next.puzzleId === current.puzzleId || (exactId && next.puzzleId !== exactId)
      || next.nextMoveIndex !== firstStudentMoveIndex(next.puzzle) || next.incorrectMoveCount !== 0 || next.hintsUsed !== 0
      || (!exactId && range && (next.puzzle.rating === null || next.puzzle.rating < range.minimum || next.puzzle.rating > range.maximum))) return null;
    return next;
  } catch { return null; } // A stale preload must not fail the solve being saved.
}

export function activatePreparedNextPuzzle(next: OpaquePuzzleSessionToken, current: PuzzleSessionToken) {
  const expiresAt = current.version === 2 && Date.parse(current.expiresAt) < Date.parse(next.expiresAt) ? current.expiresAt : next.expiresAt;
  return { id: next.puzzleId, token: createPuzzleSessionToken({ ...next, startedAt: new Date().toISOString(), expiresAt }) };
}
