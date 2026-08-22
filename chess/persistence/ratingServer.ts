import "server-only";

import type { ChessRatingDashboard, ChessRatingEvent, ChessRatingLeaderboardEntry, ChessRatingProfile } from "@/chess/rating/types";
import { chessRatingBand } from "@/chess/rating/rating";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ChessRatingServerError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new ChessRatingServerError("Chess rating storage is not configured.", 503);
  return supabase;
}

function assertStudentId(studentId: string) {
  if (!UUID_PATTERN.test(studentId)) throw new ChessRatingServerError("Invalid student ID.");
  return studentId;
}

type RatingRow = {
  student_id: string;
  rating: number;
  peak_rating: number;
  rated_games: number;
  wins: number;
  draws: number;
  losses: number;
  provisional: boolean;
  updated_at: string;
};

type EventRow = {
  id: string;
  game_id: string | null;
  student_id: string;
  opponent_id: string | null;
  event_type: "game" | "admin";
  result: "win" | "draw" | "loss" | null;
  rating_before: number;
  rating_after: number;
  rating_change: number;
  reason: string | null;
  created_at: string;
};

function mapProfile(row: RatingRow): ChessRatingProfile {
  return {
    studentId: row.student_id,
    rating: row.rating,
    peakRating: row.peak_rating,
    ratedGames: row.rated_games,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    provisional: row.provisional,
    band: chessRatingBand(row.rating),
    updatedAt: row.updated_at
  };
}

async function ensureProfile(studentId: string) {
  const { error } = await client().from("student_chess_ratings").upsert({ student_id: assertStudentId(studentId) }, { onConflict: "student_id", ignoreDuplicates: true });
  if (error) throw new ChessRatingServerError(error.message, 500);
}

async function studentNames(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, { name: string; classGroup: string }>();
  if (!unique.length) return names;
  const { data, error } = await client().from("students").select("id,display_name,lichess_username,class_group").in("id", unique);
  if (error) throw new ChessRatingServerError(error.message, 500);
  for (const row of data ?? []) {
    names.set(String(row.id), {
      name: String(row.display_name || row.lichess_username || "Student"),
      classGroup: String(row.class_group || "Unassigned")
    });
  }
  return names;
}

export async function applyRatingForCompletedGame(gameId: string) {
  const { data, error } = await client().rpc("apply_live_chess_rating", { p_game_id: gameId });
  if (error) throw new ChessRatingServerError(error.message, 500);
  return data;
}

export async function getChessRatingEvent(studentId: string, gameId: string) {
  const { data, error } = await client().from("chess_rating_events").select("rating_before,rating_after,rating_change").eq("student_id", assertStudentId(studentId)).eq("game_id", gameId).maybeSingle();
  if (error) throw new ChessRatingServerError(error.message, 500);
  return data ? { before: Number(data.rating_before), after: Number(data.rating_after), change: Number(data.rating_change) } : null;
}

export async function getStudentChessRatingDashboard(studentId: string): Promise<ChessRatingDashboard> {
  await ensureProfile(studentId);
  const [profileResult, historyResult, leaderboardResult] = await Promise.all([
    client().from("student_chess_ratings").select("*").eq("student_id", studentId).single(),
    client().from("chess_rating_events").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(30),
    client().from("student_chess_ratings").select("*").order("rating", { ascending: false }).order("rated_games", { ascending: false }).order("student_id", { ascending: true }).limit(50)
  ]);
  if (profileResult.error) throw new ChessRatingServerError(profileResult.error.message, 500);
  if (historyResult.error) throw new ChessRatingServerError(historyResult.error.message, 500);
  if (leaderboardResult.error) throw new ChessRatingServerError(leaderboardResult.error.message, 500);
  const historyRows = (historyResult.data ?? []) as EventRow[];
  const leaderboardRows = (leaderboardResult.data ?? []) as RatingRow[];
  const names = await studentNames([
    studentId,
    ...historyRows.flatMap((row) => row.opponent_id ? [row.opponent_id] : []),
    ...leaderboardRows.map((row) => row.student_id)
  ]);
  const events: ChessRatingEvent[] = historyRows.map((row) => ({
    id: row.id,
    gameId: row.game_id,
    eventType: row.event_type,
    opponentId: row.opponent_id,
    opponentName: row.opponent_id ? names.get(row.opponent_id)?.name ?? "Student" : null,
    result: row.result,
    ratingBefore: row.rating_before,
    ratingAfter: row.rating_after,
    ratingChange: row.rating_change,
    reason: row.reason ?? "Rating update",
    createdAt: row.created_at
  }));
  const leaderboard: ChessRatingLeaderboardEntry[] = leaderboardRows.map((row, index) => ({
    rank: index + 1,
    ...mapProfile(row),
    name: names.get(row.student_id)?.name ?? "Student",
    classGroup: names.get(row.student_id)?.classGroup ?? "Unassigned"
  }));
  return { profile: mapProfile(profileResult.data as RatingRow), events, leaderboard };
}

export async function listChessRatings() {
  const { data, error } = await client().from("student_chess_ratings").select("*").order("rating", { ascending: false }).order("rated_games", { ascending: false });
  if (error) throw new ChessRatingServerError(error.message, 500);
  const rows = (data ?? []) as RatingRow[];
  const names = await studentNames(rows.map((row) => row.student_id));
  return rows.map((row, index): ChessRatingLeaderboardEntry => ({
    rank: index + 1,
    ...mapProfile(row),
    name: names.get(row.student_id)?.name ?? "Student",
    classGroup: names.get(row.student_id)?.classGroup ?? "Unassigned"
  }));
}

export async function adjustStudentChessRating(studentId: string, rating: number, reason: string) {
  const nextRating = Number(rating);
  const cleanReason = reason.trim();
  if (!Number.isInteger(nextRating) || nextRating < 100 || nextRating > 3000) throw new ChessRatingServerError("Rating must be a whole number from 100 to 3000.");
  if (cleanReason.length < 3 || cleanReason.length > 240) throw new ChessRatingServerError("Enter a reason between 3 and 240 characters.");
  const { data, error } = await client().rpc("adjust_student_chess_rating", { p_student_id: assertStudentId(studentId), p_new_rating: nextRating, p_reason: cleanReason });
  if (error) throw new ChessRatingServerError(error.message, 500);
  return data;
}
