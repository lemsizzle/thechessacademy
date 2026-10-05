import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { buildPuzzleDashboard, dashboardSince, type DashboardAttempt, type DashboardQuery } from "./dashboard";

const PAGE_SIZE = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTEMPT_COLUMNS = "id,puzzle_id,attempted_at,solved,first_try_correct,incorrect_move_count,hints_used,elapsed_seconds,training_mode,chess_puzzles(rating,themes,opening_tags,is_active)";

function client() {
  const result = getSupabaseServiceClient();
  if (!result) throw new Error("Puzzle dashboard is unavailable.");
  return result;
}

type AttemptRow = {
  id: string; puzzle_id: string; attempted_at: string; solved: boolean; first_try_correct: boolean;
  incorrect_move_count: number; hints_used: number; elapsed_seconds: number; training_mode: string;
  chess_puzzles: { rating: number | null; themes: string[]; opening_tags: string[]; is_active: boolean } | null;
};

export async function getPuzzleDashboard(studentId: string, query: DashboardQuery, now = Date.now()) {
  const db = client();
  const since = dashboardSince(query.period, now);
  const attempts: DashboardAttempt[] = [];
  // Keyset pagination avoids Supabase's row cap without sending entire histories to the browser.
  let cursor = "";
  for (;;) {
    let request = db.from("student_puzzle_attempts").select(ATTEMPT_COLUMNS)
      .eq("student_id", studentId).lte("attempted_at", new Date(now).toISOString()).order("id").limit(PAGE_SIZE);
    if (since) request = request.gte("attempted_at", since);
    if (cursor) request = request.gt("id", cursor);
    const { data, error } = await request;
    if (error) throw new Error("Could not load your puzzle results. Please try again.");
    const rows = (data ?? []) as unknown as AttemptRow[];
    if (!rows.length) break;
    for (const row of rows) attempts.push({
      id: row.id, puzzleId: row.puzzle_id, attemptedAt: row.attempted_at, solved: row.solved,
      clean: row.solved && row.first_try_correct && row.incorrect_move_count === 0 && row.hints_used === 0,
      seconds: Math.max(0, Number(row.elapsed_seconds) || 0), mode: row.training_mode,
      rating: row.chess_puzzles?.rating ?? null, themes: row.chess_puzzles?.themes ?? [],
      openings: row.chess_puzzles?.opening_tags ?? [], active: row.chess_puzzles?.is_active === true
    });
    const next = rows.at(-1)!.id;
    if (next === cursor) throw new Error("Could not finish loading puzzle results.");
    cursor = next;
  }

  const cleared = new Map<string, string>();
  let replayAvailable = true;
  cursor = "";
  for (;;) {
    let request = db.from("student_puzzle_replays").select("puzzle_id,cleared_at")
      .eq("student_id", studentId).order("puzzle_id").limit(PAGE_SIZE);
    if (cursor) request = request.gt("puzzle_id", cursor);
    const { data, error } = await request;
    // Backward-compatible rollout: show real stats even before the small replay migration deploys.
    if (error?.code === "42P01" || error?.code === "PGRST205") { replayAvailable = false; break; }
    if (error) throw new Error("Could not load your replay progress. Please try again.");
    const rows = (data ?? []) as { puzzle_id: string; cleared_at: string }[];
    if (!rows.length) break;
    for (const row of rows) cleared.set(row.puzzle_id, row.cleared_at);
    const next = rows.at(-1)!.puzzle_id;
    if (next === cursor) throw new Error("Could not finish loading replay progress.");
    cursor = next;
  }
  return buildPuzzleDashboard(attempts, cleared, query, now, replayAvailable);
}

export async function hasPuzzleHistory(studentId: string, puzzleId: string) {
  if (!UUID.test(puzzleId)) return false;
  const { data, error } = await client().from("student_puzzle_attempts").select("id")
    .eq("student_id", studentId).eq("puzzle_id", puzzleId).limit(1);
  if (error) throw new Error("Could not verify puzzle history.");
  return Boolean(data?.length);
}

export async function savePuzzleReplay(studentId: string, puzzleId: string) {
  const { error } = await client().from("student_puzzle_replays").upsert({
    student_id: studentId, puzzle_id: puzzleId, cleared_at: new Date().toISOString()
  }, { onConflict: "student_id,puzzle_id" });
  if (error) throw new Error("Your replay could not be saved. Please try again.");
}
