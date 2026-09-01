import "server-only";

import { Chess } from "chess.js";
import type { MistakePuzzle } from "@/chess/analysis/mistakes";
import type { AdaptiveReviewOutcome, AdaptiveReviewStatus } from "@/chess/training/adaptiveReview";
import { buildSurvivalReviewPosition } from "@/chess/training/survivalReview";
import { firstStudentMoveIndex } from "@/lib/puzzle-training/engine";
import type { PuzzleSessionPuzzle } from "@/lib/puzzle-training/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MAX_REVIEW_ITEMS_PER_GAME = 100;
const MAX_SURVIVAL_HISTORY = 500;

export type AdaptiveReviewSourceKind = "game" | "survival";

export type AdaptiveReviewItem = {
  id: string;
  sourceKind: AdaptiveReviewSourceKind;
  sourceGameId: string | null;
  sourcePuzzleId: string | null;
  sourcePly: number;
  moveNumber: number;
  color: "white" | "black";
  fen: string;
  playedMoveSan: string;
  playedMoveUci: string;
  explanation: string;
  centipawnLoss: number;
  severity: "mistake" | "blunder";
  status: AdaptiveReviewStatus;
  repetitions: number;
  intervalDays: number;
  attemptCount: number;
  correctCount: number;
  nextReviewAt: string;
};

export type AdaptiveReviewSummary = {
  total: number;
  due: number;
  learning: number;
  review: number;
  mastered: number;
  attempts: number;
  correct: number;
  accuracy: number;
};

type ReviewItemRow = {
  id: string;
  source_kind: AdaptiveReviewSourceKind;
  source_game_id: string | null;
  source_puzzle_id: string | null;
  source_ply: number;
  move_number: number;
  color: "white" | "black";
  fen: string;
  played_move_san: string;
  played_move_uci: string;
  explanation: string;
  centipawn_loss: number;
  severity: "mistake" | "blunder";
  status: AdaptiveReviewStatus;
  repetitions: number;
  interval_days: number;
  attempt_count: number;
  correct_count: number;
  next_review_at: string;
};

const reviewItemSelect = "id,source_kind,source_game_id,source_puzzle_id,source_ply,move_number,color,fen,played_move_san,played_move_uci,explanation,centipawn_loss,severity,status,repetitions,interval_days,attempt_count,correct_count,next_review_at";
const survivalPuzzleSelect = "id,initial_fen,moves,start_mode,accepted_moves,themes,rating,game_url";

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Adaptive training requires Supabase service access.");
  return client;
}

function mapReviewItem(row: ReviewItemRow): AdaptiveReviewItem {
  return {
    id: row.id,
    sourceKind: row.source_kind,
    sourceGameId: row.source_game_id,
    sourcePuzzleId: row.source_puzzle_id,
    sourcePly: row.source_ply,
    moveNumber: row.move_number,
    color: row.color,
    fen: row.fen,
    playedMoveSan: row.played_move_san,
    playedMoveUci: row.played_move_uci,
    explanation: row.explanation,
    centipawnLoss: row.centipawn_loss,
    severity: row.severity,
    status: row.status,
    repetitions: row.repetitions,
    intervalDays: row.interval_days,
    attemptCount: row.attempt_count,
    correctCount: row.correct_count,
    nextReviewAt: row.next_review_at
  };
}

function legalUci(fen: string, uci: string) {
  if (!UCI_PATTERN.test(uci)) return false;
  try {
    const move = new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return Boolean(move);
  } catch {
    return false;
  }
}

function reviewPayload(studentId: string, gameId: string, puzzle: MistakePuzzle) {
  if (!Number.isInteger(puzzle.ply) || puzzle.ply < 1) throw new Error("A review position has an invalid move number.");
  if (!puzzle.fen || new Chess(puzzle.fen).turn() !== (puzzle.color === "white" ? "w" : "b")) {
    throw new Error("A review position has an invalid side to move.");
  }
  const accepted = [...new Set(puzzle.acceptedMovesUci)].filter((move) => legalUci(puzzle.fen, move));
  if (!accepted.length || !accepted.includes(puzzle.bestMoveUci)) throw new Error("A review position has no valid solution.");
  if (!legalUci(puzzle.fen, puzzle.playedMoveUci)) throw new Error("A review position has an invalid game move.");
  return {
    student_id: studentId,
    source_kind: "game",
    source_game_id: gameId,
    source_puzzle_id: null,
    source_ply: puzzle.ply,
    move_number: puzzle.moveNumber,
    color: puzzle.color,
    fen: puzzle.fen,
    played_move_san: puzzle.playedMoveSan.slice(0, 32),
    played_move_uci: puzzle.playedMoveUci,
    best_move_san: puzzle.bestMoveSan.slice(0, 32),
    best_move_uci: puzzle.bestMoveUci,
    accepted_moves_uci: accepted,
    best_line_san: puzzle.bestLineSan.slice(0, 500),
    explanation: puzzle.explanation.slice(0, 1200),
    solution_explanation: puzzle.solutionExplanation.slice(0, 1200),
    centipawn_loss: Math.max(0, Math.round(puzzle.centipawnLoss)),
    severity: puzzle.severity === "blunder" ? "blunder" : "mistake",
    is_active: true
  };
}

function survivalReviewPayload(input: {
  studentId: string;
  puzzle: PuzzleSessionPuzzle;
  nextMoveIndex: number;
  attemptedMoveUci?: string;
  attemptedMoveSan?: string;
}) {
  const review = buildSurvivalReviewPosition(input);
  return {
    student_id: input.studentId,
    source_kind: "survival",
    source_game_id: null,
    source_puzzle_id: input.puzzle.id,
    source_ply: review.sourcePly,
    move_number: review.moveNumber,
    color: review.color,
    fen: review.fen,
    played_move_san: review.playedMoveSan,
    played_move_uci: review.playedMoveUci,
    best_move_san: review.bestMoveSan,
    best_move_uci: review.bestMoveUci,
    accepted_moves_uci: review.acceptedMovesUci,
    best_line_san: review.bestLineSan,
    explanation: review.explanation,
    solution_explanation: review.solutionExplanation,
    centipawn_loss: 0,
    severity: "mistake",
    is_active: true
  };
}

export async function saveSurvivalReviewMistake(input: {
  studentId: string;
  puzzle: PuzzleSessionPuzzle;
  nextMoveIndex: number;
  attemptedMoveUci: string;
  attemptedMoveSan: string;
}) {
  const record = {
    ...survivalReviewPayload(input),
    status: "learning",
    repetitions: 0,
    interval_days: 0,
    next_review_at: new Date().toISOString(),
    mastered_at: null
  };
  const { error } = await serviceClient()
    .from("adaptive_review_items")
    .upsert(record, { onConflict: "student_id,source_puzzle_id,source_ply" });
  if (error) throw new Error(error.message);
}

async function syncSurvivalMistakesToAdaptiveReview(studentId: string) {
  const client = serviceClient();
  const { data: attempts, error: attemptsError } = await client
    .from("student_puzzle_attempts")
    .select("puzzle_id")
    .eq("student_id", studentId)
    .eq("training_mode", "survival")
    .gt("incorrect_move_count", 0)
    .order("attempted_at", { ascending: false })
    .limit(MAX_SURVIVAL_HISTORY);
  if (attemptsError) throw new Error(attemptsError.message);

  const puzzleIds = [...new Set(((attempts ?? []) as Array<{ puzzle_id: string }>).map((attempt) => attempt.puzzle_id))];
  if (!puzzleIds.length) return;
  const [{ data: existing, error: existingError }, { data: puzzles, error: puzzlesError }] = await Promise.all([
    client
      .from("adaptive_review_items")
      .select("source_puzzle_id,source_ply")
      .eq("student_id", studentId)
      .eq("source_kind", "survival")
      .in("source_puzzle_id", puzzleIds),
    client
      .from("chess_puzzles")
      .select(survivalPuzzleSelect)
      .in("id", puzzleIds)
  ]);
  if (existingError) throw new Error(existingError.message);
  if (puzzlesError) throw new Error(puzzlesError.message);

  const existingKeys = new Set(((existing ?? []) as Array<{ source_puzzle_id: string; source_ply: number }>).map(
    (row) => `${row.source_puzzle_id}:${row.source_ply}`
  ));
  const records = ((puzzles ?? []) as PuzzleSessionPuzzle[]).flatMap((puzzle) => {
    const nextMoveIndex = firstStudentMoveIndex(puzzle);
    if (existingKeys.has(`${puzzle.id}:${nextMoveIndex + 1}`)) return [];
    try {
      return [survivalReviewPayload({ studentId, puzzle, nextMoveIndex })];
    } catch (error) {
      console.error(JSON.stringify({
        event: "survival_review_backfill_position_failed",
        studentId,
        puzzleId: puzzle.id,
        error: error instanceof Error ? error.message : String(error)
      }));
      return [];
    }
  });
  if (!records.length) return;
  const { error } = await client
    .from("adaptive_review_items")
    .upsert(records, { onConflict: "student_id,source_puzzle_id,source_ply" });
  if (error) throw new Error(error.message);
}

export async function saveAdaptiveReviewItems(studentId: string, gameId: string, puzzles: MistakePuzzle[]) {
  if (!UUID_PATTERN.test(gameId)) throw new Error("Invalid game id.");
  if (puzzles.length > MAX_REVIEW_ITEMS_PER_GAME) throw new Error("Too many review positions were submitted.");
  const client = serviceClient();
  const { data: game, error: gameError } = await client
    .from("internal_chess_games")
    .select("id,player_id")
    .eq("id", gameId)
    .eq("player_id", studentId)
    .maybeSingle();
  if (gameError) throw new Error(gameError.message);
  if (!game) throw new Error("Game not found for this student.");

  if (!puzzles.length) {
    const { error: archiveError } = await client
      .from("adaptive_review_items")
      .update({ is_active: false })
      .eq("student_id", studentId)
      .eq("source_kind", "game")
      .eq("source_game_id", gameId);
    if (archiveError) throw new Error(archiveError.message);
    return { saved: 0 };
  }

  const records = puzzles.map((puzzle) => reviewPayload(studentId, gameId, puzzle));
  const { error } = await client
    .from("adaptive_review_items")
    .upsert(records, { onConflict: "student_id,source_game_id,source_ply" });
  if (error) throw new Error(error.message);
  const activePlyList = `(${records.map((record) => record.source_ply).join(",")})`;
  const { error: archiveError } = await client
    .from("adaptive_review_items")
    .update({ is_active: false })
    .eq("student_id", studentId)
    .eq("source_kind", "game")
    .eq("source_game_id", gameId)
    .not("source_ply", "in", activePlyList);
  if (archiveError) throw new Error(archiveError.message);
  return { saved: records.length };
}

export async function getStudentAdaptiveReview(studentId: string, limit = 20) {
  const client = serviceClient();
  try {
    await syncSurvivalMistakesToAdaptiveReview(studentId);
  } catch (error) {
    console.error(JSON.stringify({
      event: "survival_review_backfill_failed",
      studentId,
      error: error instanceof Error ? error.message : String(error)
    }));
  }
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("adaptive_review_items")
    .select(reviewItemSelect)
    .eq("student_id", studentId)
    .eq("is_active", true)
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true })
    .order("centipawn_loss", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error) throw new Error(error.message);

  const { data: stats, error: statsError } = await client
    .from("adaptive_review_items")
    .select("status,attempt_count,correct_count,next_review_at")
    .eq("student_id", studentId)
    .eq("is_active", true);
  if (statsError) throw new Error(statsError.message);
  const rows = (stats ?? []) as Array<{ status: AdaptiveReviewStatus; attempt_count: number; correct_count: number; next_review_at: string }>;
  const attempts = rows.reduce((sum, row) => sum + row.attempt_count, 0);
  const correct = rows.reduce((sum, row) => sum + row.correct_count, 0);
  const summary: AdaptiveReviewSummary = {
    total: rows.length,
    due: rows.filter((row) => row.next_review_at <= now).length,
    learning: rows.filter((row) => row.status === "learning").length,
    review: rows.filter((row) => row.status === "review").length,
    mastered: rows.filter((row) => row.status === "mastered").length,
    attempts,
    correct,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0
  };
  return { items: ((data ?? []) as ReviewItemRow[]).map(mapReviewItem), summary };
}

export async function recordAdaptiveReviewAttempt(input: {
  studentId: string;
  itemId: string;
  moveUci?: string;
  reveal?: boolean;
  responseMs?: number;
}) {
  if (!UUID_PATTERN.test(input.itemId)) throw new Error("Invalid review item id.");
  const client = serviceClient();
  const { data, error } = await client
    .from("adaptive_review_items")
    .select("id,fen,best_move_san,best_move_uci,accepted_moves_uci,solution_explanation,best_line_san")
    .eq("id", input.itemId)
    .eq("student_id", input.studentId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Review item not found.");
  const row = data as { fen: string; best_move_san: string; best_move_uci: string; accepted_moves_uci: string[]; solution_explanation: string; best_line_san: string };

  let outcome: AdaptiveReviewOutcome;
  let moveUci: string | null = null;
  if (input.reveal) {
    outcome = "revealed";
  } else {
    moveUci = input.moveUci?.toLowerCase() ?? "";
    if (!legalUci(row.fen, moveUci)) throw new Error("That move is not legal in this position.");
    outcome = row.accepted_moves_uci.includes(moveUci) ? "correct" : "incorrect";
  }

  const responseMs = input.responseMs === undefined ? null : Math.min(3_600_000, Math.max(0, Math.round(input.responseMs)));
  const { data: schedule, error: scheduleError } = await client.rpc("record_adaptive_review_attempt", {
    p_student_id: input.studentId,
    p_review_item_id: input.itemId,
    p_outcome: outcome,
    p_attempted_move_uci: moveUci,
    p_response_ms: responseMs
  });
  if (scheduleError) throw new Error(scheduleError.message);
  return {
    outcome,
    bestMoveSan: row.best_move_san,
    bestMoveUci: row.best_move_uci,
    solutionExplanation: row.solution_explanation,
    bestLineSan: row.best_line_san,
    schedule
  };
}

export type AdminAdaptiveReviewStudent = {
  studentId: string;
  name: string;
  classGroup: string;
  total: number;
  due: number;
  learning: number;
  mastered: number;
  attempts: number;
  correct: number;
  accuracy: number;
  lastReviewedAt: string | null;
};

export async function getAdminAdaptiveReviewReport(): Promise<AdminAdaptiveReviewStudent[]> {
  const client = serviceClient();
  const [{ data: students, error: studentsError }, { data: items, error: itemsError }] = await Promise.all([
    client.from("students").select("id,name,class_group").eq("is_active", true).order("name"),
    client.from("adaptive_review_items").select("student_id,status,next_review_at,attempt_count,correct_count,last_reviewed_at").eq("is_active", true)
  ]);
  if (studentsError) throw new Error(studentsError.message);
  if (itemsError) throw new Error(itemsError.message);
  const now = new Date().toISOString();
  const itemRows = (items ?? []) as Array<{ student_id: string; status: AdaptiveReviewStatus; next_review_at: string; attempt_count: number; correct_count: number; last_reviewed_at: string | null }>;
  return ((students ?? []) as Array<{ id: string; name: string; class_group: string }>).map((student) => {
    const owned = itemRows.filter((item) => item.student_id === student.id);
    const attempts = owned.reduce((sum, item) => sum + item.attempt_count, 0);
    const correct = owned.reduce((sum, item) => sum + item.correct_count, 0);
    return {
      studentId: student.id,
      name: student.name,
      classGroup: student.class_group,
      total: owned.length,
      due: owned.filter((item) => item.next_review_at <= now).length,
      learning: owned.filter((item) => item.status === "learning").length,
      mastered: owned.filter((item) => item.status === "mastered").length,
      attempts,
      correct,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
      lastReviewedAt: owned.map((item) => item.last_reviewed_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
    };
  });
}
