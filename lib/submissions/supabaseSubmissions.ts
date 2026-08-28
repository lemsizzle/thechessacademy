import { getSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase/server";
import type { StudentGameSubmission, StudentScoreSubmission, SubmissionStatus } from "@/lib/types";

type GameSubmissionRow = {
  id: string;
  student_id: string;
  game_url: string;
  platform: "lichess";
  lichess_game_id: string;
  played_as: StudentGameSubmission["playedAs"];
  game_type: string | null;
  opponent_name: string | null;
  notes: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  teacher_note: string | null;
  rejection_reason: string | null;
  linked_analysis_request_id: string | null;
};

type ScoreSubmissionRow = {
  id: string;
  student_id: string;
  challenge_name: string;
  tactic_theme: StudentScoreSubmission["tacticTheme"];
  score: number;
  total_questions: number | null;
  time_limit: string | null;
  platform: string | null;
  screenshot_url: string | null;
  notes: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  teacher_note: string | null;
  rejection_reason: string | null;
  xp_awarded: number | null;
  tactic_progress_added: number | null;
};

type JoinedColumns<T extends readonly string[]> = T extends readonly []
  ? ""
  : T extends readonly [infer Column extends string]
    ? Column
    : T extends readonly [infer Column extends string, ...infer Rest extends readonly string[]]
      ? `${Column},${JoinedColumns<Rest>}`
      : string;

function joinColumns<const T extends readonly string[]>(columns: T): JoinedColumns<T> {
  return columns.join(",") as JoinedColumns<T>;
}

const gameSubmissionColumns = [
  "id",
  "student_id",
  "game_url",
  "platform",
  "lichess_game_id",
  "played_as",
  "game_type",
  "opponent_name",
  "notes",
  "status",
  "submitted_at",
  "reviewed_at",
  "reviewed_by",
  "teacher_note",
  "rejection_reason",
  "linked_analysis_request_id"
] as const satisfies readonly (keyof GameSubmissionRow)[];

const scoreSubmissionColumns = [
  "id",
  "student_id",
  "challenge_name",
  "tactic_theme",
  "score",
  "total_questions",
  "time_limit",
  "platform",
  "screenshot_url",
  "notes",
  "status",
  "submitted_at",
  "reviewed_at",
  "reviewed_by",
  "teacher_note",
  "rejection_reason",
  "xp_awarded",
  "tactic_progress_added"
] as const satisfies readonly (keyof ScoreSubmissionRow)[];

const gameSubmissionSelect = joinColumns(gameSubmissionColumns);
const scoreSubmissionSelect = joinColumns(scoreSubmissionColumns);

function mapGame(row: GameSubmissionRow): StudentGameSubmission {
  return {
    id: row.id,
    studentId: row.student_id,
    gameUrl: row.game_url,
    platform: row.platform,
    lichessGameId: row.lichess_game_id,
    playedAs: row.played_as,
    gameType: row.game_type ?? undefined,
    opponentName: row.opponent_name ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    teacherNote: row.teacher_note ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    linkedAnalysisRequestId: row.linked_analysis_request_id ?? undefined
  };
}

function mapScore(row: ScoreSubmissionRow): StudentScoreSubmission {
  return {
    id: row.id,
    studentId: row.student_id,
    challengeName: row.challenge_name,
    tacticTheme: row.tactic_theme,
    score: row.score,
    totalQuestions: row.total_questions ?? undefined,
    timeLimit: row.time_limit ?? undefined,
    platform: row.platform ?? undefined,
    screenshotUrl: row.screenshot_url ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    teacherNote: row.teacher_note ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    xpAwarded: row.xp_awarded ?? undefined,
    tacticProgressAdded: row.tactic_progress_added ?? undefined
  };
}

export async function listSupabaseSubmissions(studentId?: string) {
  if (!isSupabaseServiceConfigured()) return { configured: false, games: [], scores: [] };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, games: [], scores: [] };

  let gamesQuery = supabase.from("student_game_submissions").select(gameSubmissionSelect);
  let scoresQuery = supabase.from("student_score_submissions").select(scoreSubmissionSelect);
  if (studentId) {
    gamesQuery = gamesQuery.eq("student_id", studentId);
    scoresQuery = scoresQuery.eq("student_id", studentId);
  }

  const [games, scores] = await Promise.all([
    gamesQuery.order("submitted_at", { ascending: false }),
    scoresQuery.order("submitted_at", { ascending: false })
  ]);

  const error = games.error?.message ?? scores.error?.message;
  if (error) return { configured: true, games: [], scores: [], error };

  return {
    configured: true,
    games: ((games.data ?? []) as GameSubmissionRow[]).map(mapGame),
    scores: ((scores.data ?? []) as ScoreSubmissionRow[]).map(mapScore)
  };
}

export async function insertSupabaseGameSubmission(submission: StudentGameSubmission) {
  if (!isSupabaseServiceConfigured()) return { configured: false, submission };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, submission };

  const { data, error } = await supabase
    .from("student_game_submissions")
    .insert({
      id: submission.id,
      student_id: submission.studentId,
      game_url: submission.gameUrl,
      platform: submission.platform,
      lichess_game_id: submission.lichessGameId,
      played_as: submission.playedAs,
      game_type: submission.gameType ?? null,
      opponent_name: submission.opponentName ?? null,
      notes: submission.notes ?? null,
      status: submission.status,
      submitted_at: submission.submittedAt
    })
    .select(gameSubmissionSelect)
    .single();

  if (error) throw new Error(error.message);
  return { configured: true, submission: mapGame(data as GameSubmissionRow) };
}

export async function insertSupabaseScoreSubmission(submission: StudentScoreSubmission) {
  if (!isSupabaseServiceConfigured()) return { configured: false, submission };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, submission };

  const { data, error } = await supabase
    .from("student_score_submissions")
    .insert({
      id: submission.id,
      student_id: submission.studentId,
      challenge_name: submission.challengeName,
      tactic_theme: submission.tacticTheme,
      score: submission.score,
      total_questions: submission.totalQuestions ?? null,
      time_limit: submission.timeLimit ?? null,
      platform: submission.platform ?? null,
      screenshot_url: submission.screenshotUrl ?? null,
      notes: submission.notes ?? null,
      status: submission.status,
      submitted_at: submission.submittedAt
    })
    .select(scoreSubmissionSelect)
    .single();

  if (error) throw new Error(error.message);
  return { configured: true, submission: mapScore(data as ScoreSubmissionRow) };
}

export async function updateSupabaseGameSubmission(submission: StudentGameSubmission) {
  if (!isSupabaseServiceConfigured()) return { configured: false, submission };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, submission };

  const { data, error } = await supabase
    .from("student_game_submissions")
    .update({
      status: submission.status,
      reviewed_at: submission.reviewedAt ?? null,
      reviewed_by: submission.reviewedBy ?? null,
      teacher_note: submission.teacherNote ?? null,
      rejection_reason: submission.rejectionReason ?? null,
      linked_analysis_request_id: submission.linkedAnalysisRequestId ?? null
    })
    .eq("id", submission.id)
    .select(gameSubmissionSelect)
    .single();

  if (error) throw new Error(error.message);
  return { configured: true, submission: mapGame(data as GameSubmissionRow) };
}

export async function updateSupabaseScoreSubmission(submission: StudentScoreSubmission) {
  if (!isSupabaseServiceConfigured()) return { configured: false, submission };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { configured: false, submission };

  const { data, error } = await supabase
    .from("student_score_submissions")
    .update({
      status: submission.status,
      reviewed_at: submission.reviewedAt ?? null,
      reviewed_by: submission.reviewedBy ?? null,
      teacher_note: submission.teacherNote ?? null,
      rejection_reason: submission.rejectionReason ?? null,
      xp_awarded: submission.xpAwarded ?? null,
      tactic_progress_added: submission.tacticProgressAdded ?? null
    })
    .eq("id", submission.id)
    .select(scoreSubmissionSelect)
    .single();

  if (error) throw new Error(error.message);
  return { configured: true, submission: mapScore(data as ScoreSubmissionRow) };
}
