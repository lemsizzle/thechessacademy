import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { QuestWindow } from "@/lib/quests/timeWindows";
import type { InternalQuestGameActivity, InternalQuestPuzzleActivity, InternalQuestStarWarsActivity, InternalQuestWoodpeckerSetActivity } from "@/lib/quests/evaluateInternalQuest";

const PAGE_SIZE = 1000;

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Supabase service access is not configured.");
  return client;
}

export async function loadInternalQuestGames(studentId: string, window: QuestWindow) {
  const rows: Array<{ id: string; completed_at: string; opponent_type: "computer" | "student"; opponent_id: string; result: "win" | "loss" | "draw"; takeback_count: number }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceClient()
      .from("internal_chess_games")
      .select("id,completed_at,opponent_type,opponent_id,result,takeback_count")
      .eq("player_id", studentId)
      .eq("game_mode", "live")
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
    result: row.result,
    takebackCount: row.takeback_count
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

export async function loadInternalQuestWoodpeckerSets(studentId: string, window: QuestWindow) {
  const rows: Array<{ id: string; started_at: string; completed_at: string; set_size: number; cycle_count: number }> = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await serviceClient()
      .from("student_woodpecker_set_results")
      .select("id,started_at,completed_at,set_size,cycle_count")
      .eq("student_id", studentId)
      .eq("set_size", 20)
      .eq("cycle_count", 3)
      .gte("started_at", window.start.toISOString())
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

  return rows.map((row): InternalQuestWoodpeckerSetActivity => ({
    id: String(row.id),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    setSize: row.set_size,
    cycleCount: row.cycle_count
  }));
}

export async function loadInternalQuestStarWarsRuns(studentId: string, window: QuestWindow) {
  const { data, error } = await serviceClient()
    .from("student_star_wars_runs")
    .select("id,started_at,updated_at,score")
    .eq("student_id", studentId)
    .gt("score", 0)
    .gte("started_at", window.start.toISOString())
    .gte("updated_at", window.start.toISOString())
    .lte("updated_at", window.end.toISOString())
    .order("score", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; started_at: string; updated_at: string; score: number }>;

  return rows.map((row): InternalQuestStarWarsActivity => ({
    id: String(row.id),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    score: row.score
  }));
}
