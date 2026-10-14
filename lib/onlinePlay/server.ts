import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { LiveGameRecord } from "@/chess/live/types";
import { ONLINE_CLOCKS, type DirectChallenge, type OnlinePlayState, type ResumableLiveGame } from "./types";

export class OnlinePlayError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function client() {
  const result = getSupabaseServiceClient();
  if (!result) throw new OnlinePlayError("Online play is unavailable.", 503);
  return result;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseOnlineAction(input: unknown) {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (body.action === "heartbeat") return { action: "heartbeat" as const };
  if (body.action === "challenge") {
    if (typeof body.recipientId !== "string" || !UUID.test(body.recipientId)) throw new OnlinePlayError("Choose an Academy student.");
    if (!ONLINE_CLOCKS.some((c) => c.id === body.timeControlId)) throw new OnlinePlayError("Choose a supported timed clock.");
    return { action: "challenge" as const, recipientId: body.recipientId, timeControlId: body.timeControlId as string };
  }
  if (body.action === "accept" || body.action === "decline" || body.action === "cancel") {
    if (typeof body.challengeId !== "string" || !UUID.test(body.challengeId)) throw new OnlinePlayError("Choose a valid challenge.");
    return { action: body.action, challengeId: body.challengeId };
  }
  throw new OnlinePlayError("Choose a valid online play action.");
}
type ChallengeRow = { id: string; challenger_id: string; recipient_id: string; time_control_id: string; status: DirectChallenge["status"]; expires_at: string; game_id: string | null };
type ActiveGameRow = Pick<LiveGameRecord, "id" | "white_player_id" | "black_player_id" | "active_color" | "arena_tournament_id" | "arena_bot" | "arena_opponent_bot">;
export async function getOnlinePlay(studentId: string): Promise<OnlinePlayState> {
  const db = client();
  const now = Date.now();
  const [presence, challenges, games] = await Promise.all([
    db.from("student_online_presence").select("student_id").gt("seen_at", new Date(now - 75_000).toISOString()).limit(300),
    db.from("student_live_challenges").select("id,challenger_id,recipient_id,time_control_id,status,expires_at,game_id")
      .or(`challenger_id.eq.${studentId},recipient_id.eq.${studentId}`).gt("created_at", new Date(now - 10 * 60_000).toISOString())
      .order("created_at", { ascending: false }).limit(50),
    // Reuse this existing active-game read for the return-to-game banner. No
    // history, PGN, FEN, avatar catalog or private realtime tokens are needed.
    db.from("live_chess_games").select("id,white_player_id,black_player_id,active_color,arena_tournament_id,arena_bot,arena_opponent_bot").eq("game_mode", "live").eq("status", "active")
  ]);
  if (presence.error || challenges.error || games.error) throw new OnlinePlayError("Online students could not be loaded. Try again.", 503);
  const rows = (challenges.data ?? []) as ChallengeRow[];
  const onlineIds = new Set((presence.data ?? []).map((p) => p.student_id as string));
  const ownGames = ((games.data ?? []) as ActiveGameRow[]).filter(g => g.white_player_id === studentId || g.black_player_id === studentId);
  const opponentIds = ownGames.flatMap(g => [g.white_player_id, g.black_player_id]).filter((id): id is string => Boolean(id));
  const ids = [...new Set([studentId, ...onlineIds, ...opponentIds, ...rows.flatMap((c) => [c.challenger_id, c.recipient_id])])];
  const students = await db.from("students").select("id,display_name,lichess_username").in("id", ids).eq("is_active", true);
  if (students.error) throw new OnlinePlayError("Online students could not be loaded.", 503);
  const names = new Map((students.data ?? []).map((s) => [s.id as string, (s.display_name || s.lichess_username || "Student") as string]));
  const busy = new Set((games.data ?? []).flatMap((g) => [g.white_player_id, g.black_player_id]));
  const mapChallenge = (c: ChallengeRow): DirectChallenge => ({
    id: c.id, challengerId: c.challenger_id, recipientId: c.recipient_id,
    opponentName: names.get(c.challenger_id === studentId ? c.recipient_id : c.challenger_id) ?? "Student",
    timeControlId: c.time_control_id, status: c.status === "pending" && Date.parse(c.expires_at) <= now ? "expired" : c.status,
    expiresAt: c.expires_at, gameId: c.game_id
  });
  const activeGames: ResumableLiveGame[] = ownGames.map(g => {
    const viewerColor = g.white_player_id === studentId ? "white" : "black";
    const opponentColor = viewerColor === "white" ? "black" : "white";
    const opponentId = viewerColor === "white" ? g.black_player_id : g.white_player_id;
    const bot = [g.arena_bot, g.arena_opponent_bot].find(b => b?.color === opponentColor);
    return {
      id: g.id, status: "active", gameMode: "live", viewerColor,
      opponent: bot ? { id: bot.id, name: bot.name } : opponentId ? { id: opponentId, name: names.get(opponentId) ?? "Student" } : null,
      activeColor: g.active_color, arenaTournamentId: g.arena_tournament_id
    };
  });
  return {
    activeGames,
    busy: busy.has(studentId),
    students: [...onlineIds].filter((id) => id !== studentId && names.has(id))
      .map((id) => ({ id, name: names.get(id)!, busy: busy.has(id) }))
      .sort((a, b) => Number(a.busy) - Number(b.busy) || a.name.localeCompare(b.name)),
    incoming: rows.filter((c) => c.recipient_id === studentId).map(mapChallenge),
    outgoing: rows.filter((c) => c.challenger_id === studentId).map(mapChallenge)
  };
}
export async function performOnlineAction(studentId: string, input: unknown) {
  const body = parseOnlineAction(input);
  const db = client();
  const result = body.action === "heartbeat"
    ? await db.rpc("touch_student_online", { p_student_id: studentId })
    : body.action === "challenge"
      ? await db.rpc("create_student_live_challenge", { p_student_id: studentId, p_recipient_id: body.recipientId, p_time_control_id: body.timeControlId })
      : await db.rpc("respond_student_live_challenge", { p_student_id: studentId, p_challenge_id: body.challengeId, p_action: body.action });
  if (result.error) throw new OnlinePlayError(result.error.code === "P0001" ? result.error.message : "Online play is unavailable. Please try again.", 409);
  return result.data;
}
