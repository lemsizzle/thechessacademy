import { requireActiveStudent } from "@/lib/auth/requireActiveStudent";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { academyPuzzleDate, dailyPuzzlePivot } from "@/lib/puzzle-training/daily";
import { lichessPuzzleThemes, puzzleLevelRatingRange, type ChessPuzzleRow, type PuzzleLevelSlug, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

const puzzleSelect = "id,lichess_puzzle_id,initial_fen,moves,start_mode,accepted_moves,source_kind,source_study_id,source_chapter_id,source_node_id,teacher_prompt,rating,rating_deviation,popularity,number_of_plays,themes,game_url,opening_tags,random_key,is_active";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUZZLE_CACHE_TTL_MS = 5 * 60 * 1000;
const PUZZLE_CACHE_MAX_ENTRIES = 256;
const trainingPuzzleCache = new Map<string, { expiresAt: number; puzzle: ChessPuzzleRow }>();

function rememberTrainingPuzzle(puzzle: ChessPuzzleRow) {
  if (trainingPuzzleCache.size >= PUZZLE_CACHE_MAX_ENTRIES) {
    const oldestKey = trainingPuzzleCache.keys().next().value as string | undefined;
    if (oldestKey) trainingPuzzleCache.delete(oldestKey);
  }
  trainingPuzzleCache.set(puzzle.id, { expiresAt: Date.now() + PUZZLE_CACHE_TTL_MS, puzzle });
  return puzzle;
}

function serviceClient() {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Puzzle training requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return client;
}

export async function requirePuzzleStudent() {
  return requireActiveStudent();
}

export async function getTrainingPuzzle(puzzleId: string) {
  if (!UUID_PATTERN.test(puzzleId)) return null;
  const cached = trainingPuzzleCache.get(puzzleId);
  if (cached && cached.expiresAt > Date.now()) return cached.puzzle;
  if (cached) trainingPuzzleCache.delete(puzzleId);
  const { data, error } = await serviceClient()
    .from("chess_puzzles")
    .select(puzzleSelect)
    .eq("id", puzzleId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const puzzle = data as ChessPuzzleRow | null;
  return puzzle ? rememberTrainingPuzzle(puzzle) : null;
}

async function getDailyPuzzleAssignment(puzzleDate: string) {
  const { data, error } = await serviceClient()
    .from("daily_chess_puzzles")
    .select("puzzle_id")
    .eq("puzzle_date", puzzleDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { puzzle_id: string } | null)?.puzzle_id ?? null;
}

async function dailyPuzzleCandidate(pivot: number, afterPivot: boolean) {
  let query = serviceClient()
    .from("chess_puzzles")
    .select(puzzleSelect)
    .eq("is_active", true)
    .eq("source_kind", "lichess")
    .gte("rating", 600)
    .lte("rating", 2200)
    .order("random_key", { ascending: true })
    .limit(1);
  query = afterPivot ? query.gte("random_key", pivot) : query.lt("random_key", pivot);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as ChessPuzzleRow | undefined) ?? null;
}

export async function getDailyTrainingPuzzle(studentId: string) {
  const puzzleDate = academyPuzzleDate();
  let puzzleId = await getDailyPuzzleAssignment(puzzleDate);

  if (!puzzleId) {
    const pivot = dailyPuzzlePivot(puzzleDate);
    const candidate = await dailyPuzzleCandidate(pivot, true) ?? await dailyPuzzleCandidate(pivot, false);
    if (!candidate) return null;
    const { error } = await serviceClient()
      .from("daily_chess_puzzles")
      .upsert({ puzzle_date: puzzleDate, puzzle_id: candidate.id }, { onConflict: "puzzle_date", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    puzzleId = await getDailyPuzzleAssignment(puzzleDate);
  }

  if (!puzzleId) return null;
  const puzzle = await getTrainingPuzzle(puzzleId);
  if (!puzzle) return null;
  const { data: reward, error: rewardError } = await serviceClient()
    .from("student_daily_puzzle_rewards")
    .select("id")
    .eq("student_id", studentId)
    .eq("puzzle_date", puzzleDate)
    .maybeSingle();
  if (rewardError) throw new Error(rewardError.message);
  return { puzzle, puzzleDate, rewardClaimed: Boolean(reward) };
}

export async function awardDailyTrainingPuzzle(studentId: string, puzzleId: string, puzzleDate: string) {
  if (puzzleDate !== academyPuzzleDate()) throw new Error("This Puzzle of the Day has expired.");
  const { data, error } = await serviceClient().rpc("award_daily_puzzle", {
    p_student_id: studentId,
    p_puzzle_id: puzzleId,
    p_puzzle_date: puzzleDate
  });
  if (error) throw new Error(error.message);
  const result = data as { awarded?: boolean; xpAwarded?: number; coinsAwarded?: number } | null;
  return {
    awarded: result?.awarded === true,
    xpAwarded: Number(result?.xpAwarded ?? 0),
    coinsAwarded: Number(result?.coinsAwarded ?? 0)
  };
}

async function candidateQuery(theme: Exclude<PuzzleThemeSlug, "mixed">, level: PuzzleLevelSlug, pivot: number, afterPivot: boolean) {
  let query = serviceClient()
    .from("chess_puzzles")
    .select(puzzleSelect)
    .eq("is_active", true)
    .contains("themes", [theme])
    .order("random_key", { ascending: true })
    .limit(40);
  const ratingRange = puzzleLevelRatingRange(level);
  if (ratingRange) query = query.gte("rating", ratingRange.minimum).lte("rating", ratingRange.maximum);
  query = afterPivot ? query.gte("random_key", pivot) : query.lt("random_key", pivot);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ChessPuzzleRow[];
}

export async function selectTrainingPuzzle(studentId: string, selectedTheme: PuzzleThemeSlug, selectedLevel: PuzzleLevelSlug, excludedIds: string[]) {
  const actualTheme = selectedTheme === "mixed"
    ? lichessPuzzleThemes[Math.floor(Math.random() * lichessPuzzleThemes.length)]
    : selectedTheme;
  const pivot = Math.random();
  let candidates = await candidateQuery(actualTheme, selectedLevel, pivot, true);
  if (candidates.length < 10) candidates = [...candidates, ...await candidateQuery(actualTheme, selectedLevel, pivot, false)];
  if (!candidates.length && selectedTheme === "mixed") {
    for (const fallbackTheme of lichessPuzzleThemes) {
      candidates = await candidateQuery(fallbackTheme, selectedLevel, Math.random(), true);
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
  return rememberTrainingPuzzle(preferred[Math.floor(Math.random() * preferred.length)]);
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
