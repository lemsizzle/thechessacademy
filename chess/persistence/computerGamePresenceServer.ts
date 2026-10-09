import "server-only";

import { Chess } from "chess.js";
import { BOT_DIFFICULTIES } from "@/chess/bots/difficulties";
import { gameMoves } from "@/chess/game/rules";
import { TIME_CONTROLS } from "@/chess/game/timeControls";
import { COMPUTER_GAME_PREFIX, COMPUTER_PRESENCE_TTL_MS, ComputerPresenceError, computerGameId, parseComputerPresence } from "@/chess/live/computerPresence";
import type { ComputerPresenceInput } from "@/chess/live/computerPresence";
import type { LiveGamePlayer, TeacherLiveGameSnapshot, TeacherLiveGameSummary } from "@/chess/live/types";
import type { ChessColor } from "@/chess/types";
import { getStudentAvatarDisplayData } from "@/lib/avatar/supabaseAvatar";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { readDisplayedBadges } from "@/lib/badges/displayedBadgeRead";

type Row = {
  student_id: string; game_id: string; version: number; status: ComputerPresenceInput["status"];
  bot_id: string; human_color: ChessColor; time_control_id: string; move_count: number;
  started_at: string; updated_at: string; snapshot: Pick<ComputerPresenceInput, "moves" | "clock" | "winnerColor" | "resultReason">;
};
const SUMMARY_COLUMNS = "student_id,game_id,version,status,bot_id,human_color,time_control_id,move_count,started_at,updated_at";

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new ComputerPresenceError("Computer game storage is not configured.", 503);
  return supabase;
}

export async function publishComputerGamePresence(studentId: string, body: unknown) {
  const now = Date.now();
  const input = parseComputerPresence(body, now);
  const activeColor = input.moves.length % 2 === 0 ? "white" : "black";
  const clock = input.clock ? { ...input.clock } : null;
  if (clock && input.status === "active") {
    const field = activeColor === "white" ? "whiteMs" : "blackMs";
    clock[field] = Math.max(0, clock[field] - Math.max(0, now - Date.parse(input.capturedAt)));
  }
  const { data, error } = await client().rpc("publish_student_computer_game", {
    p_student_id: studentId, p_game_id: input.gameId, p_version: input.version, p_status: input.status,
    p_bot_id: input.botId, p_human_color: input.humanColor, p_time_control_id: input.timeControlId,
    p_started_at: input.startedAt,
    p_snapshot: { moves: input.moves, clock, winnerColor: input.winnerColor, resultReason: input.resultReason }
  });
  if (error) throw new ComputerPresenceError(error.message, 500);
  return { accepted: data === true };
}

async function studentPlayers(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, LiveGamePlayer>();
  const [{ data, error }, displayedBadges] = await Promise.all([
    client().from("students").select("id,display_name,lichess_username").in("id", unique).eq("is_active", true),
    readDisplayedBadges(client(), unique).catch(() => new Map())
  ]);
  if (error) throw new ComputerPresenceError(error.message, 500);
  return new Map<string, LiveGamePlayer>((data ?? []).map((student) => [student.id, { id: student.id, name: student.display_name || student.lichess_username || "Student", ...(displayedBadges.has(student.id) ? { displayedBadge: displayedBadges.get(student.id) } : {}) }]));
}

function summary(row: Row, student: LiveGamePlayer): TeacherLiveGameSummary | null {
  const bot = BOT_DIFFICULTIES.find((bot) => bot.id === row.bot_id);
  const timeControl = TIME_CONTROLS.find((control) => control.id === row.time_control_id);
  if (!bot || !timeControl) return null;
  const opponent: LiveGamePlayer = { id: `bot-${bot.id}`, name: bot.name, botDifficultyId: bot.id, portrait: bot.portrait };
  return {
    id: `${COMPUTER_GAME_PREFIX}${row.game_id}`, computerPractice: true,
    players: row.human_color === "white" ? { white: student, black: opponent } : { white: opponent, black: student },
    timeControl, activeColor: row.move_count % 2 === 0 ? "white" : "black", moveCount: Math.ceil(row.move_count / 2),
    rated: false, matchmaking: false, arenaTournamentId: null, startedAt: row.started_at, updatedAt: row.updated_at
  };
}

export async function listTeacherComputerGames(): Promise<TeacherLiveGameSummary[]> {
  // The lobby never downloads move histories or avatar catalogs for each active game.
  const { data, error } = await client().from("student_computer_game_presence").select(SUMMARY_COLUMNS)
    .eq("status", "active").gte("updated_at", new Date(Date.now() - COMPUTER_PRESENCE_TTL_MS).toISOString())
    .order("updated_at", { ascending: false });
  if (error) throw new ComputerPresenceError(error.message, 500);
  const rows = (data ?? []) as Row[];
  const students = await studentPlayers(rows.map((row) => row.student_id));
  return rows.flatMap((row) => {
    const student = students.get(row.student_id);
    const game = student ? summary(row, student) : null;
    return game ? [game] : [];
  });
}

export async function getTeacherComputerGame(id: string): Promise<TeacherLiveGameSnapshot> {
  const { data, error } = await client().from("student_computer_game_presence").select("*").eq("game_id", computerGameId(id)).maybeSingle();
  if (error) throw new ComputerPresenceError(error.message, 500);
  if (!data) throw new ComputerPresenceError("This computer game has ended or been replaced by a new game.", 404);
  const row = data as Row;
  const [students, avatars] = await Promise.all([
    studentPlayers([row.student_id]), getStudentAvatarDisplayData([row.student_id]).catch(() => null)
  ]);
  const student = students.get(row.student_id);
  const base = student ? summary(row, student) : null;
  if (!student || !base) throw new ComputerPresenceError("This computer game is not available to watch.", 404);
  const chess = new Chess();
  try {
    for (const move of row.snapshot.moves) chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
  } catch { throw new ComputerPresenceError("The computer game position is not available yet.", 409); }
  const avatar = avatars?.avatars[row.student_id];
  if (avatar) student.avatar = avatar;
  const equipped = new Set(avatar ? Object.values(avatar.equippedItems) : []);
  const active = row.status === "active" && Date.now() - Date.parse(row.updated_at) < COMPUTER_PRESENCE_TTL_MS;
  return {
    ...base, status: active ? "active" : row.status === "completed" ? "completed" : "cancelled",
    version: row.version, realtimeTopic: "", initialFen: new Chess().fen(), fen: chess.fen(), moves: gameMoves(chess),
    avatarItems: avatars?.items.filter((item) => equipped.has(item.id)) ?? [],
    clocks: { whiteMs: row.snapshot.clock?.whiteMs ?? null, blackMs: row.snapshot.clock?.blackMs ?? null, startedAt: active ? row.updated_at : null },
    winnerColor: row.snapshot.winnerColor, resultReason: row.snapshot.resultReason,
    completedAt: row.status === "completed" ? row.updated_at : null, serverNow: new Date().toISOString()
  };
}
