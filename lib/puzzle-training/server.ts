import { createHash } from "node:crypto";
import { requireActiveStudent, requireSignedInStudent } from "@/lib/auth/requireActiveStudent";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { academyPuzzleDate, dailyPuzzlePivot } from "@/lib/puzzle-training/daily";
import { calculateWoodpeckerCycleStats, WOODPECKER_CYCLE_COUNT, WOODPECKER_MAX_SET_SIZE, WOODPECKER_SET_SIZE_OPTIONS } from "@/lib/puzzle-training/modes";
import type { WoodpeckerCycleOverview } from "@/lib/puzzle-training/overview";
import { lichessPuzzleThemes, parsePuzzleTheme, puzzleLevelRatingRange, type ChessPuzzleRow, type PuzzleLevelSlug, type PuzzleThemeSlug, type PuzzleTrainingMode } from "@/lib/puzzle-training/types";
import { validateCompletedWoodpeckerSet, type SavedWoodpeckerSetAttempt } from "@/lib/puzzle-training/woodpeckerSet";

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

export async function requirePuzzleSessionStudent() {
  return requireSignedInStudent();
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

  const excluded = new Set(excludedIds.filter((id) => UUID_PATTERN.test(id)).slice(-WOODPECKER_MAX_SET_SIZE));
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
  trainingMode: PuzzleTrainingMode;
  solved: boolean;
  incorrectMoveCount: number;
  hintsUsed: number;
  startedAt: string;
  woodpeckerRunId?: string;
  woodpeckerCycleNumber?: number;
}) {
  const hasWoodpeckerIdentity = input.woodpeckerRunId !== undefined || input.woodpeckerCycleNumber !== undefined;
  if (hasWoodpeckerIdentity && (
    input.trainingMode !== "woodpecker"
    || !UUID_PATTERN.test(input.woodpeckerRunId ?? "")
    || !Number.isInteger(input.woodpeckerCycleNumber)
    || (input.woodpeckerCycleNumber ?? 0) < 1
    || (input.woodpeckerCycleNumber ?? 0) > WOODPECKER_CYCLE_COUNT
  )) {
    throw new Error("Invalid Woodpecker attempt identity.");
  }
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(input.startedAt).getTime()) / 1000));
  const record = {
    student_id: input.studentId,
    puzzle_id: input.puzzleId,
    session_id: input.sessionId,
    selected_theme: input.selectedTheme,
    training_mode: input.trainingMode,
    solved: input.solved,
    first_try_correct: input.solved && input.incorrectMoveCount === 0 && input.hintsUsed === 0,
    incorrect_move_count: Math.max(0, input.incorrectMoveCount),
    elapsed_seconds: elapsedSeconds,
    hints_used: Math.max(0, input.hintsUsed),
    attempted_at: input.startedAt,
    completed_at: new Date().toISOString(),
    ...(hasWoodpeckerIdentity ? {
      woodpecker_run_id: input.woodpeckerRunId,
      woodpecker_cycle_number: input.woodpeckerCycleNumber
    } : {})
  };

  const { error } = await serviceClient()
    .from("student_puzzle_attempts")
    .upsert(record, { onConflict: "student_id,puzzle_id,session_id" });
  if (error) throw new Error(error.message);
  return { elapsedSeconds, firstTryCorrect: record.first_try_correct };
}

export async function saveCompletedWoodpeckerCycle(
  studentId: string,
  sessionId: string,
  expectedSetSize?: number,
  identity?: { runId: string; cycleNumber: number }
): Promise<WoodpeckerCycleOverview> {
  if (!UUID_PATTERN.test(sessionId)) throw new Error("Invalid Woodpecker session.");
  if (identity && (
    !UUID_PATTERN.test(identity.runId)
    || !Number.isInteger(identity.cycleNumber)
    || identity.cycleNumber < 1
    || identity.cycleNumber > WOODPECKER_CYCLE_COUNT
  )) throw new Error("Invalid Woodpecker cycle identity.");
  const validExpectedSetSize = WOODPECKER_SET_SIZE_OPTIONS.includes(expectedSetSize as typeof WOODPECKER_SET_SIZE_OPTIONS[number])
    ? expectedSetSize
    : undefined;
  const client = serviceClient();
  type SavedAttempt = {
    solved: boolean;
    incorrect_move_count: number;
    elapsed_seconds: number;
    selected_theme: string;
    completed_at: string | null;
  };
  let attempts: SavedAttempt[] = [];
  const retryDelays = validExpectedSetSize ? [0, 100, 250, 500, 1_000, 1_500] : [0];
  for (const retryDelay of retryDelays) {
    if (retryDelay) await new Promise((resolve) => setTimeout(resolve, retryDelay));
    const { data, error } = await client
      .from("student_puzzle_attempts")
      .select("solved,incorrect_move_count,elapsed_seconds,selected_theme,completed_at")
      .eq("student_id", studentId)
      .eq("session_id", sessionId)
      .eq("training_mode", "woodpecker");
    if (error) throw new Error(error.message);
    attempts = (data ?? []) as SavedAttempt[];
    if (!validExpectedSetSize
      || (attempts.length === validExpectedSetSize && attempts.every((attempt) => attempt.solved))) break;
  }
  const setSize = attempts.length;
  if ((validExpectedSetSize && setSize !== validExpectedSetSize)
    || !WOODPECKER_SET_SIZE_OPTIONS.includes(setSize as typeof WOODPECKER_SET_SIZE_OPTIONS[number])
    || attempts.some((attempt) => !attempt.solved)) {
    throw new Error("This Woodpecker cycle is not complete yet.");
  }

  const incorrectMoves = attempts.reduce((total, attempt) => total + Math.max(0, Number(attempt.incorrect_move_count)), 0);
  const elapsedSeconds = attempts.reduce((total, attempt) => total + Math.max(0, Number(attempt.elapsed_seconds)), 0);
  const stats = calculateWoodpeckerCycleStats(setSize, incorrectMoves, elapsedSeconds);
  const selectedTheme = parsePuzzleTheme(attempts[0]?.selected_theme ?? null);
  const completedAt = attempts.reduce((latest, attempt) => {
    if (!attempt.completed_at) return latest;
    return !latest || attempt.completed_at > latest ? attempt.completed_at : latest;
  }, "") || new Date().toISOString();

  const { error: saveError } = await client
    .from("student_woodpecker_cycle_results")
    .upsert({
      student_id: studentId,
      session_id: sessionId,
      selected_theme: selectedTheme,
      set_size: setSize,
      incorrect_moves: incorrectMoves,
      elapsed_seconds: elapsedSeconds,
      puzzles_per_minute: stats.puzzlesPerMinute,
      accuracy: stats.accuracy,
      completed_at: completedAt,
      ...(identity ? { run_id: identity.runId, cycle_number: identity.cycleNumber } : {})
    }, { onConflict: "student_id,session_id" });
  if (saveError) throw new Error(saveError.message);

  return {
    setSize,
    puzzlesPerMinute: stats.puzzlesPerMinute,
    accuracy: stats.accuracy,
    theme: selectedTheme,
    completedAt
  };
}

type SavedWoodpeckerSetRow = {
  run_id: string;
  cycle_sessions_hash: string;
  puzzle_set_hash: string;
  selected_theme: string;
  set_size: number;
  cycle_count: number;
  started_at: string;
  completed_at: string;
};

const woodpeckerSetSelect = "run_id,cycle_sessions_hash,puzzle_set_hash,selected_theme,set_size,cycle_count,started_at,completed_at";

function fingerprint(values: string[]) {
  return createHash("sha256").update([...values].sort().join("|")).digest("hex");
}

function woodpeckerSetOverview(row: SavedWoodpeckerSetRow) {
  return {
    setSize: Number(row.set_size),
    cycleCount: Number(row.cycle_count),
    theme: parsePuzzleTheme(row.selected_theme),
    startedAt: row.started_at,
    completedAt: row.completed_at
  };
}

function resolveExistingWoodpeckerSet(
  rows: SavedWoodpeckerSetRow[],
  runId: string,
  cycleSessionsHash: string,
  puzzleSetHash: string
) {
  const matchingRun = rows.find((row) => row.run_id === runId);
  if (matchingRun && (matchingRun.cycle_sessions_hash !== cycleSessionsHash || matchingRun.puzzle_set_hash !== puzzleSetHash)) {
    throw new Error("This Woodpecker run was already recorded with different cycles.");
  }
  const matchingSessions = rows.find((row) => row.cycle_sessions_hash === cycleSessionsHash);
  if (matchingSessions && (matchingSessions.run_id !== runId || matchingSessions.puzzle_set_hash !== puzzleSetHash)) {
    throw new Error("These Woodpecker cycles were already recorded for a different set.");
  }
  return matchingRun ?? matchingSessions ?? null;
}

export async function saveCompletedWoodpeckerSet(input: {
  studentId: string;
  runId: string;
  cycleSessionIds: string[];
}) {
  if (!UUID_PATTERN.test(input.runId)
    || input.cycleSessionIds.length !== WOODPECKER_CYCLE_COUNT
    || new Set(input.cycleSessionIds).size !== WOODPECKER_CYCLE_COUNT
    || input.cycleSessionIds.some((sessionId) => typeof sessionId !== "string" || !UUID_PATTERN.test(sessionId))) {
    throw new Error("Invalid Woodpecker set session.");
  }

  const client = serviceClient();
  const { data: attemptData, error: attemptError } = await client
    .from("student_puzzle_attempts")
    .select("puzzle_id,session_id,solved,selected_theme,attempted_at,completed_at,woodpecker_run_id,woodpecker_cycle_number")
    .eq("student_id", input.studentId)
    .eq("training_mode", "woodpecker")
    .eq("woodpecker_run_id", input.runId)
    .in("session_id", input.cycleSessionIds);
  if (attemptError) throw new Error(attemptError.message);

  const validated = validateCompletedWoodpeckerSet(
    input.runId,
    input.cycleSessionIds,
    (attemptData ?? []) as SavedWoodpeckerSetAttempt[]
  );
  const cycleSessionsHash = fingerprint(input.cycleSessionIds);
  const puzzleSetHash = fingerprint(validated.puzzleIds);
  const selectedTheme = parsePuzzleTheme(validated.selectedTheme);

  const findExisting = async () => {
    const { data, error } = await client
      .from("student_woodpecker_set_results")
      .select(woodpeckerSetSelect)
      .eq("student_id", input.studentId)
      .or(`run_id.eq.${input.runId},cycle_sessions_hash.eq.${cycleSessionsHash}`)
      .limit(2);
    if (error) throw new Error(error.message);
    return (data ?? []) as SavedWoodpeckerSetRow[];
  };

  const existing = resolveExistingWoodpeckerSet(
    await findExisting(),
    input.runId,
    cycleSessionsHash,
    puzzleSetHash
  );
  if (existing) return woodpeckerSetOverview(existing);

  const record = {
    student_id: input.studentId,
    run_id: input.runId,
    cycle_session_ids: input.cycleSessionIds,
    cycle_sessions_hash: cycleSessionsHash,
    puzzle_set_hash: puzzleSetHash,
    selected_theme: selectedTheme,
    set_size: validated.setSize,
    cycle_count: validated.cycleCount,
    started_at: validated.startedAt,
    completed_at: validated.completedAt
  };
  const { data: saved, error: saveError } = await client
    .from("student_woodpecker_set_results")
    .insert(record)
    .select(woodpeckerSetSelect)
    .single();
  if (!saveError && saved) return woodpeckerSetOverview(saved as SavedWoodpeckerSetRow);
  if (saveError?.code !== "23505") throw new Error(saveError?.message ?? "Woodpecker set could not be saved.");

  const racedExisting = resolveExistingWoodpeckerSet(
    await findExisting(),
    input.runId,
    cycleSessionsHash,
    puzzleSetHash
  );
  if (!racedExisting) throw new Error("Woodpecker set could not be saved.");
  return woodpeckerSetOverview(racedExisting);
}
