import "server-only";

import { aggregateGuidedAttempts, parseGuidedAttemptInput, type EnrichedGuidedAttempt } from "@/chess/analysis/guidedExercises";
import { evaluateGuidedMove } from "@/chess/analysis/tree";
import { getChapter, requireStudyAccess } from "@/chess/persistence/studyServer";
import type { ChessActor } from "@/lib/auth/requireChessActor";
import { lichessPuzzleThemes, type LichessPuzzleTheme } from "@/lib/puzzle-training/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type AttemptRow = {
  id: string; student_id: string; chapter_id: string; node_id: string; exercise_prompt: string;
  correct: boolean; attempted_at: string;
};

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Guided exercise storage is not configured.");
  return supabase;
}

function requireTeacher(actor: ChessActor) {
  if (actor.kind !== "admin") throw new Error("Teacher access required.");
}

export async function recordGuidedExerciseAttempt(actor: ChessActor, studyId: string, input: unknown) {
  if (actor.kind !== "student") throw new Error("Student access required.");
  await requireStudyAccess(actor, studyId);
  const parsed = parseGuidedAttemptInput(input);
  const chapter = await getChapter(actor, studyId, parsed.chapterId);
  const node = chapter.tree.nodes[parsed.nodeId];
  if (!node?.guidedExercise) throw new Error("Guided exercise not found.");
  const attempt = evaluateGuidedMove(node.fen, node.guidedExercise, parsed.move.from, parsed.move.to, parsed.move.promotion);
  const { error } = await client().from("chess_guided_exercise_attempts").insert({
    study_id: studyId,
    chapter_id: chapter.id,
    node_id: node.id,
    student_id: actor.studentId,
    attempted_uci: attempt.uci,
    attempted_san: attempt.san,
    correct: attempt.correct,
    exercise_prompt: node.guidedExercise.prompt
  });
  if (error) throw new Error(error.message);
  return {
    correct: attempt.correct,
    attemptedUci: attempt.uci,
    attemptedSan: attempt.san,
    fen: attempt.correct ? attempt.fen : node.fen,
    successMessage: attempt.correct ? node.guidedExercise.successMessage : ""
  };
}

export async function listGuidedExerciseProgress(actor: ChessActor, studyId: string) {
  requireTeacher(actor);
  await requireStudyAccess(actor, studyId);
  const supabase = client();
  const [{ data: attempts, error: attemptError }, { data: published, error: publishedError }] = await Promise.all([
    supabase.from("chess_guided_exercise_attempts").select("id,student_id,chapter_id,node_id,exercise_prompt,correct,attempted_at").eq("study_id", studyId).order("attempted_at", { ascending: false }),
    supabase.from("chess_puzzles").select("id,source_chapter_id,source_node_id,themes,is_active").eq("source_kind", "study").eq("source_study_id", studyId)
  ]);
  if (attemptError) throw new Error(attemptError.message);
  if (publishedError) throw new Error(publishedError.message);
  const rows = (attempts ?? []) as AttemptRow[];
  if (!rows.length) return { progress: [], published: published ?? [] };
  const [studentsResult, chaptersResult] = await Promise.all([
    supabase.from("students").select("id,display_name").in("id", Array.from(new Set(rows.map((row) => row.student_id)))),
    supabase.from("chess_study_chapters").select("id,title").in("id", Array.from(new Set(rows.map((row) => row.chapter_id))))
  ]);
  if (studentsResult.error) throw new Error(studentsResult.error.message);
  if (chaptersResult.error) throw new Error(chaptersResult.error.message);
  const studentNames = new Map((studentsResult.data ?? []).map((row) => [String(row.id), String(row.display_name)]));
  const chapterTitles = new Map((chaptersResult.data ?? []).map((row) => [String(row.id), String(row.title)]));
  const enriched: EnrichedGuidedAttempt[] = rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: studentNames.get(row.student_id) ?? "Student",
    chapterId: row.chapter_id,
    chapterTitle: chapterTitles.get(row.chapter_id) ?? "Chapter",
    nodeId: row.node_id,
    prompt: row.exercise_prompt,
    correct: row.correct,
    attemptedAt: row.attempted_at
  }));
  return { progress: aggregateGuidedAttempts(enriched), published: published ?? [] };
}

function parseTrainingTheme(value: unknown): LichessPuzzleTheme {
  if (!lichessPuzzleThemes.includes(value as LichessPuzzleTheme)) throw new Error("Invalid Puzzle Training theme.");
  return value as LichessPuzzleTheme;
}

export async function publishGuidedExercise(actor: ChessActor, studyId: string, input: { chapterId?: unknown; nodeId?: unknown; theme?: unknown }) {
  requireTeacher(actor);
  await requireStudyAccess(actor, studyId, true);
  const chapterId = String(input.chapterId ?? "");
  const nodeId = String(input.nodeId ?? "");
  const theme = parseTrainingTheme(input.theme);
  const chapter = await getChapter(actor, studyId, chapterId);
  const node = chapter.tree.nodes[nodeId];
  if (!node?.guidedExercise) throw new Error("Guided exercise not found.");
  const record = {
    lichess_puzzle_id: `academy:${studyId}:${chapterId}:${nodeId}`,
    initial_fen: node.fen,
    moves: [node.guidedExercise.expectedMovesUci[0]],
    start_mode: "direct",
    accepted_moves: node.guidedExercise.expectedMovesUci,
    source_kind: "study",
    source_study_id: studyId,
    source_chapter_id: chapterId,
    source_node_id: nodeId,
    teacher_prompt: node.guidedExercise.prompt,
    rating: null,
    rating_deviation: null,
    popularity: null,
    number_of_plays: null,
    themes: [theme],
    game_url: null,
    opening_tags: [],
    is_active: true,
    updated_at: new Date().toISOString()
  };
  const supabase = client();
  const { data: existing, error: findError } = await supabase.from("chess_puzzles").select("id")
    .eq("source_kind", "study").eq("source_study_id", studyId).eq("source_chapter_id", chapterId).eq("source_node_id", nodeId).maybeSingle();
  if (findError) throw new Error(findError.message);
  const query = existing
    ? supabase.from("chess_puzzles").update(record).eq("id", existing.id)
    : supabase.from("chess_puzzles").insert(record);
  const { data, error } = await query.select("id,themes,is_active").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function unpublishGuidedExercise(actor: ChessActor, studyId: string, input: { chapterId?: unknown; nodeId?: unknown }) {
  requireTeacher(actor);
  await requireStudyAccess(actor, studyId, true);
  const chapterId = String(input.chapterId ?? "");
  const nodeId = String(input.nodeId ?? "");
  if (!chapterId || !nodeId) throw new Error("Invalid guided exercise position.");
  const { error } = await client().from("chess_puzzles").update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("source_kind", "study").eq("source_study_id", studyId).eq("source_chapter_id", chapterId).eq("source_node_id", nodeId);
  if (error) throw new Error(error.message);
}
