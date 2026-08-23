import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { QuestWindow } from "@/lib/quests/timeWindows";
import type { InternalQuestGameActivity, InternalQuestPuzzleActivity } from "@/lib/quests/evaluateInternalQuest";

const PAGE_SIZE = 1000;

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Supabase service access is not configured.");
  return client;
}

export async function loadInternalQuestGames(studentId: string, window: QuestWindow) {
  const rows: Array<{ id: string; completed_at: string; opponent_type: "computer" | "student"; opponent_id: string; result: "win" | "loss" | "draw" }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceClient()
      .from("internal_chess_games")
      .select("id,completed_at,opponent_type,opponent_id,result")
      .eq("player_id", studentId)
      .gte("completed_at", window.start.toISOString())
      .lte("completed_at", window.end.toISOString())
      .order("completed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as typeof rows;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.map((row): InternalQuestGameActivity => ({
    id: row.id,
    completedAt: row.completed_at,
    opponentType: row.opponent_type,
    opponentId: row.opponent_id,
    result: row.result
  }));
}

type PuzzleAttemptRow = {
  id: string;
  attempted_at: string;
  solved: boolean;
  first_try_correct: boolean;
  selected_theme: string;
  chess_puzzles: { themes?: string[] | null } | Array<{ themes?: string[] | null }> | null;
};

function puzzleThemes(row: PuzzleAttemptRow) {
  if (Array.isArray(row.chess_puzzles)) return row.chess_puzzles.flatMap((puzzle) => puzzle.themes ?? []);
  return row.chess_puzzles?.themes ?? [];
}

export async function loadInternalQuestPuzzles(studentId: string, window: QuestWindow) {
  const rows: PuzzleAttemptRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceClient()
      .from("student_puzzle_attempts")
      .select("id,attempted_at,solved,first_try_correct,selected_theme,chess_puzzles(themes)")
      .eq("student_id", studentId)
      .gte("attempted_at", window.start.toISOString())
      .lte("attempted_at", window.end.toISOString())
      .order("attempted_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as PuzzleAttemptRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  const puzzleAttempts = rows.map((row): InternalQuestPuzzleActivity => ({
    id: row.id,
    attemptedAt: row.attempted_at,
    solved: row.solved,
    firstTryCorrect: row.first_try_correct,
    selectedTheme: row.selected_theme,
    themes: puzzleThemes(row)
  }));

  const reviewAttempts: Array<{ id: string; attempted_at: string; outcome: "correct" | "incorrect" | "revealed" }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceClient()
      .from("adaptive_review_attempts")
      .select("id,attempted_at,outcome")
      .eq("student_id", studentId)
      .gte("attempted_at", window.start.toISOString())
      .lte("attempted_at", window.end.toISOString())
      .order("attempted_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as typeof reviewAttempts;
    reviewAttempts.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return [...puzzleAttempts, ...reviewAttempts.map((row): InternalQuestPuzzleActivity => ({
    id: row.id,
    attemptedAt: row.attempted_at,
    solved: row.outcome === "correct",
    firstTryCorrect: false,
    selectedTheme: "gameReview",
    themes: []
  }))].sort((left, right) => left.attemptedAt.localeCompare(right.attemptedAt));
}
