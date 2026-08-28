import "server-only";

import { Chess } from "chess.js";
import { TIME_CONTROLS } from "@/chess/game/timeControls";
import type { MatchmakingStatus } from "@/chess/rating/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { ChessRatingServerError } from "@/chess/persistence/ratingServer";

const CHALLENGE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new ChessRatingServerError("Live matchmaking is not configured.", 503);
  return supabase;
}

function challengeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (value) => CHALLENGE_ALPHABET[value % CHALLENGE_ALPHABET.length]).join("");
}

function timeControl(value: unknown) {
  const control = TIME_CONTROLS.find((item) => item.id === String(value ?? ""));
  if (!control || control.initialMs === null) throw new ChessRatingServerError("Matchmaking requires a timed game.");
  return control;
}

function mapStatus(row: Record<string, unknown> | null): MatchmakingStatus {
  if (!row) return { status: "idle", ticketId: null, gameId: null, timeControlId: null, queuedAt: null };
  return {
    status: (row.ticket_status ?? row.status) as MatchmakingStatus["status"],
    ticketId: String(row.ticket_id ?? row.id),
    gameId: row.game_id ? String(row.game_id) : row.matched_game_id ? String(row.matched_game_id) : null,
    timeControlId: row.time_control_id ? String(row.time_control_id) : null,
    queuedAt: row.created_at ? String(row.created_at) : null
  };
}

export async function enterLiveMatchmaking(studentId: string, input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const control = timeControl(body.timeControlId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await client().rpc("join_live_chess_matchmaking", {
      p_student_id: studentId,
      p_time_control_id: control.id,
      p_time_control: control,
      p_initial_fen: new Chess().fen(),
      p_challenge_code: challengeCode(),
      p_rated: true
    });
    if (!error) return mapStatus((Array.isArray(data) ? data[0] : data) as Record<string, unknown>);
    if (error.code !== "23505") throw new ChessRatingServerError(error.message, 500);
  }
  throw new ChessRatingServerError("Matchmaking could not reserve a game. Try again.", 500);
}

export async function getLiveMatchmakingStatus(studentId: string): Promise<MatchmakingStatus> {
  const { data, error } = await client().from("live_chess_matchmaking_tickets").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new ChessRatingServerError(error.message, 500);
  if (!data) return mapStatus(null);
  if (data.status === "waiting" && Date.now() - new Date(data.created_at).getTime() > 10 * 60_000) {
    await client().from("live_chess_matchmaking_tickets").update({ status: "expired" }).eq("id", data.id).eq("status", "waiting");
    return mapStatus({ ...data, status: "expired" });
  }
  return mapStatus(data as Record<string, unknown>);
}

export async function cancelLiveMatchmaking(studentId: string) {
  const { error } = await client().from("live_chess_matchmaking_tickets").update({ status: "cancelled" }).eq("student_id", studentId).eq("status", "waiting");
  if (error) throw new ChessRatingServerError(error.message, 500);
  return getLiveMatchmakingStatus(studentId);
}
