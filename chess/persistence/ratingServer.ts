import "server-only";

import type { ChessRatingLeaderboardEntry, ChessRatingProfile } from "@/chess/rating/types";
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
