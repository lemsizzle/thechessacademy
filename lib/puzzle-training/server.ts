import { cookies } from "next/headers";
import { readStudentSession } from "@/lib/auth/session";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { lichessPuzzleThemes, type ChessPuzzleRow, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const puzzleSelect = "id,lichess_puzzle_id,initial_fen,moves,rating,rating_deviation,popularity,number_of_plays,themes,game_url,opening_tags,random_key,is_active";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Puzzle training requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return client;
}

export async function requirePuzzleStudent() {
  const session = readStudentSession(await cookies());
  if (!session || !session.onboardingCompleted || !UUID_PATTERN.test(session.studentId)) {
    throw new Error("Student log in required.");
  }

  const { data, error } = await serviceClient()
    .from("students")
    .select("id,lichess_id,lichess_username,is_active")
    .eq("id", session.studentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Student profile no longer exists.");
  const row = data as { id: string; lichess_id: string | null; lichess_username: string | null };
  const sameLichessId = Boolean(row.lichess_id && row.lichess_id === session.lichessUserId);
  const sameUsername = Boolean(row.lichess_username && row.lichess_username.toLowerCase() === session.lichessUsername.toLowerCase());
  if (!sameLichessId && !sameUsername) throw new Error("Student session does not match this profile.");
  return session;
}

export async function getTrainingPuzzle(puzzleId: string) {
  if (!UUID_PATTERN.test(puzzleId)) return null;
  const { data, error } = await serviceClient()
    .from("chess_puzzles")
    .select(puzzleSelect)
    .eq("id", puzzleId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ChessPuzzleRow | null;
}

async function candidateQuery(theme: Exclude<PuzzleThemeSlug, "mixed">, pivot: number, afterPivot: boolean) {
  let query = serviceClient()
    .from("chess_puzzles")
    .select(puzzleSelect)
    .eq("is_active", true)
    .contains("themes", [theme])
    .order("random_key", { ascending: true })
    .limit(40);
  query = afterPivot ? query.gte("random_key", pivot) : query.lt("random_key", pivot);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChessPuzzleRow[];
}

export async function selectTrainingPuzzle(studentId: string, selectedTheme: PuzzleThemeSlug, excludedIds: string[]) {
  const actualTheme = selectedTheme === "mixed"
    ? lichessPuzzleThemes[Math.floor(Math.random() * lichessPuzzleThemes.length)]
    : selectedTheme;
  const pivot = Math.random();
  let candidates = await candidateQuery(actualTheme, pivot, true);
  if (candidates.length < 10) candidates = [...candidates, ...await candidateQuery(actualTheme, pivot, false)];
  if (!candidates.length && selectedTheme === "mixed") {
    for (const fallbackTheme of lichessPuzzleThemes) {
      candidates = await candidateQuery(fallbackTheme, Math.random(), true);
      if (candidates.length) break;
    }
  }

  const excluded = new Set(excludedIds.filter((id) => UUID_PATTERN.test(id)).slice(-20));
  const available = candidates.filter((puzzle) => !excluded.has(puzzle.id));
  const pool = available.length ? available : candidates;
  if (!pool.length) return null;

  const ids = pool.map((puzzle) => puzzle.id);
  const { data: attempts, error: attemptsError } = await serviceClient()
    .from("student_puzzle_attempts")
    .select("puzzle_id")
    .eq("student_id", studentId)
    .in("puzzle_id", ids);
  if (attemptsError) throw new Error(attemptsError.message);
  const seen = new Set(((attempts ?? []) as Array<{ puzzle_id: string }>).map((attempt) => attempt.puzzle_id));
  const unseen = pool.filter((puzzle) => !seen.has(puzzle.id));
  const preferred = unseen.length ? unseen : pool;
  return preferred[Math.floor(Math.random() * preferred.length)];
}

export async function saveTrainingAttempt(input: {
  studentId: string;
  puzzleId: string;
  sessionId: string;
  selectedTheme: PuzzleThemeSlug;
  solved: boolean;
  incorrectMoveCount: number;
  hintsUsed: number;
  startedAt: string;
}) {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(input.startedAt).getTime()) / 1000));
  const record = {
    student_id: input.studentId,
    puzzle_id: input.puzzleId,
    session_id: input.sessionId,
    selected_theme: input.selectedTheme,
    solved: input.solved,
    first_try_correct: input.solved && input.incorrectMoveCount === 0 && input.hintsUsed === 0,
    incorrect_move_count: Math.max(0, input.incorrectMoveCount),
    elapsed_seconds: elapsedSeconds,
    hints_used: Math.max(0, input.hintsUsed),
    attempted_at: input.startedAt,
    completed_at: new Date().toISOString()
  };

  const { error } = await serviceClient()
    .from("student_puzzle_attempts")
    .upsert(record, { onConflict: "student_id,puzzle_id,session_id" });
  if (error) throw new Error(error.message);
  return { elapsedSeconds, firstTryCorrect: record.first_try_correct };
}
